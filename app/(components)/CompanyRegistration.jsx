'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building, 
  Upload, 
  Phone, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader, 
  AlertCircle,
  User,
  Mail,
  MapPin,
  Sparkles,
  Crown,
  ArrowRight,
  ArrowLeft,
  Star,
  UserPlus,
  Users,
  Shield,
  Trash2,
  Settings,
  Clock,
  Search
} from 'lucide-react';
import { collection, addDoc, doc, updateDoc, arrayUnion, arrayRemove, getDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase';

const CompanyRegistration = ({ user, onRegistrationComplete }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    abn: '',
    website: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      postcode: '',
      country: 'Australia'
    },
    contactPerson: user?.fullName || '',
    email: user?.emailAddresses?.[0]?.emailAddress || ''
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(1);
  
  // ABN Validation States
  const [isCheckingABN, setIsCheckingABN] = useState(false);
  const [abnExists, setAbnExists] = useState(false);
  const [existingCompany, setExistingCompany] = useState(null);
  
  // Company Name Validation States
  const [isCheckingCompanyName, setIsCheckingCompanyName] = useState(false);
  const [companyNameExists, setCompanyNameExists] = useState(false);
  const [matchingCompanies, setMatchingCompanies] = useState([]);
  
  // Access Request States
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [accessRequestMessage, setAccessRequestMessage] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Check if ABN already exists
  const checkABNExists = async (abn) => {
    if (!abn.trim()) return;
    
    const cleanABN = abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(cleanABN)) return;

    try {
      setIsCheckingABN(true);
      
      const companiesRef = collection(db, 'companies');
      const q = query(companiesRef, where('abn', '==', cleanABN));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        const companyData = existingDoc.data();
        
        setAbnExists(true);
        setExistingCompany({
          id: existingDoc.id,
          ...companyData
        });
        setSelectedCompany({
          id: existingDoc.id,
          ...companyData
        });
      } else {
        setAbnExists(false);
        setExistingCompany(null);
      }
    } catch (error) {
      console.error('Error checking ABN:', error);
    } finally {
      setIsCheckingABN(false);
    }
  };

  // Check if company name already exists (fuzzy matching)
  const checkCompanyNameExists = async (companyName) => {
    if (!companyName.trim() || companyName.trim().length < 3) {
      setCompanyNameExists(false);
      setMatchingCompanies([]);
      return;
    }

    try {
      setIsCheckingCompanyName(true);
      
      const companiesRef = collection(db, 'companies');
      const querySnapshot = await getDocs(companiesRef);
      
      const searchTerm = companyName.toLowerCase().trim();
      const matches = [];
      
      querySnapshot.forEach((doc) => {
        const companyData = doc.data();
        const existingName = companyData.companyName.toLowerCase();
        
        // Check for exact match, partial match, or similar names
        if (
          existingName === searchTerm ||
          existingName.includes(searchTerm) ||
          searchTerm.includes(existingName) ||
          // Check for common variations (removing common business suffixes)
          removeBusinessSuffixes(existingName) === removeBusinessSuffixes(searchTerm)
        ) {
          matches.push({
            id: doc.id,
            ...companyData,
            similarity: calculateSimilarity(existingName, searchTerm)
          });
        }
      });
      
      // Sort by similarity score
      matches.sort((a, b) => b.similarity - a.similarity);
      
      if (matches.length > 0) {
        setCompanyNameExists(true);
        setMatchingCompanies(matches);
      } else {
        setCompanyNameExists(false);
        setMatchingCompanies([]);
      }
    } catch (error) {
      console.error('Error checking company name:', error);
    } finally {
      setIsCheckingCompanyName(false);
    }
  };

  // Helper function to remove common business suffixes for better matching
  const removeBusinessSuffixes = (name) => {
    const suffixes = ['pty ltd', 'ltd', 'inc', 'corp', 'corporation', 'company', 'co', 'llc', 'limited'];
    let cleanName = name.toLowerCase().trim();
    
    suffixes.forEach(suffix => {
      if (cleanName.endsWith(suffix)) {
        cleanName = cleanName.replace(new RegExp(`\\s*${suffix}\\s*$`), '').trim();
      }
    });
    
    return cleanName;
  };

  // Calculate similarity between two strings (simple algorithm)
  const calculateSimilarity = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  // Levenshtein distance calculation
  const levenshteinDistance = (str1, str2) => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Submit access request
  const submitAccessRequest = async () => {
    if (!accessRequestMessage.trim() || !selectedCompany) return;

    try {
      setIsSubmittingRequest(true);
      
      const requestData = {
        requesterEmail: user?.emailAddresses?.[0]?.emailAddress,
        requesterName: user?.fullName || '',
        companyId: selectedCompany.id,
        companyName: selectedCompany.companyName,
        abn: selectedCompany.abn,
        superAdminEmail: selectedCompany.superAdmin || selectedCompany.userEmail,
        message: accessRequestMessage.trim(),
        requestDate: new Date(),
        status: 'pending',
        requestType: abnExists ? 'abn_match' : 'name_match'
      };

      await addDoc(collection(db, 'adminAccess'), requestData);
      setRequestSubmitted(true);
      setAccessRequestMessage('');
      
    } catch (error) {
      console.error('Error submitting access request:', error);
      setErrors({ request: 'Failed to submit request. Please try again.' });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Handle company selection for access request
  const handleCompanySelection = (company) => {
    setSelectedCompany(company);
    setShowAccessRequest(true);
  };

  // ABN Validation (Australian Business Number)
  const validateABN = (abn) => {
    const cleanABN = abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(cleanABN)) {
      return false;
    }

    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;
    
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(cleanABN[i]);
      if (i === 0) {
        sum += (digit - 1) * weights[i];
      } else {
        sum += digit * weights[i];
      }
    }
    
    return sum % 89 === 0;
  };

  // Australian phone number validation
  const validatePhone = (phone) => {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    return /^(\+61|0)[2-9]\d{8}$/.test(cleanPhone);
  };

  // Handle form field changes
  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const fields = field.split('.');
      setFormData(prev => {
        const newData = { ...prev };
        let current = newData;
        for (let i = 0; i < fields.length - 1; i++) {
          current = current[fields[i]];
        }
        current[fields[fields.length - 1]] = value;
        return newData;
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }

    // Reset company name check states when user types
    if (field === 'companyName') {
      if (companyNameExists) {
        setCompanyNameExists(false);
        setMatchingCompanies([]);
        setShowAccessRequest(false);
        setSelectedCompany(null);
        setRequestSubmitted(false);
      }
    }
  };

  // Handle logo file upload
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({
          ...prev,
          logo: 'Please select a valid image file'
        }));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({
          ...prev,
          logo: 'File size must be less than 5MB'
        }));
        return;
      }

      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target.result);
      };
      reader.readAsDataURL(file);

      // Clear logo error
      if (errors.logo) {
        setErrors(prev => ({
          ...prev,
          logo: null
        }));
      }
    }
  };

  // Validate current step
  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.companyName.trim()) {
        newErrors.companyName = 'Company name is required';
      } else if (companyNameExists && matchingCompanies.length > 0) {
        newErrors.companyName = 'Similar company names found. Please check if your company is already registered.';
      }
      
      if (!formData.abn.trim()) {
        newErrors.abn = 'ABN is required';
      } else if (!validateABN(formData.abn)) {
        newErrors.abn = 'Please enter a valid ABN';
      } else if (abnExists) {
        newErrors.abn = 'This ABN is already registered. Please request access to continue.';
      }
      
      if (!logoFile) {
        newErrors.logo = 'Company logo is required';
      }
    }

    if (step === 2) {
      if (!formData.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      } else if (!validatePhone(formData.phone)) {
        newErrors.phone = 'Please enter a valid Australian phone number';
      }
      if (!formData.contactPerson.trim()) {
        newErrors.contactPerson = 'Contact person is required';
      }
      if (!formData.address.street.trim()) {
        newErrors['address.street'] = 'Street address is required';
      }
      if (!formData.address.city.trim()) {
        newErrors['address.city'] = 'City is required';
      }
      if (!formData.address.state.trim()) {
        newErrors['address.state'] = 'State is required';
      }
      if (!formData.address.postcode.trim()) {
        newErrors['address.postcode'] = 'Postcode is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next step
  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  // Handle previous step
  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep(2)) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      let logoUrl = null;
      let logoPath = null;

      // Upload logo to Firebase Storage
      if (logoFile) {
        const logoFileName = `company-logos/${user.emailAddresses?.[0]?.emailAddress}/${Date.now()}_${logoFile.name}`;
        const logoRef = ref(storage, logoFileName);
        
        await uploadBytes(logoRef, logoFile);
        logoUrl = await getDownloadURL(logoRef);
        logoPath = logoFileName;
      }

      const userEmail = user.emailAddresses?.[0]?.emailAddress;

      // Save company data to Firebase Firestore
      const companyData = {
        userId: user.id,
        userEmail: userEmail,
        companyName: formData.companyName.trim(),
        abn: formData.abn.replace(/\s/g, ''), // Clean ABN (remove spaces)
        website: formData.website.trim(),
        phone: formData.phone.trim(),
        contactPerson: formData.contactPerson.trim(),
        email: formData.email.trim(),
        address: {
          street: formData.address.street.trim(),
          city: formData.address.city.trim(),
          state: formData.address.state.trim(),
          postcode: formData.address.postcode.trim(),
          country: formData.address.country,
          fullAddress: `${formData.address.street.trim()}, ${formData.address.city.trim()} ${formData.address.state.trim()} ${formData.address.postcode.trim()}`
        },
        logoUrl,
        logoPath,
        registrationDate: new Date(),
        isVerified: true,
        status: 'approved',
        // Make the registering user the super admin
        authorizedUsers: [userEmail],
        superAdmin: userEmail,
        admins: [userEmail],
        createdBy: userEmail
      };

      const docRef = await addDoc(collection(db, 'companies'), companyData);
      console.log('Company registered with ID:', docRef.id);

      // Call completion callback with the new company data
      onRegistrationComplete({
        id: docRef.id,
        ...companyData
      });

    } catch (error) {
      console.error('Error registering company:', error);
      setErrors({
        submit: 'Registration failed. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  // Show access request submitted screen
  if (requestSubmitted) {
    return (
      <div className="space-y-8 min-h-screen overflow-y-auto flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-br from-white/80 via-white/60 to-white/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 w-full max-w-2xl p-8"
        >
          <div className="text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Mail className="w-10 h-10 text-green-600" />
            </div>
            
            {/* Title */}
            <h1 className="text-3xl font-light text-slate-800 mb-4">
              Access Request <span className="text-green-600 font-medium">Submitted</span>
            </h1>
            
            {/* Description */}
            <div className="bg-green-50/80 backdrop-blur-sm rounded-xl p-6 border border-green-200/50 mb-6">
              <h2 className="text-lg font-semibold text-green-800 mb-2">Request Sent Successfully!</h2>
              <p className="text-green-700 leading-relaxed mb-4">
                Your access request for <strong>{selectedCompany?.companyName}</strong> has been sent to the company administrator.
              </p>
              
              {/* Request Details */}
              <div className="bg-white/60 rounded-lg p-4 border border-green-200/50 text-left mb-4">
                <h3 className="font-medium text-green-800 mb-3">Request Details:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Company:</span>
                    <span className="font-medium text-green-800">{selectedCompany?.companyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">ABN:</span>
                    <span className="font-medium text-green-800">{selectedCompany?.abn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Your Email:</span>
                    <span className="font-medium text-green-800">{user?.emailAddresses?.[0]?.emailAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Status:</span>
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-medium">
                      <Clock className="w-3 h-3" />
                      Pending Review
                    </span>
                  </div>
                </div>
              </div>
              
              {/* What happens next */}
              <div className="mt-4 pt-4 border-t border-green-200/50">
                <p className="text-xs text-green-600 font-medium mb-2">What happens next:</p>
                <ul className="text-xs text-green-600 space-y-1">
                  <li>• The company administrator will review your request</li>
                  <li>• You'll receive email notification when approved</li>
                  <li>• Once approved, you can access the company dashboard</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 min-h-screen overflow-y-auto">
      {/* Elite Registration Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="pt-[50px] pb-8"
      >
        <div className="relative">
          {/* Decorative Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-teal-300/20 to-emerald-300/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-blue-300/20 to-teal-300/20 rounded-full blur-2xl"></div>
          </div>
          
          {/* Registration Welcome */}
          <div className="relative bg-gradient-to-br from-white/60 via-white/40 to-white/30 backdrop-blur-xl rounded-3xl p-4 sm:p-6 md:p-8 border border-white/40 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div className="relative flex justify-center sm:justify-start">
                <div className="w-14 h-14 bg-gradient-to-br from-teal-700 via-teal-600 to-teal-800 rounded-xl flex items-center justify-center shadow-xl">
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full border-2 border-white"></div>
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-2xl sm:text-3xl md:text-4xl font-light mb-2"
                >
                  <span className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
                    Company{' '}
                  </span>
                  <span className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 bg-clip-text text-transparent font-medium">
                    Registration
                  </span>
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="text-slate-600/80 text-sm sm:text-lg"
                >
                  Complete your profile to unlock premium dashboard access
                </motion.p>
              </div>
            </div>
            
            {/* Progress Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-white/40"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-teal-700">
                  Step {currentStep} of 2
                </span>
                <span className="text-sm text-slate-600/80">
                  {currentStep === 1 ? 'Company Details' : 'Contact Information'}
                </span>
              </div>
              <div className="w-full bg-white/40 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: '50%' }}
                  animate={{ width: currentStep === 1 ? '50%' : '100%' }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full h-3 shadow-lg"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Main Form Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="relative pb-8"
      >
        <div className="bg-gradient-to-br from-white/70 via-white/50 to-white/40 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-white/50 "
        style={{
          filter: 'drop-shadow(0 10px 25px rgba(15, 23, 42, 0.08)) drop-shadow(0 4px 6px rgba(15, 23, 42, 0.04))'
        }}>
          
          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {/* Step 1: Company Details */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  {/* Step Header */}
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 bg-gradient-to-r from-teal-100/80 to-emerald-100/80 backdrop-blur-sm rounded-full px-6 py-3 border border-teal-200/50 mb-4">
                      <Building className="w-5 h-5 text-teal-600" />
                      <span className="text-teal-700 font-medium">Company Details</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-light text-slate-800 mb-2">
                      Tell us about your <span className="text-teal-600 font-medium">business</span>
                    </h2>
                    <p className="text-slate-600/80">This information will be used across all your orders and invoices</p>
                  </div>

                  {/* Company Name */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Building className="w-4 h-4 text-teal-600" />
                      Company Name *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                        onBlur={() => checkCompanyNameExists(formData.companyName)}
                        className={`w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-white/30 backdrop-blur-sm transition-all duration-200 ${
                          errors.companyName || (companyNameExists && matchingCompanies.length > 0)
                            ? 'border-red-300 bg-red-50/50 focus:ring-red-500' 
                            : 'focus:ring-teal-500 focus:border-teal-300 hover:border-teal-200'
                        } focus:ring-2 focus:border-transparent text-slate-800 placeholder-slate-500`}
                        placeholder="Enter your company name"
                      />
                      {isCheckingCompanyName && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Loader className="w-5 h-5 animate-spin text-teal-600" />
                        </div>
                      )}
                    </div>
                    
                    {errors.companyName && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-red-600 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm rounded-lg px-3 py-2"
                      >
                        <AlertCircle className="w-4 h-4" />
                        {errors.companyName}
                      </motion.p>
                      )}

                   {/* Company Name Already Exists Warning */}
                   {companyNameExists && matchingCompanies.length > 0 && (
                     <motion.div 
                       initial={{ opacity: 0, y: -10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 rounded-xl p-4 space-y-4"
                     >
                       <div className="flex items-start gap-3">
                         <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                           <Search className="w-4 h-4 text-blue-600" />
                         </div>
                         <div className="flex-1">
                           <h4 className="font-medium text-blue-800 mb-1">Similar Company Names Found</h4>
                           <p className="text-sm text-blue-700 mb-3">
                             We found {matchingCompanies.length} compan{matchingCompanies.length === 1 ? 'y' : 'ies'} with similar names. 
                             If your company is already registered, please request access instead.
                           </p>
                           
                           <div className="space-y-2 max-h-40 overflow-y-auto">
                             {matchingCompanies.slice(0, 3).map((company, index) => (
                               <div key={company.id} className="bg-white/60 rounded-lg p-3 border border-blue-200/30">
                                 <div className="flex items-start justify-between gap-3">
                                   <div className="flex-1">
                                     <h5 className="font-medium text-blue-900 text-sm">{company.companyName}</h5>
                                     <p className="text-xs text-blue-600">ABN: {company.abn}</p>
                                     {company.address?.city && company.address?.state && (
                                       <p className="text-xs text-blue-600">{company.address.city}, {company.address.state}</p>
                                     )}
                                   </div>
                                   <button
                                     type="button"
                                     onClick={() => handleCompanySelection(company)}
                                     className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-1 text-xs font-medium"
                                   >
                                     <Mail className="w-3 h-3" />
                                     Request Access
                                   </button>
                                 </div>
                               </div>
                             ))}
                           </div>
                           
                           {matchingCompanies.length > 3 && (
                             <p className="text-xs text-blue-600 mt-2">
                               + {matchingCompanies.length - 3} more similar companies found
                             </p>
                           )}

                           {!showAccessRequest && (
                             <div className="mt-3 pt-3 border-t border-blue-200/50">
                               <p className="text-xs text-blue-600 mb-2">
                                 If none of these match your company, you can continue with registration.
                               </p>
                               <button
                                 type="button"
                                 onClick={() => {
                                   setCompanyNameExists(false);
                                   setMatchingCompanies([]);
                                 }}
                                 className="bg-white/60 backdrop-blur-sm text-blue-700 px-3 py-1 rounded-lg hover:bg-white/80 transition-all duration-200 text-xs border border-blue-200/50"
                               >
                                 Continue with "{formData.companyName}"
                               </button>
                             </div>
                           )}

                           {showAccessRequest && selectedCompany && (
                             <div className="space-y-3 mt-3 pt-3 border-t border-blue-200/50">
                               <div className="bg-white/40 rounded-lg p-3">
                                 <p className="text-sm font-medium text-blue-800 mb-1">
                                   Requesting access to: {selectedCompany.companyName}
                                 </p>
                                 <p className="text-xs text-blue-600">ABN: {selectedCompany.abn}</p>
                               </div>
                               <textarea
                                 value={accessRequestMessage}
                                 onChange={(e) => setAccessRequestMessage(e.target.value)}
                                 placeholder="Please explain why you need access to this company (e.g., your role, department, etc.)"
                                 className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white/60 backdrop-blur-sm text-slate-800 placeholder-slate-600 text-sm resize-none"
                                 rows={3}
                               />
                               <div className="flex gap-2">
                                 <button
                                   type="button"
                                   onClick={submitAccessRequest}
                                   disabled={isSubmittingRequest || !accessRequestMessage.trim()}
                                   className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                   {isSubmittingRequest ? (
                                     <Loader className="w-4 h-4 animate-spin" />
                                   ) : (
                                     <Mail className="w-4 h-4" />
                                   )}
                                   Send Request
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => {
                                     setShowAccessRequest(false);
                                     setSelectedCompany(null);
                                     setAccessRequestMessage('');
                                   }}
                                   className="bg-white/60 backdrop-blur-sm text-slate-700 px-4 py-2 rounded-lg hover:bg-white/80 transition-all duration-200 text-sm border border-white/40"
                                 >
                                   Cancel
                                 </button>
                               </div>
                             </div>
                           )}
                         </div>
                       </div>
                     </motion.div>
                   )}
                 </div>

                 {/* ABN */}
                 <div className="space-y-2">
                   <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                     <FileText className="w-4 h-4 text-teal-600" />
                    Company Australian Business Number (ABN) *
                   </label>
                   <div className="relative">
                     <input
                       type="text"
                       value={formData.abn}
                       onChange={(e) => {
                         handleInputChange('abn', e.target.value);
                         // Reset ABN check states when user types
                         if (abnExists) {
                           setAbnExists(false);
                           setExistingCompany(null);
                           setShowAccessRequest(false);
                           setRequestSubmitted(false);
                         }
                       }}
                       onBlur={() => checkABNExists(formData.abn)}
                       className={`w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-white/30 backdrop-blur-sm transition-all duration-200 ${
                         errors.abn || abnExists
                           ? 'border-red-300 bg-red-50/50 focus:ring-red-500' 
                           : 'focus:ring-teal-500 focus:border-teal-300 hover:border-teal-200'
                       } focus:ring-2 focus:border-transparent text-slate-800 placeholder-slate-500`}
                       placeholder="XX XXX XXX XXX"
                       maxLength={14}
                     />
                     {isCheckingABN && (
                       <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                         <Loader className="w-5 h-5 animate-spin text-teal-600" />
                       </div>
                     )}
                   </div>
                   
                   {/* ABN Error Message */}
                   {errors.abn && (
                     <motion.p 
                       initial={{ opacity: 0, y: -10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="text-sm text-red-600 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm rounded-lg px-3 py-2"
                     >
                       <AlertCircle className="w-4 h-4" />
                       {errors.abn}
                     </motion.p>
                   )}

                   {/* ABN Already Exists Warning */}
                   {abnExists && existingCompany && (
                     <motion.div 
                       initial={{ opacity: 0, y: -10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 rounded-xl p-4 space-y-4"
                     >
                       <div className="flex items-start gap-3">
                         <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                           <AlertCircle className="w-4 h-4 text-amber-600" />
                         </div>
                         <div className="flex-1">
                           <h4 className="font-medium text-amber-800 mb-1">ABN Already Registered</h4>
                           <p className="text-sm text-amber-700 mb-3">
                             This ABN is already registered to <strong>{existingCompany.companyName}</strong>. 
                             If you work for this company, you must request access to proceed.
                           </p>
                           
                           {!showAccessRequest && !requestSubmitted && (
                             <button
                               type="button"
                               onClick={() => {
                                 setSelectedCompany(existingCompany);
                                 setShowAccessRequest(true);
                               }}
                               className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all duration-200 flex items-center gap-2 text-sm font-medium"
                             >
                               <Mail className="w-4 h-4" />
                               Request Access
                             </button>
                           )}

                           {showAccessRequest && selectedCompany && !requestSubmitted && (
                             <div className="space-y-3 mt-3">
                               <textarea
                                 value={accessRequestMessage}
                                 onChange={(e) => setAccessRequestMessage(e.target.value)}
                                 placeholder="Please explain why you need access to this company (e.g., your role, department, etc.)"
                                 className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white/60 backdrop-blur-sm text-slate-800 placeholder-slate-600 text-sm resize-none"
                                 rows={3}
                               />
                               <div className="flex gap-2">
                                 <button
                                   type="button"
                                   onClick={submitAccessRequest}
                                   disabled={isSubmittingRequest || !accessRequestMessage.trim()}
                                   className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all duration-200 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                   {isSubmittingRequest ? (
                                     <Loader className="w-4 h-4 animate-spin" />
                                   ) : (
                                     <Mail className="w-4 h-4" />
                                   )}
                                   Send Request
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => {
                                     setShowAccessRequest(false);
                                     setSelectedCompany(null);
                                     setAccessRequestMessage('');
                                   }}
                                   className="bg-white/60 backdrop-blur-sm text-slate-700 px-4 py-2 rounded-lg hover:bg-white/80 transition-all duration-200 text-sm border border-white/40"
                                 >
                                   Cancel
                                 </button>
                               </div>
                             </div>
                           )}
                         </div>
                       </div>
                     </motion.div>
                   )}
                 </div>

                 {/* Rest of the form continues with Website, Logo Upload, and other steps... */}
                 {/* Website */}
                 <div className="space-y-2">
                   <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                     <Sparkles className="w-4 h-4 text-teal-600" />
                     Company Website
                   </label>
                   <input
                     type="url"
                     value={formData.website}
                     onChange={(e) => handleInputChange('website', e.target.value)}
                     className="w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-white/30 backdrop-blur-sm transition-all duration-200 focus:ring-teal-500 focus:border-teal-300 hover:border-teal-200 focus:ring-2 focus:border-transparent text-slate-800 placeholder-slate-500"
                     placeholder="https://www.yourcompany.com.au"
                   />
                 </div>

                 {/* Logo Upload */}
                 <div className="space-y-2">
                   <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                     <Star className="w-4 h-4 text-teal-600" />
                     Company Logo *
                   </label>
                   <div className={`relative border-2 border-dashed border-white/50 bg-white/30 backdrop-blur-sm rounded-xl transition-all duration-200 ${
                     errors.logo 
                       ? 'border-red-300 bg-red-50/50' 
                       : 'hover:border-teal-300 hover:bg-white/40'
                   } p-6 text-center cursor-pointer group`}>
                     {logoPreview ? (
                       <div className="space-y-4">
                         <div className="relative inline-block">
                           <img
                             src={logoPreview}
                             alt="Logo preview"
                             className="mx-auto h-20 w-20 object-contain rounded-xl border border-white/30 shadow-lg"
                           />
                           <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full border-2 border-white flex items-center justify-center">
                             <CheckCircle className="w-3 h-3 text-white" />
                           </div>
                         </div>
                         <div>
                           <p className="text-sm text-slate-600 mb-2 font-medium">{logoFile?.name}</p>
                           <button
                             type="button"
                             onClick={() => {
                               setLogoFile(null);
                               setLogoPreview(null);
                             }}
                             className="text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
                           >
                             Change logo
                           </button>
                         </div>
                       </div>
                     ) : (
                       <div className="group-hover:scale-105 transition-transform duration-200">
                         <Upload className="mx-auto h-12 w-12 text-teal-400/80 mb-4 group-hover:text-teal-500 transition-colors" />
                         <div className="space-y-2">
                           <p className="text-slate-700 font-medium">Upload your company logo</p>
                           <p className="text-sm text-slate-500">PNG, JPG, or SVG up to 5MB</p>
                         </div>
                       </div>
                     )}
                     <input
                       type="file"
                       onChange={handleLogoUpload}
                       accept="image/*"
                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                     />
                   </div>
                   {errors.logo && (
                     <motion.p 
                       initial={{ opacity: 0, y: -10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="text-sm text-red-600 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm rounded-lg px-3 py-2"
                     >
                       <AlertCircle className="w-4 h-4" />
                       {errors.logo}
                     </motion.p>
                   )}
                 </div>

                 {/* Next Button */}
                 <div className="flex justify-end pt-6">
                   <button
                     type="button"
                     onClick={handleNextStep}
                     disabled={abnExists || (companyNameExists && showAccessRequest)}
                     className={`px-8 py-3 sm:py-4 rounded-xl transition-all duration-200 flex items-center gap-3 shadow-lg hover:shadow-xl border font-medium ${
                       abnExists || (companyNameExists && showAccessRequest)
                         ? 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300'
                         : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 border-teal-500/30'
                     }`}
                   >
                     {abnExists || (companyNameExists && showAccessRequest) ? 'Request Access to Continue' : 'Next Step'}
                     <ArrowRight className="w-5 h-5" />
                   </button>
                 </div>
               </motion.div>
             )}

             {/* Step 2: Contact Information */}
             {currentStep === 2 && (
               <motion.div
                 key="step2"
                 variants={stepVariants}
                 initial="hidden"
                 animate="visible"
                 exit="exit"
                 transition={{ duration: 0.4 }}
                 className="space-y-6"
               >
                 {/* Step Header */}
                 <div className="text-center mb-8">
                   <div className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-100/80 to-teal-100/80 backdrop-blur-sm rounded-full px-6 py-3 border border-emerald-200/50 mb-4">
                     <User className="w-5 h-5 text-emerald-600" />
                     <span className="text-emerald-700 font-medium">Contact Information</span>
                   </div>
                   <h2 className="text-2xl sm:text-3xl font-light text-slate-800 mb-2">
                     How can we <span className="text-emerald-600 font-medium">reach you?</span>
                   </h2>
                   <p className="text-slate-600/80">This contact information will be used for order communications</p>
                 </div>

                 {/* Contact Person */}
                 <div className="space-y-2">
                   <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                     <User className="w-4 h-4 text-emerald-600" />
                     Full Name *
                   </label>
                   <input
                     type="text"
                     value={formData.contactPerson}
                     onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                     className={`w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-white/30 backdrop-blur-sm transition-all duration-200 ${
                       errors.contactPerson 
                         ? 'border-red-300 bg-red-50/50 focus:ring-red-500' 
                         : 'focus:ring-emerald-500 focus:border-emerald-300 hover:border-emerald-200'
                     } focus:ring-2 focus:border-transparent text-slate-800 placeholder-slate-500`}
                     placeholder="Full name of contact person"
                   />
                   {errors.contactPerson && (
                     <motion.p 
                       initial={{ opacity: 0, y: -10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="text-sm text-red-600 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm rounded-lg px-3 py-2"
                     >
                       <AlertCircle className="w-4 h-4" />
                       {errors.contactPerson}
                     </motion.p>
                   )}
                 </div>

                 {/* Phone */}
                 <div className="space-y-2">
                   <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                     <Phone className="w-4 h-4 text-emerald-600" />
                     Phone Number *
                   </label>
                   <input
                     type="tel"
                     value={formData.phone}
                     onChange={(e) => handleInputChange('phone', e.target.value)}
                     className={`w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-white/30 backdrop-blur-sm transition-all duration-200 ${
                       errors.phone 
                         ? 'border-red-300 bg-red-50/50 focus:ring-red-500' 
                         : 'focus:ring-emerald-500 focus:border-emerald-300 hover:border-emerald-200'
                     } focus:ring-2 focus:border-transparent text-slate-800 placeholder-slate-500`}
                     placeholder="+61 X XXXX XXXX or 0X XXXX XXXX"
                   />
                   {errors.phone && (
                     <motion.p 
                       initial={{ opacity: 0, y: -10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="text-sm text-red-600 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm rounded-lg px-3 py-2"
                     >
                       <AlertCircle className="w-4 h-4" />
                       {errors.phone}
                     </motion.p>
                   )}
                 </div>

                 {/* Email (readonly) */}
                 <div className="space-y-2">
                   <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                     <Mail className="w-4 h-4 text-emerald-600" />
                     Email Address
                   </label>
                   <input
                     type="email"
                     value={formData.email}
                     readOnly
                     className="w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-slate-50/50 backdrop-blur-sm text-slate-600 cursor-not-allowed"
                   />
                 </div>

                 {/* Address Section */}
                 <div className="space-y-4">
                   <label className="block text-sm font-medium text-slate-700 flex items-center gap-2 mb-4">
                     <MapPin className="w-4 h-4 text-emerald-600" />
                     Business Address
                   </label>
                   
                   <div className="grid grid-cols-1 gap-4">
                     {/* Street Address */}
                     <div className="space-y-2">
                       <input
                         type="text"
                         value={formData.address.street}
                         onChange={(e) => handleInputChange('address.street', e.target.value)}
                         className={`w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-white/30 backdrop-blur-sm transition-all duration-200 ${
                           errors['address.street'] 
                             ? 'border-red-300 bg-red-50/50 focus:ring-red-500' 
                             : 'focus:ring-emerald-500 focus:border-emerald-300 hover:border-emerald-200'
                         } focus:ring-2 focus:border-transparent text-slate-800 placeholder-slate-500`}
                         placeholder="Street address *"
                       />
                       {errors['address.street'] && (
                         <motion.p 
                           initial={{ opacity: 0, y: -10 }}
                           animate={{ opacity: 1, y: 0 }}
                           className="text-sm text-red-600 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm rounded-lg px-3 py-2"
                         >
                           <AlertCircle className="w-4 h-4" />
                           {errors['address.street']}
                         </motion.p>
                       )}
                     </div>

                     {/* City and State */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <input
                           type="text"
                           value={formData.address.city}
                           onChange={(e) => handleInputChange('address.city', e.target.value)}
                           className={`w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-white/30 backdrop-blur-sm transition-all duration-200 ${
                             errors['address.city'] 
                               ? 'border-red-300 bg-red-50/50 focus:ring-red-500' 
                               : 'focus:ring-emerald-500 focus:border-emerald-300 hover:border-emerald-200'
                           } focus:ring-2 focus:border-transparent text-slate-800 placeholder-slate-500`}
                           placeholder="City *"
                         />
                         {errors['address.city'] && (
                           <motion.p 
                             initial={{ opacity: 0, y: -10 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="text-sm text-red-600 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm rounded-lg px-3 py-2"
                           >
                             <AlertCircle className="w-4 h-4" />
                             {errors['address.city']}
                           </motion.p>
                         )}
                       </div>

                       <div className="space-y-2">
                         <select
                           value={formData.address.state}
                           onChange={(e) => handleInputChange('address.state', e.target.value)}
                           className={`w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-white/30 backdrop-blur-sm transition-all duration-200 ${
                             errors['address.state'] 
                               ? 'border-red-300 bg-red-50/50 focus:ring-red-500' 
                               : 'focus:ring-emerald-500 focus:border-emerald-300 hover:border-emerald-200'
                           } focus:ring-2 focus:border-transparent text-slate-800`}
                         >
                           <option value="">Select state *</option>
                           <option value="NSW">New South Wales</option>
                           <option value="VIC">Victoria</option>
                           <option value="QLD">Queensland</option>
                           <option value="WA">Western Australia</option>
                           <option value="SA">South Australia</option>
                           <option value="TAS">Tasmania</option>
                           <option value="ACT">Australian Capital Territory</option>
                           <option value="NT">Northern Territory</option>
                         </select>
                         {errors['address.state'] && (
                           <motion.p 
                             initial={{ opacity: 0, y: -10 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="text-sm text-red-600 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm rounded-lg px-3 py-2"
                           >
                             <AlertCircle className="w-4 h-4" />
                             {errors['address.state']}
                           </motion.p>
                         )}
                       </div>
                     </div>

                     {/* Postcode and Country */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <input
                           type="text"
                           value={formData.address.postcode}
                           onChange={(e) => handleInputChange('address.postcode', e.target.value)}
                           className={`w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-white/30 backdrop-blur-sm transition-all duration-200 ${
                             errors['address.postcode'] 
                               ? 'border-red-300 bg-red-50/50 focus:ring-red-500' 
                               : 'focus:ring-emerald-500 focus:border-emerald-300 hover:border-emerald-200'
                           } focus:ring-2 focus:border-transparent text-slate-800 placeholder-slate-500`}
                           placeholder="Postcode *"
                           maxLength={4}
                         />
                         {errors['address.postcode'] && (
                           <motion.p 
                             initial={{ opacity: 0, y: -10 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="text-sm text-red-600 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm rounded-lg px-3 py-2"
                           >
                             <AlertCircle className="w-4 h-4" />
                             {errors['address.postcode']}
                           </motion.p>
                         )}
                       </div>

                       <div className="space-y-2">
                         <input
                           type="text"
                           value={formData.address.country}
                           readOnly
                           className="w-full px-4 py-3 sm:py-4 rounded-xl border border-white/50 bg-slate-50/50 backdrop-blur-sm text-slate-600 cursor-not-allowed"
                           placeholder="Country"
                         />
                       </div>
                     </div>
                   </div>
                 </div>

                 {/* Submit Error */}
                 {errors.submit && (
                   <motion.div 
                     initial={{ opacity: 0, y: -10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl p-4"
                   >
                     <p className="text-red-600 flex items-center gap-2 font-medium">
                       <XCircle className="w-5 h-5" />
                       {errors.submit}
                     </p>
                   </motion.div>
                 )}

                 {/* Action Buttons */}
                 <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6">
                   <button
                     type="button"
                     onClick={handlePrevStep}
                     className="bg-white/60 backdrop-blur-sm text-slate-700 px-8 py-3 sm:py-4 rounded-xl hover:bg-white/80 transition-all duration-200 flex items-center justify-center gap-3 border border-white/40 shadow-lg hover:shadow-xl font-medium"
                   >
                     <ArrowLeft className="w-5 h-5" />
                     Previous
                   </button>
                   <button
                     type="submit"
                     disabled={isSubmitting}
                     className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3 sm:py-4 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl border border-emerald-500/30 font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-emerald-600 disabled:hover:to-teal-600"
                   >
                     {isSubmitting ? (
                       <>
                         <Loader className="w-5 h-5 animate-spin" />
                         Registering...
                       </>
                     ) : (
                       <>
                         Complete Registration
                         <Crown className="w-5 h-5" />
                       </>
                     )}
                   </button>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
         </form>
       </div>
     </motion.div>
   </div>
 );
}

export default CompanyRegistration;