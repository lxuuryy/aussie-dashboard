'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, getDocs, or } from 'firebase/firestore';
import { db } from '@/firebase';
import { useUser } from '@clerk/nextjs';
import { Loader, CheckCircle, Building } from 'lucide-react';
import CompanyRegistration from './CompanyRegistration';

const RegistrationGuard = ({ children }) => {
  const { user, isLoaded } = useUser();
  const [companyData, setCompanyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Check if user has completed company registration OR is authorized in any company
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      if (!isLoaded || !user) {
        setIsLoading(false);
        return;
      }

      try {
        const userEmail = user.emailAddresses?.[0]?.emailAddress;
        if (!userEmail) {
          setNeedsRegistration(true);
          setIsLoading(false);
          return;
        }

        // First check if user owns a company (original logic)
        const ownedCompaniesQuery = query(
          collection(db, 'companies'),
          where('userEmail', '==', userEmail)
        );
        
        const ownedCompaniesSnapshot = await getDocs(ownedCompaniesQuery);
        
        if (!ownedCompaniesSnapshot.empty) {
          // User owns a company
          const companyDoc = ownedCompaniesSnapshot.docs[0];
          const company = {
            id: companyDoc.id,
            ...companyDoc.data()
          };
          
          setCompanyData(company);
          setUserRole('owner');
          setNeedsRegistration(false);
          setIsLoading(false);
          return;
        }

        // If user doesn't own a company, check if they're authorized in any company
        const authorizedCompaniesQuery = query(
          collection(db, 'companies'),
          where('authorizedUsers', 'array-contains', userEmail)
        );
        
        const authorizedCompaniesSnapshot = await getDocs(authorizedCompaniesQuery);
        
        if (!authorizedCompaniesSnapshot.empty) {
          // User is authorized in at least one company
          const companyDoc = authorizedCompaniesSnapshot.docs[0];
          const company = {
            id: companyDoc.id,
            ...companyDoc.data()
          };
          
          // Determine user role in the company
          let role = 'authorizedUser';
          if (company.superAdmin?.trim() === userEmail) {
            role = 'superAdmin';
          } else if (company.admins?.includes(userEmail)) {
            role = 'admin';
          }
          
          setCompanyData(company);
          setUserRole(role);
          setNeedsRegistration(false);
          setIsLoading(false);
          return;
        }

        // User is not found in any company - needs registration
        setNeedsRegistration(true);
        
      } catch (error) {
        console.error('Error checking registration status:', error);
        // On error, assume registration is needed
        setNeedsRegistration(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkRegistrationStatus();
  }, [user, isLoaded]);

  // Handle successful registration
  const handleRegistrationComplete = (newCompanyData) => {
    setCompanyData(newCompanyData);
    setUserRole('owner');
    setNeedsRegistration(false);
  };

  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Loader className="w-8 h-8 animate-spin text-teal-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">Loading Dashboard</h2>
          <p className="text-slate-600">Verifying your access permissions...</p>
        </motion.div>
      </div>
    );
  }

  // User not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50"
        >
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">Authentication Required</h2>
          <p className="text-slate-600">Please sign in to access the dashboard.</p>
        </motion.div>
      </div>
    );
  }

  // User needs to complete company registration
  if (needsRegistration) {
    return (
      <CompanyRegistration 
        user={user} 
        onRegistrationComplete={handleRegistrationComplete}
      />
    );
  }

  // User has completed registration but company is pending verification (only for company owners)
  if (companyData && companyData.status === 'pending' && userRole === 'owner') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 w-full max-w-2xl p-8"
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-yellow-600" />
            </div>
            
            <h1 className="text-3xl font-light text-slate-800 mb-4">
              Registration <span className="text-yellow-600 font-medium">Under Review</span>
            </h1>
            
            <div className="bg-yellow-50/80 backdrop-blur-sm rounded-xl p-6 border border-yellow-200/50 mb-6">
              <h2 className="text-lg font-semibold text-yellow-800 mb-2">Thank you for registering!</h2>
              <p className="text-yellow-700 leading-relaxed">
                Your company registration has been submitted successfully. Our team is currently reviewing your information and will verify your account within 24-48 hours.
              </p>
            </div>

            {/* Company Info Summary */}
            <div className="bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-white/30 text-left">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-200 pb-2">
                Registration Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Company Name</p>
                  <p className="font-medium text-slate-800">{companyData.companyName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">ABN</p>
                  <p className="font-medium text-slate-800">{companyData.abn}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Contact Person</p>
                  <p className="font-medium text-slate-800">{companyData.contactPerson}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Phone</p>
                  <p className="font-medium text-slate-800">{companyData.phone}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-slate-600">Address</p>
                  <p className="font-medium text-slate-800">{companyData.address?.fullAddress}</p>
                </div>
              </div>
              
              {companyData.logoUrl && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600 mb-2">Company Logo</p>
                  <img 
                    src={companyData.logoUrl} 
                    alt="Company Logo" 
                    className="h-16 w-16 object-contain rounded-lg border border-slate-200"
                  />
                </div>
              )}
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-600">
                Questions about your registration? Contact us at{' '}
                <a href="mailto:support@company.com" className="text-teal-600 hover:text-teal-700 font-medium">
                  support@company.com
                </a>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // User registration is approved OR user is authorized - show the protected content
  return (
    <div>
      {/* You can add a context provider here to make company data available throughout the app */}
      {/* Pass userRole and companyData to children if needed */}
      {children}
    </div>
  );
};

export default RegistrationGuard;