'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Save, 
  FileSignature, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Package, 
  DollarSign, 
  Calendar, 
  FileText,
  Loader,
  AlertCircle,
  CheckCircle,
  Edit3,
  Truck,
  Clock,
  Users,
  X,
  Plus,
  ChevronDown
} from 'lucide-react';
import { db } from '@/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Import the Sales Contract Generator
import SalesContractGenerator from './SalesContractGenerator';

const OrderContractEditor = () => {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderid;

  const [order, setOrder] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showContractGenerator, setShowContractGenerator] = useState(false);

  // Email management state
  const [selectedAuthorizedEmails, setSelectedAuthorizedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);

  // Form state for editable fields
  const [formData, setFormData] = useState({
    customerInfo: {
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: {
        street: '',
        city: '',
        state: '',
        postcode: '',
        country: 'Australia'
      }
    },
    deliveryAddress: {
      street: '',
      city: '',
      state: '',
      postcode: '',
      country: 'Australia',
      fullAddress: ''
    },
    estimatedDelivery: '',
    reference: '',
    notes: '',
    authorizedEmails: [],
    contractTerms: {
      paymentTerms: '30 days',
      deliveryTerms: 'Ex-Works',
      warrantyPeriod: '12 months',
      specialConditions: ''
    }
  });

  // Load order data and company data
  useEffect(() => {
    console.log(orderId, 'Order ID from params');
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const orderDoc = await getDoc(doc(db, 'orders', orderId));

      if (!orderDoc.exists()) {
        setError('Order not found');
        return;
      }

      console.log('Fetched order:', orderDoc.data());
      const orderData = {
        id: orderDoc.id,
        ...orderDoc.data(),
        // Process dates
        createdAt: orderDoc.data().createdAt?.toDate ? orderDoc.data().createdAt.toDate() : new Date(orderDoc.data().createdAt),
        orderDate: orderDoc.data().orderDate?.toDate ? orderDoc.data().orderDate.toDate() : new Date(orderDoc.data().orderDate),
        estimatedDelivery: orderDoc.data().estimatedDelivery?.toDate ? orderDoc.data().estimatedDelivery.toDate() : (orderDoc.data().estimatedDelivery ? new Date(orderDoc.data().estimatedDelivery) : null),
      };

      setOrder(orderData);

      // Fetch company data to get authorized users
      await fetchCompanyData(orderData.userEmail);
      
      // Initialize form data
      initializeFormData(orderData);

    } catch (error) {
      console.error('Error fetching order:', error);
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyData = async (userEmail) => {
    try {
      if (!userEmail) return;

      const companiesQuery = query(
        collection(db, 'companies'),
        where('userEmail', '==', userEmail)
      );
      const companiesSnapshot = await getDocs(companiesQuery);
      
      if (!companiesSnapshot.empty) {
        const companyDoc = companiesSnapshot.docs[0];
        const company = {
          id: companyDoc.id,
          ...companyDoc.data()
        };
        setCompanyData(company);
        console.log('Fetched company data:', company);
      }
    } catch (error) {
      console.error('Error fetching company data:', error);
    }
  };

  const initializeFormData = (orderData) => {
    setFormData({
      // Contract Information
      salesContract: orderData.salesContract || `SC${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      poNumber: orderData.poNumber || '',
      orderDate: formatDateForInput(orderData.orderDate),
      
      // Customer Information
      customerInfo: {
        companyName: orderData.customerInfo?.companyName || '',
        contactPerson: orderData.customerInfo?.contactPerson || '',
        email: orderData.customerInfo?.email || '',
        phone: orderData.customerInfo?.phone || '',
        abn: orderData.customerCompanyData?.abn || orderData.customerInfo?.abn || '',
        address: {
          street: orderData.customerInfo?.address?.street || '',
          city: orderData.customerInfo?.address?.city || '',
          state: orderData.customerInfo?.address?.state || '',
          postcode: orderData.customerInfo?.address?.postcode || '',
          country: orderData.customerInfo?.address?.country || 'Australia'
        }
      },
      
      // Delivery Address
      deliveryAddress: {
        street: orderData.deliveryAddress?.street || orderData.customerInfo?.address?.street || '',
        city: orderData.deliveryAddress?.city || orderData.customerInfo?.address?.city || '',
        state: orderData.deliveryAddress?.state || orderData.customerInfo?.address?.state || '',
        postcode: orderData.deliveryAddress?.postcode || orderData.customerInfo?.address?.postcode || '',
        country: orderData.deliveryAddress?.country || orderData.customerInfo?.address?.country || 'Australia',
        fullAddress: orderData.deliveryAddress?.fullAddress || ''
      },
      
      // Product Information
      productDescription: `${orderData.items?.[0]?.barType || 'N16'} x ${orderData.items?.[0]?.length || 6}m rebar - AS 4671 : 2019 Grade 500N Deformed Reinforcing Bar ACRS Certified`,
      barType: orderData.items?.[0]?.barType || 'N16',
      length: orderData.items?.[0]?.length || 6,
      quantity: orderData.items?.[0]?.totalWeight || orderData.items?.[0]?.quantity || 0,
      pricePerTonne: orderData.items?.[0]?.pricePerTonne || 0,
      
      // Financial Information
      subtotal: orderData.subtotal || 0,
      gst: orderData.gst || 0,
      totalAmount: orderData.totalAmount || 0,
      
      // Terms and Conditions
      paymentTerms: orderData.paymentTerms || '30 Days from delivery to yard',
      deliveryTerms: orderData.deliveryTerms || 'Delivery Duty paid - unloading by purchaser',
      quantityTolerance: orderData.quantityTolerance || '+/- 10%',
      invoicingBasis: orderData.invoicingBasis || 'Theoretical Weight',
      packing: orderData.packing || "Mill's Standard for Export",
      
      // Delivery Information
      estimatedDelivery: formatDateForInput(orderData.estimatedDelivery),
      shipmentDetails: orderData.shipmentDetails || '',
      
      // Documentation
      documentation: orderData.documentation || 'Commercial Invoice\nCertificate of Origin\nMill Test Certificates\nACRS Certification',
      
      // Additional Notes
      notes: orderData.notes || '',
      reference: orderData.reference || '',
      
      // Authorized Emails
      authorizedEmails: orderData.authorizedEmails || []
    });

    // Set selected emails
    setSelectedAuthorizedEmails(orderData.authorizedEmails || []);
  };

  const formatDateForInput = (dateValue) => {
    if (!dateValue) return '';
    
    let date;
    if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
      date = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue.replace(' at ', ' ').replace(' UTC+10', ''));
    }
    
    if (date && !isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return '';
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const fields = field.split('.');
      setFormData(prev => {
        const newData = { ...prev };
        let current = newData;
        for (let i = 0; i < fields.length - 1; i++) {
          if (!current[fields[i]]) current[fields[i]] = {};
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
    setHasChanges(true);
  };

  // Email management functions
  const handleEmailToggle = (email) => {
    const newEmails = selectedAuthorizedEmails.includes(email) 
      ? selectedAuthorizedEmails.filter(e => e !== email)
      : [...selectedAuthorizedEmails, email];
    
    setSelectedAuthorizedEmails(newEmails);
    setFormData(prev => ({
      ...prev,
      authorizedEmails: newEmails
    }));
    setHasChanges(true);
  };

  const handleAddNewEmail = () => {
    if (newEmail && !selectedAuthorizedEmails.includes(newEmail)) {
      const newEmails = [...selectedAuthorizedEmails, newEmail];
      setSelectedAuthorizedEmails(newEmails);
      setFormData(prev => ({
        ...prev,
        authorizedEmails: newEmails
      }));
      setNewEmail('');
      setHasChanges(true);
    }
  };

  const handleRemoveEmail = (emailToRemove) => {
    const newEmails = selectedAuthorizedEmails.filter(email => email !== emailToRemove);
    setSelectedAuthorizedEmails(newEmails);
    setFormData(prev => ({
      ...prev,
      authorizedEmails: newEmails
    }));
    setHasChanges(true);
  };

  const calculateTotals = () => {
    const quantity = parseFloat(formData.quantity) || 0;
    const pricePerTonne = parseFloat(formData.pricePerTonne) || 0;
    const subtotal = quantity * pricePerTonne;
    const gst = subtotal * 0.1;
    const total = subtotal + gst;
    
    setFormData(prev => ({
      ...prev,
      subtotal: subtotal,
      gst: gst,
      totalAmount: total
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Prepare the updated order data
      const updatedOrder = {
        ...order,
        salesContract: formData.salesContract,
        orderDate: formData.orderDate ? new Date(formData.orderDate) : order.orderDate,
        
        customerInfo: {
          ...order.customerInfo,
          companyName: formData.customerInfo.companyName,
          contactPerson: formData.customerInfo.contactPerson,
          email: formData.customerInfo.email,
          phone: formData.customerInfo.phone,
          abn: formData.customerInfo.abn,
          address: formData.customerInfo.address
        },
        
        customerCompanyData: {
          abn: formData.customerInfo.abn
        },
        
        deliveryAddress: {
          street: formData.deliveryAddress.street,
          city: formData.deliveryAddress.city,
          state: formData.deliveryAddress.state,
          postcode: formData.deliveryAddress.postcode,
          country: formData.deliveryAddress.country,
          fullAddress: `${formData.deliveryAddress.street}, ${formData.deliveryAddress.city} ${formData.deliveryAddress.state} ${formData.deliveryAddress.postcode}`
        },
        
        items: [{
          ...order.items?.[0],
          barType: formData.barType,
          length: formData.length,
          quantity: formData.quantity,
          totalWeight: formData.quantity,
          pricePerTonne: formData.pricePerTonne
        }],
        
        subtotal: formData.subtotal,
        gst: formData.gst,
        totalAmount: formData.totalAmount,
        
        paymentTerms: formData.paymentTerms,
        deliveryTerms: formData.deliveryTerms,
        quantityTolerance: formData.quantityTolerance,
        invoicingBasis: formData.invoicingBasis,
        packing: formData.packing,
        
        estimatedDelivery: formData.estimatedDelivery ? new Date(formData.estimatedDelivery) : order.estimatedDelivery,
        shipmentDetails: formData.shipmentDetails,
        documentation: formData.documentation,
        notes: formData.notes,
        reference: formData.reference,
        
        // Update authorized emails
        authorizedEmails: selectedAuthorizedEmails,
        
        updatedAt: new Date()
      };

      // Update in Firestore
      await updateDoc(doc(db, 'orders', orderId), updatedOrder);
      
      setOrder(updatedOrder);
      setHasChanges(false);
      
      // Show contract generator
      setShowContractGenerator(true);
      
    } catch (error) {
      console.error('Error saving order:', error);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateContract = () => {
    if (hasChanges) {
      // Save first, then generate
      handleSave();
    } else {
      // Direct generate
      setShowContractGenerator(true);
    }
  };

  const handleBackToInvoices = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        router.push('/dashboard/my-orders');
      }
    } else {
      router.push('/dashboard/my-orders');
    }
  };

  const closeSalesContractGenerator = () => {
    setShowContractGenerator(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-teal-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/my-orders')}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-white/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToInvoices}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Sales Contract</h1>
                <p className="text-gray-600">Order {order?.poNumber} • Customize contract details</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {hasChanges && (
                <span className="text-sm text-amber-600 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Unsaved changes
                </span>
              )}
              
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  hasChanges
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              
              <button
                onClick={handleGenerateContract}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center gap-2"
              >
                <FileSignature className="w-4 h-4" />
                Generate Contract
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column */}
          <div className="space-y-6">
            
            {/* Contract Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Contract Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sales Contract Number</label>
                  <input
                    type="text"
                    value={formData.salesContract || ''}
                    onChange={(e) => handleInputChange('salesContract', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="SC25032"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
                  <input
                    type="text"
                    value={formData.poNumber || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                    placeholder="PO-123456789"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                  <input
                    type="date"
                    value={formData.orderDate || ''}
                    onChange={(e) => handleInputChange('orderDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </motion.div>

            {/* Authorized Users Management */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                Authorized Users ({selectedAuthorizedEmails.length})
              </h3>
              
              {/* Selected Emails Display */}
              {selectedAuthorizedEmails.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Selected users:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAuthorizedEmails.map((email) => (
                      <span
                        key={email}
                        className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 border border-teal-200"
                      >
                        <Mail className="w-3 h-3" />
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="hover:bg-teal-200 rounded-full p-0.5 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dropdown for Company Authorized Users */}
              {companyData && companyData.authorizedUsers && companyData.authorizedUsers.length > 0 && (
                <div className="mb-4">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmailDropdown(!showEmailDropdown)}
                      className="w-full bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 hover:bg-white/80 flex items-center justify-between"
                    >
                      <span className="text-gray-700">
                        Select from company authorized users
                      </span>
                      <ChevronDown 
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                          showEmailDropdown ? 'transform rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showEmailDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-xl border border-white/40 rounded-xl shadow-xl z-50 max-h-64 overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                          {companyData.authorizedUsers.map((email) => (
                            <button
                              key={email}
                              type="button"
                              onClick={() => {
                                handleEmailToggle(email);
                                setShowEmailDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50/50 transition-colors flex items-center gap-3 border-b border-white/10 last:border-b-0"
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                selectedAuthorizedEmails.includes(email)
                                  ? 'bg-teal-500 border-teal-500'
                                  : 'border-gray-300'
                              }`}>
                                {selectedAuthorizedEmails.includes(email) && (
                                  <CheckCircle className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-3 h-3 text-gray-400" />
                                  <span className="text-gray-700">{email}</span>
                                </div>
                                {email === companyData.superAdmin && (
                                  <span className="text-xs text-teal-600 font-medium">Super Admin</span>
                                )}
                                {companyData.admins?.includes(email) && email !== companyData.superAdmin && (
                                  <span className="text-xs text-blue-600 font-medium">Admin</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Add Custom Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Custom Email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email address"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewEmail}
                    disabled={!newEmail}
                    className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Authorized users will have access to this order and can sign contracts.
              </p>
            </motion.div>

            {/* Customer Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-green-600" />
                Customer Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    value={formData.customerInfo?.companyName || ''}
                    onChange={(e) => handleInputChange('customerInfo.companyName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Customer Company Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ABN</label>
                  <input
                    type="text"
                    value={formData.customerInfo?.abn || ''}
                    onChange={(e) => handleInputChange('customerInfo.abn', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="12 345 678 901"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person *</label>
                  <input
                    type="text"
                    value={formData.customerInfo?.contactPerson || ''}
                    onChange={(e) => handleInputChange('customerInfo.contactPerson', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Smith"
                  />
                </div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.customerInfo?.email || ''}
                      onChange={(e) => handleInputChange('customerInfo.email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="john@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={formData.customerInfo?.phone || ''}
                      onChange={(e) => handleInputChange('customerInfo.phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+61 400 000 000"
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Delivery Address */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-600" />
                Delivery Address
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={formData.deliveryAddress?.street || ''}
                    onChange={(e) => handleInputChange('deliveryAddress.street', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.deliveryAddress?.city || ''}
                      onChange={(e) => handleInputChange('deliveryAddress.city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Melbourne"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <select
                      value={formData.deliveryAddress?.state || ''}
                      onChange={(e) => handleInputChange('deliveryAddress.state', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select State</option>
                      <option value="NSW">NSW</option>
                      <option value="VIC">VIC</option>
                      <option value="QLD">QLD</option>
                      <option value="WA">WA</option>
                      <option value="SA">SA</option>
                      <option value="TAS">TAS</option>
                      <option value="ACT">ACT</option>
                      <option value="NT">NT</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                    <input
                      type="text"
                      value={formData.deliveryAddress?.postcode || ''}
                      onChange={(e) => handleInputChange('deliveryAddress.postcode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="3000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={formData.deliveryAddress?.country || ''}
                      onChange={(e) => handleInputChange('deliveryAddress.country', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Australia"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            
            {/* Product Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Product Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Description</label>
                  <textarea
                    value={formData.productDescription || ''}
                    onChange={(e) => handleInputChange('productDescription', e.target.value)}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`${formData.barType || 'N16'} x ${formData.length || 6}`}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bar Type *</label>
                    <select
                      value={formData.barType || ''}
                      onChange={(e) => handleInputChange('barType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select</option>
                      <option value="N12">N12</option>
                      <option value="N16">N16</option>
                      <option value="N20">N20</option>
                      <option value="N24">N24</option>
                      <option value="N28">N28</option>
                      <option value="N32">N32</option>
                      <option value="N36">N36</option>
                      <option value="N40">N40</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Length (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.length || ''}
                      onChange={(e) => handleInputChange('length', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="6"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (t) *</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.quantity || ''}
                      onChange={(e) => {
                        handleInputChange('quantity', parseFloat(e.target.value));
                        setTimeout(calculateTotals, 100);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="25"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price per Tonne (AUD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.pricePerTonne || ''}
                    onChange={(e) => {
                      handleInputChange('pricePerTonne', parseFloat(e.target.value));
                      setTimeout(calculateTotals, 100);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1095.00"
                  />
                </div>
              </div>
            </motion.div>

            {/* Financial Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Financial Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">${(formData.subtotal || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">GST (10%):</span>
                  <span className="font-semibold">${(formData.gst || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t border-green-300 pt-2">
                  <span className="text-lg font-bold text-green-800">Total:</span>
                  <span className="text-lg font-bold text-green-800">${(formData.totalAmount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </motion.div>

            {/* Terms and Conditions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-orange-600" />
                Terms & Conditions
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={formData.paymentTerms || ''}
                    onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="30 Days from delivery to yard"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Terms</label>
                  <input
                    type="text"
                    value={formData.deliveryTerms || ''}
                    onChange={(e) => handleInputChange('deliveryTerms', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Delivery Duty paid - unloading by purchaser"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Tolerance</label>
                    <input
                      type="text"
                      value={formData.quantityTolerance || ''}
                      onChange={(e) => handleInputChange('quantityTolerance', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+/- 10%"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoicing Basis</label>
                    <input
                      type="text"
                      value={formData.invoicingBasis || ''}
                      onChange={(e) => handleInputChange('invoicingBasis', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Theoretical Weight"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Packing</label>
                  <input
                    type="text"
                    value={formData.packing || ''}
                    onChange={(e) => handleInputChange('packing', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Mill's Standard for Export"
                  />
                </div>
              </div>
            </motion.div>

            {/* Delivery Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.7 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Delivery Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Delivery Date</label>
                  <input
                    type="date"
                    value={formData.estimatedDelivery || ''}
                    onChange={(e) => handleInputChange('estimatedDelivery', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipment Details</label>
                  <textarea
                    value={formData.shipmentDetails || ''}
                    onChange={(e) => handleInputChange('shipmentDetails', e.target.value)}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="End June shipment, arrival and delivery by end August 2025"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Documentation</label>
                  <textarea
                    value={formData.documentation || ''}
                    onChange={(e) => handleInputChange('documentation', e.target.value)}
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Commercial Invoice&#10;Certificate of Origin&#10;Mill Test Certificates&#10;ACRS Certification"
                  />
                </div>
              </div>
            </motion.div>

            {/* Additional Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.8 }}
              className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                Additional Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input
                    type="text"
                    value={formData.reference || ''}
                    onChange={(e) => handleInputChange('reference', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Project reference or internal notes"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions or Notes</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any special delivery instructions, quality requirements, or additional terms..."
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.9 }}
          className="mt-8 bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              {hasChanges ? (
                <span className="flex items-center gap-2 text-amber-600">
                  <Clock className="w-4 h-4" />
                  You have unsaved changes. Save before generating contract.
                </span>
              ) : (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  All changes saved. Ready to generate contract.
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToInvoices}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`px-6 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  hasChanges
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              
              <button
                onClick={handleGenerateContract}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center gap-2 shadow-lg"
              >
                <FileSignature className="w-4 h-4" />
                Generate Contract
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Sales Contract Generator Modal */}
      {showContractGenerator && order && (
        <SalesContractGenerator 
          order={{
            ...order,
            ...formData,
            // Include authorized emails
            authorizedEmails: selectedAuthorizedEmails,
            customerCompanyData: {
              abn: formData.customerInfo?.abn
            }
          }}
          onClose={closeSalesContractGenerator}
        />
      )}
    </div>
  );
};

export default OrderContractEditor;