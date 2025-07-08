'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  Upload, 
  Crown, 
  CheckCircle, 
  XCircle, 
  Loader, 
  AlertCircle,
  Globe,
  Save,
  RefreshCw,
  Star,
  Shield,
  Edit,
  Trash2,
  Search,
  Plus,
  Eye,
  UserPlus,
  Users,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { collection, addDoc, query, getDocs, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase';

const BossCompanyManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  
  const [formData, setFormData] = useState({
    companyName: '',
    abn: '',
    website: '',
    phone: '',
    contactPerson: '',
    email: '',
    userEmail: '',
    userId: '',
    createdBy: '',
    superAdmin: '',
    admins: [],
    authorizedUsers: [],
    address: {
      street: '',
      city: '',
      state: '',
      postcode: '',
      country: 'Australia'
    }
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isCheckingABN, setIsCheckingABN] = useState(false);
  const [abnExists, setAbnExists] = useState(false);

  // User management states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('authorizedUsers');

  // Fetch companies on component mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  // Filter companies based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCompanies(companies);
    } else {
      const filtered = companies.filter(company =>
        company.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.abn?.includes(searchTerm) ||
        company.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCompanies(filtered);
    }
  }, [companies, searchTerm]);

  // Fetch all companies
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const companiesQuery = query(collection(db, 'companies'));
      const companiesSnapshot = await getDocs(companiesQuery);
      
      const companiesData = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        registrationDate: doc.data().registrationDate?.toDate ? 
          doc.data().registrationDate.toDate() : 
          new Date(doc.data().registrationDate)
      }));
      
      setCompanies(companiesData);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
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

  // Email validation
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Check if ABN already exists (excluding current editing company)
  const checkABNExists = async (abn) => {
    if (!abn.trim()) return;
    
    const cleanABN = abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(cleanABN)) return;

    try {
      setIsCheckingABN(true);
      
      const companiesRef = collection(db, 'companies');
      const q = query(companiesRef, where('abn', '==', cleanABN));
      const querySnapshot = await getDocs(q);
      
      // Check if ABN exists and it's not the current editing company
      const existingCompany = querySnapshot.docs.find(doc => 
        editingCompany ? doc.id !== editingCompany.id : true
      );
      
      setAbnExists(!!existingCompany);
    } catch (error) {
      console.error('Error checking ABN:', error);
    } finally {
      setIsCheckingABN(false);
    }
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

  // Add user to company with proper role hierarchy
  const addUserToCompany = () => {
    if (!newUserEmail.trim() || !validateEmail(newUserEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    // Check if user already exists
    if (formData.authorizedUsers.includes(newUserEmail)) {
      alert('User already exists in this company');
      return;
    }

    let updatedFormData = { ...formData };

    // Apply role hierarchy
    if (newUserRole === 'superAdmin') {
      // SuperAdmin is also admin and authorized user
      updatedFormData.superAdmin = newUserEmail;
      updatedFormData.admins = [...formData.admins.filter(email => email !== newUserEmail), newUserEmail];
      updatedFormData.authorizedUsers = [...formData.authorizedUsers.filter(email => email !== newUserEmail), newUserEmail];
    } else if (newUserRole === 'admin') {
      // Admin is also authorized user
      updatedFormData.admins = [...formData.admins.filter(email => email !== newUserEmail), newUserEmail];
      updatedFormData.authorizedUsers = [...formData.authorizedUsers.filter(email => email !== newUserEmail), newUserEmail];
    } else if (newUserRole === 'authorizedUsers') {
      // Just authorized user
      updatedFormData.authorizedUsers = [...formData.authorizedUsers.filter(email => email !== newUserEmail), newUserEmail];
    }

    setFormData(updatedFormData);
    setNewUserEmail('');
    setNewUserRole('authorizedUsers');
  };

  // Remove user from company
  const removeUserFromCompany = (userEmail) => {
    let updatedFormData = { ...formData };

    // Remove from all arrays
    updatedFormData.admins = formData.admins.filter(email => email !== userEmail);
    updatedFormData.authorizedUsers = formData.authorizedUsers.filter(email => email !== userEmail);
    
    // If removing super admin, clear the field
    if (formData.superAdmin === userEmail) {
      updatedFormData.superAdmin = '';
    }

    setFormData(updatedFormData);
  };

  // Get user role in company
  const getUserRole = (userEmail) => {
    if (formData.superAdmin === userEmail) return 'Super Admin';
    if (formData.admins.includes(userEmail)) return 'Admin';
    if (formData.authorizedUsers.includes(userEmail)) return 'Authorized User';
    return 'Unknown';
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }
    
    if (!formData.abn.trim()) {
      newErrors.abn = 'ABN is required';
    } else if (!validateABN(formData.abn)) {
      newErrors.abn = 'Please enter a valid ABN';
    } else if (abnExists) {
      newErrors.abn = 'This ABN is already registered by another company';
    }
    
    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = 'Contact person is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid Australian phone number';
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

    // Logo validation only for new companies
    if (!editingCompany && !logoFile) {
      newErrors.logo = 'Company logo is required';
    }

    // At least one user must be in authorizedUsers
    if (formData.authorizedUsers.length === 0) {
      newErrors.users = 'At least one authorized user is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      companyName: '',
      abn: '',
      website: '',
      phone: '',
      contactPerson: '',
      email: '',
      userEmail: '',
      userId: '',
      createdBy: '',
      superAdmin: '',
      admins: [],
      authorizedUsers: [],
      address: {
        street: '',
        city: '',
        state: '',
        postcode: '',
        country: 'Australia'
      }
    });
    setLogoFile(null);
    setLogoPreview(null);
    setErrors({});
    setEditingCompany(null);
    setAbnExists(false);
    setNewUserEmail('');
    setNewUserRole('authorizedUsers');
  };

  // Handle new company button
  const handleNewCompany = () => {
    resetForm();
    setShowForm(true);
  };

  // Handle edit company
  const handleEditCompany = (company) => {
    setFormData({
      companyName: company.companyName || '',
      abn: company.abn || '',
      website: company.website || '',
      phone: company.phone || '',
      contactPerson: company.contactPerson || '',
      email: company.email || '',
      userEmail: company.userEmail || '',
      userId: company.userId || '',
      createdBy: company.createdBy || '',
      superAdmin: company.superAdmin || '',
      admins: company.admins || [],
      authorizedUsers: company.authorizedUsers || [],
      address: {
        street: company.address?.street || '',
        city: company.address?.city || '',
        state: company.address?.state || '',
        postcode: company.address?.postcode || '',
        country: company.address?.country || 'Australia'
      }
    });
    
    setLogoPreview(company.logoUrl || null);
    setEditingCompany(company);
    setShowForm(true);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      let logoUrl = editingCompany?.logoUrl || null;
      let logoPath = editingCompany?.logoPath || null;

      // Upload new logo if provided
      if (logoFile) {
        // Delete old logo if editing
        if (editingCompany?.logoPath) {
          try {
            const oldLogoRef = ref(storage, editingCompany.logoPath);
            await deleteObject(oldLogoRef);
          } catch (error) {
            console.log('Old logo not found or already deleted');
          }
        }

        // Upload new logo
        const logoFileName = `company-logos/${formData.email}/${Date.now()}_${logoFile.name}`;
        const logoRef = ref(storage, logoFileName);
        
        await uploadBytes(logoRef, logoFile);
        logoUrl = await getDownloadURL(logoRef);
        logoPath = logoFileName;
      }

      // Prepare company data according to Firebase structure
      const companyData = {
        companyName: formData.companyName.trim(),
        abn: formData.abn.replace(/\s/g, ''),
        website: formData.website.trim(),
        phone: formData.phone.trim(),
        contactPerson: formData.contactPerson.trim(),
        email: formData.email.trim(),
        userEmail: formData.userEmail.trim() || formData.email.trim(),
        userId: formData.userId.trim(),
        createdBy: formData.createdBy.trim() || formData.email.trim(),
        superAdmin: formData.superAdmin || formData.email.trim(),
        admins: formData.admins.length > 0 ? formData.admins : [formData.email.trim()],
        authorizedUsers: formData.authorizedUsers.length > 0 ? formData.authorizedUsers : [formData.email.trim()],
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
        isVerified: true,
        status: 'approved',
        updatedAt: new Date()
      };

      if (editingCompany) {
        // Update existing company
        const companyRef = doc(db, 'companies', editingCompany.id);
        await updateDoc(companyRef, companyData);
        console.log('Company updated successfully');
      } else {
        // Create new company
        companyData.registrationDate = new Date();
        
        await addDoc(collection(db, 'companies'), companyData);
        console.log('Company registered successfully');
      }

      // Refresh companies list and close form
      await fetchCompanies();
      setShowForm(false);
      resetForm();

    } catch (error) {
      console.error('Error saving company:', error);
      setErrors({
        submit: 'Failed to save company. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete company
  const handleDeleteCompany = async (company) => {
    if (!window.confirm(`Are you sure you want to delete ${company.companyName}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete logo from storage if exists
      if (company.logoPath) {
        try {
          const logoRef = ref(storage, company.logoPath);
          await deleteObject(logoRef);
        } catch (error) {
          console.log('Logo file not found or already deleted');
        }
      }

      // Delete company document
      await deleteDoc(doc(db, 'companies', company.id));
      
      // Refresh companies list
      await fetchCompanies();
      
      console.log('Company deleted successfully');
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Failed to delete company. Please try again.');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader className="w-12 h-12 text-teal-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading companies...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Company Management</h1>
              <p className="text-gray-600 text-sm sm:text-base">Manage company registrations and business information</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchCompanies}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={handleNewCompany}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Company
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Companies</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{companies.length}</p>
                </div>
                <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Verified</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {companies.filter(c => c.isVerified).length}
                  </p>
                </div>
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Approved</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {companies.filter(c => c.status === 'approved').length}
                  </p>
                </div>
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-teal-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">With Logo</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {companies.filter(c => c.logoUrl).length}
                  </p>
                </div>
                <Star className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search companies by name, ABN, email, or contact person..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Showing {filteredCompanies.length} of {companies.length} companies
          </p>
        </div>

        {/* Form Dropdown */}
        {showForm && (
          <div className="bg-white rounded-lg border shadow-lg mb-6 overflow-hidden transition-all duration-300 ease-in-out animate-in slide-in-from-top-2">
            <div className="bg-gradient-to-r from-teal-50 to-blue-50 border-b border-teal-100 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Crown className="w-6 h-6 text-teal-600" />
                  {editingCompany ? 'Edit Company' : 'Register New Company'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-teal-100 rounded-lg transition-colors"
                  title="Close form"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {editingCompany ? 'Update company information and settings' : 'Fill in all required fields to register a new company'}
              </p>
            </div>

            <div className="p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Company Information */}
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-teal-600" />
                    Company Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Company Name */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                          errors.companyName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="Enter company name"
                      />
                      {errors.companyName && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.companyName}
                        </p>
                      )}
                    </div>

                    {/* ABN */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Australian Business Number (ABN) *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.abn}
                          onChange={(e) => {
                            handleInputChange('abn', e.target.value);
                            if (abnExists) {
                              setAbnExists(false);
                            }
                          }}
                          onBlur={() => checkABNExists(formData.abn)}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                            errors.abn || abnExists ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="XX XXX XXX XXX"
                          maxLength={14}
                        />
                        {isCheckingABN && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Loader className="w-4 h-4 animate-spin text-teal-600" />
                          </div>
                        )}
                      </div>
                      {(errors.abn || abnExists) && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.abn || 'This ABN is already registered by another company'}
                        </p>
                      )}
                    </div>

                    {/* Website */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Website
                      </label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => handleInputChange('website', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        placeholder="https://www.company.com.au"
                      />
                    </div>
                  </div>

                  {/* Logo Upload */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Logo {!editingCompany && '*'}
                    </label>
                    <div className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 ${
                      errors.logo ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
                   }`}>
                     {logoPreview ? (
                       <div className="space-y-4">
                         <img
                           src={logoPreview}
                           alt="Logo preview"
                           className="mx-auto h-20 w-20 object-contain rounded-lg"
                         />
                         <div>
                           <p className="text-sm text-gray-600 mb-2">{logoFile?.name}</p>
                           <button
                             type="button"
                             onClick={() => {
                               setLogoFile(null);
                               setLogoPreview(null);
                             }}
                             className="text-sm text-teal-600 hover:text-teal-700 transition-colors"
                           >
                             Change logo
                           </button>
                         </div>
                       </div>
                     ) : (
                       <div>
                         <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                         <div className="space-y-2">
                           <p className="text-gray-700">Upload company logo</p>
                           <p className="text-sm text-gray-500">PNG, JPG, or SVG up to 5MB</p>
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
                     <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                       <AlertCircle className="w-4 h-4" />
                       {errors.logo}
                     </p>
                   )}
                 </div>
               </div>

               {/* Contact Information */}
               <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                   <User className="w-5 h-5 text-teal-600" />
                   Contact Information
                 </h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {/* Contact Person */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Contact Person *
                     </label>
                     <input
                       type="text"
                       value={formData.contactPerson}
                       onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                       className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                         errors.contactPerson ? 'border-red-300 bg-red-50' : 'border-gray-300'
                       }`}
                       placeholder="Full name"
                     />
                     {errors.contactPerson && (
                       <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                         <AlertCircle className="w-4 h-4" />
                         {errors.contactPerson}
                       </p>
                     )}
                   </div>

                   {/* Email */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Email Address *
                     </label>
                     <input
                       type="email"
                       value={formData.email}
                       onChange={(e) => handleInputChange('email', e.target.value)}
                       className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                         errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                       }`}
                       placeholder="company@example.com"
                     />
                     {errors.email && (
                       <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                         <AlertCircle className="w-4 h-4" />
                         {errors.email}
                       </p>
                     )}
                   </div>

                   {/* Phone */}
                   <div className="md:col-span-2">
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Phone Number *
                     </label>
                     <input
                       type="tel"
                       value={formData.phone}
                       onChange={(e) => handleInputChange('phone', e.target.value)}
                       className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                         errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                       }`}
                       placeholder="+61 X XXXX XXXX or 0X XXXX XXXX"
                     />
                     {errors.phone && (
                       <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                         <AlertCircle className="w-4 h-4" />
                         {errors.phone}
                       </p>
                     )}
                   </div>
                 </div>
               </div>

               {/* Address Information */}
               <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                   <MapPin className="w-5 h-5 text-teal-600" />
                   Business Address
                 </h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {/* Street Address */}
                   <div className="md:col-span-2">
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Street Address *
                     </label>
                     <input
                       type="text"
                       value={formData.address.street}
                       onChange={(e) => handleInputChange('address.street', e.target.value)}
                       className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                         errors['address.street'] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                       }`}
                       placeholder="Street address"
                     />
                     {errors['address.street'] && (
                       <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                         <AlertCircle className="w-4 h-4" />
                         {errors['address.street']}
                       </p>
                     )}
                   </div>

                   {/* City */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       City *
                     </label>
                     <input
                       type="text"
                       value={formData.address.city}
                       onChange={(e) => handleInputChange('address.city', e.target.value)}
                       className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                         errors['address.city'] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                       }`}
                       placeholder="City"
                     />
                     {errors['address.city'] && (
                       <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                         <AlertCircle className="w-4 h-4" />
                         {errors['address.city']}
                       </p>
                     )}
                   </div>

                   {/* State */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       State *
                     </label>
                     <select
                       value={formData.address.state}
                       onChange={(e) => handleInputChange('address.state', e.target.value)}
                       className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                         errors['address.state'] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                       }`}
                     >
                       <option value="">Select state</option>
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
                       <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                         <AlertCircle className="w-4 h-4" />
                         {errors['address.state']}
                       </p>
                     )}
                   </div>

                   {/* Postcode */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Postcode *
                     </label>
                     <input
                       type="text"
                       value={formData.address.postcode}
                       onChange={(e) => handleInputChange('address.postcode', e.target.value)}
                       className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                         errors['address.postcode'] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                       }`}
                       placeholder="Postcode"
                       maxLength={4}
                     />
                     {errors['address.postcode'] && (
                       <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                         <AlertCircle className="w-4 h-4" />
                         {errors['address.postcode']}
                       </p>
                     )}
                   </div>

                   {/* Country (readonly) */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Country
                     </label>
                     <input
                       type="text"
                       value={formData.address.country}
                       readOnly
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                     />
                   </div>
                 </div>
               </div>

               {/* User Management */}
               <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                   <Users className="w-5 h-5 text-teal-600" />
                   User Management
                 </h3>
                 
                 {/* Add User Section */}
                 <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                   <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                     <UserPlus className="w-4 h-4 text-teal-600" />
                     Add User
                   </h4>
                   <div className="flex flex-col sm:flex-row gap-3">
                     <input
                       type="email"
                       value={newUserEmail}
                       onChange={(e) => setNewUserEmail(e.target.value)}
                       placeholder="Enter email address"
                       className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                     />
                     <select
                       value={newUserRole}
                       onChange={(e) => setNewUserRole(e.target.value)}
                       className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                     >
                       <option value="authorizedUsers">Authorized User</option>
                       <option value="admin">Admin</option>
                       <option value="superAdmin">Super Admin</option>
                     </select>
                     <button
                       type="button"
                       onClick={addUserToCompany}
                       className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                     >
                       <UserPlus className="w-4 h-4" />
                       Add User
                     </button>
                   </div>
                 </div>

                 {/* Current Users List */}
                 <div>
                   <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                     <Users className="w-4 h-4 text-teal-600" />
                     Current Users ({formData.authorizedUsers.length})
                   </h4>
                   <div className="space-y-2 max-h-60 overflow-y-auto">
                     {formData.authorizedUsers.length === 0 ? (
                       <div className="text-center py-8 text-gray-500">
                         <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                         <p>No users added yet</p>
                         <p className="text-sm">Add at least one authorized user above</p>
                       </div>
                     ) : (
                       formData.authorizedUsers.map((userEmail, index) => (
                         <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-gradient-to-br from-teal-100 to-blue-100 rounded-full flex items-center justify-center">
                               <User className="w-4 h-4 text-teal-600" />
                             </div>
                             <div>
                               <div className="font-medium text-gray-900">{userEmail}</div>
                               <div className="text-sm text-gray-500 flex items-center gap-1">
                                 {getUserRole(userEmail) === 'Super Admin' && <Crown className="w-3 h-3 text-yellow-500" />}
                                 {getUserRole(userEmail) === 'Admin' && <Shield className="w-3 h-3 text-blue-500" />}
                                 {getUserRole(userEmail)}
                               </div>
                             </div>
                           </div>
                           <button
                             type="button"
                             onClick={() => removeUserFromCompany(userEmail)}
                             className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                             title="Remove user"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       ))
                     )}
                   </div>
                   {errors.users && (
                     <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                       <AlertCircle className="w-4 h-4" />
                       {errors.users}
                     </p>
                   )}
                 </div>
               </div>

               {/* Submit Error */}
               {errors.submit && (
                 <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                   <p className="text-red-600 flex items-center gap-2">
                     <XCircle className="w-5 h-5" />
                     {errors.submit}
                   </p>
                 </div>
               )}

               {/* Form Actions */}
               <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-gray-200">
                 <button
                   type="button"
                   onClick={() => {
                     setShowForm(false);
                     resetForm();
                   }}
                   className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                 >
                   <X className="w-4 h-4" />
                   Cancel
                 </button>
                 <button
                   type="submit"
                   disabled={isSubmitting || abnExists}
                   className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
                 >
                   {isSubmitting ? (
                     <>
                       <Loader className="w-4 h-4 animate-spin" />
                       {editingCompany ? 'Updating...' : 'Registering...'}
                     </>
                   ) : (
                     <>
                       <Save className="w-4 h-4" />
                       {editingCompany ? 'Update Company' : 'Register Company'}
                     </>
                   )}
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}

       {/* Companies Table */}
       <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
         {filteredCompanies.length === 0 ? (
           <div className="p-8 sm:p-12 text-center">
             <Building2 className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
             <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
             <p className="text-gray-600">Try adjusting your search criteria or add a new company.</p>
           </div>
         ) : (
           <div className="overflow-x-auto">
             <table className="w-full">
               <thead className="bg-gray-50">
                 <tr>
                   <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Company
                   </th>
                   <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Contact
                   </th>
                   <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     ABN & Address
                   </th>
                   <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Users
                   </th>
                   <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Status
                   </th>
                   <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Actions
                   </th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-200">
                 {filteredCompanies.map((company) => (
                   <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                     <td className="px-6 py-4">
                       <div className="flex items-center">
                         {company.logoUrl ? (
                           <img
                             src={company.logoUrl}
                             alt={`${company.companyName} logo`}
                             className="w-10 h-10 rounded-lg object-cover mr-3"
                           />
                         ) : (
                           <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
                             <Building2 className="w-5 h-5 text-gray-400" />
                           </div>
                         )}
                         <div>
                           <div className="font-medium text-gray-900">{company.companyName}</div>
                           {company.website && (
                             <div className="text-sm text-blue-600">{company.website}</div>
                           )}
                           <div className="text-sm text-gray-500">
                             Registered: {formatDate(company.registrationDate)}
                           </div>
                         </div>
                       </div>
                     </td>

                     <td className="px-6 py-4">
                       <div>
                         <div className="font-medium text-gray-900">{company.contactPerson}</div>
                         <div className="text-sm text-gray-600">{company.email}</div>
                         <div className="text-sm text-gray-500">{company.phone}</div>
                       </div>
                     </td>

                     <td className="px-6 py-4">
                       <div>
                         <div className="font-medium text-gray-900">ABN: {company.abn}</div>
                         <div className="text-sm text-gray-600">
                           {company.address?.fullAddress || 'No address'}
                         </div>
                       </div>
                     </td>

                     <td className="px-6 py-4">
                       <div className="space-y-1">
                         <div className="text-sm">
                           <span className="font-medium">Super Admin:</span> {company.superAdmin || 'None'}
                         </div>
                         <div className="text-sm">
                           <span className="font-medium">Admins:</span> {company.admins?.length || 0}
                         </div>
                         <div className="text-sm">
                           <span className="font-medium">Authorized:</span> {company.authorizedUsers?.length || 0}
                         </div>
                       </div>
                     </td>

                     <td className="px-6 py-4">
                       <div className="space-y-2">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                           company.status === 'approved' 
                             ? 'bg-green-100 text-green-800' 
                             : 'bg-yellow-100 text-yellow-800'
                         }`}>
                           {company.status || 'pending'}
                         </span>
                         {company.isVerified && (
                           <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                             Verified
                           </span>
                         )}
                       </div>
                     </td>

                     <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                         <button
                           onClick={() => handleEditCompany(company)}
                           className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                           title="Edit Company"
                         >
                           <Edit className="w-4 h-4" />
                         </button>
                         <button
                           onClick={() => handleDeleteCompany(company)}
                           className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                           title="Delete Company"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         )}
       </div>
     </div>
   </div>
 );
};

export default BossCompanyManagement;