'use client'
import React, { useState, useEffect } from 'react';
import { Search, Building2, MapPin, Phone, Mail, Globe, Calendar, Users, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import {db } from '@/firebase'; // Adjust the import based on your Firebase setup
import { collection, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

const CompanyDashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const router = useRouter();

  // Fetch companies from Firebase
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError(null);

      const companiesRef = collection(db, 'companies');
      const snapshot = await getDocs(companiesRef);
      const companiesData = [];
      
      snapshot.forEach((doc) => {
        companiesData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setCompanies(companiesData);
      setFilteredCompanies(companiesData);
    } catch (err) {
      setError('Failed to fetch companies: ' + err.message);
      console.error('Error fetching companies:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter companies based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCompanies(companies);
    } else {
      const filtered = companies.filter(company =>
        company.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.address?.city?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCompanies(filtered);
    }
  }, [searchTerm, companies]);

  // Fetch companies on component mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  // Navigate to company documents
  const handleViewDocuments = (companyId) => {
    router.push(`/documents/${companyId}`);
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading companies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={fetchCompanies}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Building2 className="h-8 w-8 text-blue-600" />
                Company Dashboard
              </h1>
              <p className="text-gray-600 mt-1">Manage and view all registered companies</p>
            </div>
            <div className="text-sm text-gray-500">
              Total Companies: <span className="font-semibold text-gray-900">{companies.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies by name, contact person, email, or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Companies Grid */}
        {filteredCompanies.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No companies found matching your search.' : 'No companies registered yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => (
              <div key={company.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                {/* Company Header */}
                <div className="p-6 border-b">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {company.logoUrl ? (
                        <img 
                          src={company.logoUrl} 
                          alt={`${company.companyName} logo`}
                          className="h-12 w-12 rounded-lg object-cover border"
                        />
                      ) : (
                        <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-blue-600" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {company.companyName || 'Unnamed Company'}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(company.status)}`}>
                          {company.status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    {company.isVerified && (
                      <div className="bg-green-100 p-1 rounded-full">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Company Details */}
                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{company.contactPerson || 'No contact person'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{company.email || 'No email'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{company.phone || 'No phone'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">
                      {company.address?.city ? `${company.address.city}, ${company.address.state}` : 'No address'}
                    </span>
                  </div>
                  
                  {company.website && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Globe className="h-4 w-4" />
                      <a 
                        href={company.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate"
                      >
                        {company.website}
                      </a>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Registered: {formatDate(company.registrationDate)}</span>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs text-gray-500">
                      Admins: {company.admins?.length || 0} | 
                      Users: {company.authorizedUsers?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <div className="p-6 pt-0">
                  <button
                    onClick={() => handleViewDocuments(company.id)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    View Documents
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyDashboard;