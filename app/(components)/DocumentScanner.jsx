'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Camera,
  FileText,
  Loader,
  CheckCircle,
  AlertCircle,
  Edit,
  Save,
  X,
  Eye,
  Download,
  Scan,
  RefreshCw,
  Building,
  Mail,
  Phone,
  MapPin,
  Package,
  DollarSign,
  Calendar,
  User
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const DocumentScanner = () => {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);

  // Initialize form data structure based on your database schema
  const [formData, setFormData] = useState({
    // Customer Information
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
    // Product Information
    items: [{
      barType: '',
      length: '',
      quantity: '',
      totalWeight: '',
      pricePerTonne: '',
      totalPrice: ''
    }],
    // Order Details
    poNumber: '',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    reference: '',
    notes: '',
    salesContract: '',
    // Financial
    subtotal: 0,
    gst: 0,
    totalAmount: 0,
    // Assigned Users (from your multi-email system)
    assignedUsers: []
  });

  // Handle file upload
  const handleFileUpload = useCallback((file) => {
    if (!file) return;

    // Validate file type
    const validTypes = [
      'image/jpeg', 
      'image/png', 
      'image/webp', 
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX
    ];
    
    // Also check file extension for DOCX (sometimes MIME type is not detected correctly)
    const fileName = file.name.toLowerCase();
    const isDocx = fileName.endsWith('.docx');
    
    if (!validTypes.includes(file.type) && !isDocx) {
      setError('Please upload a valid file: Images (JPEG, PNG, WebP), PDF, or Word documents (.docx)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setUploadedFile(file);
    setError(null);

    // Create preview for images only
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // Scan document with OpenAI
  const scanDocument = async () => {
    if (!uploadedFile) {
      setError('Please upload a document first');
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setError(null);

    try {
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });

      setScanProgress(30);

      // Send to API
      const response = await fetch('/api/scan-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileData: base64,
          fileName: uploadedFile.name,
          fileType: uploadedFile.type
        }),
      });

      setScanProgress(70);

      if (!response.ok) {
        throw new Error(`Failed to scan document: ${response.statusText}`);
      }

      const result = await response.json();
      setScanProgress(100);

      if (result.success) {
        setExtractedData(result.data);
        setFormData(prev => ({
          ...prev,
          ...result.data,
          // Preserve some defaults
          orderDate: result.data.orderDate || prev.orderDate,
          assignedUsers: result.data.assignedUsers || [{
            id: user?.id || 'current',
            name: user?.fullName || 'Current User',
            email: user?.emailAddresses?.[0]?.emailAddress || '',
            type: 'self'
          }]
        }));
        setIsEditing(true);
      } else {
        throw new Error(result.error || 'Failed to extract data from document');
      }

    } catch (error) {
      console.error('Error scanning document:', error);
      setError(error.message || 'Failed to scan document. Please try again.');
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  // Handle form input changes
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

    // Auto-calculate totals when financial fields change
    if (['subtotal', 'gst'].includes(field)) {
      calculateTotals();
    }
  };

  // Calculate financial totals
  const calculateTotals = () => {
    const subtotal = parseFloat(formData.subtotal) || 0;
    const gst = subtotal * 0.1; // 10% GST
    const total = subtotal + gst;

    setFormData(prev => ({
      ...prev,
      gst: parseFloat(gst.toFixed(2)),
      totalAmount: parseFloat(total.toFixed(2))
    }));
  };

  // Save order to database
  const saveOrder = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Generate PO number if not provided
      const poNumber = formData.poNumber || `PO-${Date.now()}`;
      
      const orderData = {
        ...formData,
        poNumber,
        userId: user?.id,
        userEmail: user?.emailAddresses?.[0]?.emailAddress,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        scannedFrom: uploadedFile.name,
        extractedData: extractedData // Store original extracted data for reference
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error('Failed to save order');
      }

      const result = await response.json();
      
      // Success - redirect to order details or invoice management
      router.push(`/dashboard/invoice-management`);

    } catch (error) {
      console.error('Error saving order:', error);
      setError('Failed to save order. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset component
  const resetScanner = () => {
    setUploadedFile(null);
    setPreview(null);
    setExtractedData(null);
    setIsEditing(false);
    setError(null);
    setFormData({
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
      items: [{
        barType: '',
        length: '',
        quantity: '',
        totalWeight: '',
        pricePerTonne: '',
        totalPrice: ''
      }],
      poNumber: '',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: '',
      reference: '',
      notes: '',
      salesContract: '',
      subtotal: 0,
      gst: 0,
      totalAmount: 0,
      assignedUsers: []
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Scan className="w-8 h-8 text-teal-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Document Scanner</h1>
          </div>
          <p className="text-gray-600">Upload and scan documents to automatically generate orders</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload & Preview */}
          <div className="space-y-6">
            {/* Upload Area */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h2>
                
                {!uploadedFile ? (
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-teal-400 transition-colors cursor-pointer"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Drop your document here
                    </h3>
                    <p className="text-gray-600 mb-4">
                      or click to browse files
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports PDF, DOCX, JPEG, PNG, WebP (max 10MB)
                    </p>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => handleFileUpload(e.target.files[0])}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* File Info */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-teal-600" />
                        <div>
                          <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                          <p className="text-sm text-gray-600">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={resetScanner}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Preview */}
                    {preview ? (
                      <div className="relative">
                        <img
                          src={preview}
                          alt="Document preview"
                          className="w-full h-64 object-contain bg-gray-100 rounded-lg border"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="w-full h-32 bg-gray-100 rounded-lg border flex items-center justify-center">
                          <div className="text-center">
                            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">
                              {uploadedFile.type === 'application/pdf' ? 'PDF Document' : 
                               uploadedFile.name.toLowerCase().endsWith('.docx') ? 'Word Document' : 
                               'Document Preview'}
                            </p>
                            <p className="text-xs text-gray-400">{uploadedFile.name}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scan Button */}
                    <button
                      onClick={scanDocument}
                      disabled={isScanning}
                      className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                    >
                      {isScanning ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Scanning Document...
                        </>
                      ) : (
                        <>
                          <Scan className="w-5 h-5" />
                          Scan Document
                        </>
                      )}
                    </button>

                    {/* Progress Bar */}
                    {isScanning && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-700">{error}</p>
                </div>
              </motion.div>
            )}

            {/* Success Display */}
            {extractedData && !isEditing && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 border border-green-200 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-green-700">Document scanned successfully! Review and edit the data below.</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Extracted Data Form */}
          <div className="space-y-6">
            {(extractedData || isEditing) && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg border shadow-sm overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Order Details</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title={isEditing ? "View Mode" : "Edit Mode"}
                      >
                        {isEditing ? <Eye className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <form className="space-y-6">
                    {/* Order Information */}
                    <div>
                      <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-teal-600" />
                        Order Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            PO Number
                          </label>
                          <input
                            type="text"
                            value={formData.poNumber}
                            onChange={(e) => handleInputChange('poNumber', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                            placeholder="Auto-generated if empty"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sales Contract
                          </label>
                          <input
                            type="text"
                            value={formData.salesContract}
                            onChange={(e) => handleInputChange('salesContract', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Order Date
                          </label>
                          <input
                            type="date"
                            value={formData.orderDate}
                            onChange={(e) => handleInputChange('orderDate', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Delivery Date
                          </label>
                          <input
                            type="date"
                            value={formData.deliveryDate}
                            onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reference
                        </label>
                        <input
                          type="text"
                          value={formData.reference}
                          onChange={(e) => handleInputChange('reference', e.target.value)}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                        />
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div>
                      <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Building className="w-5 h-5 text-teal-600" />
                        Customer Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Company Name
                          </label>
                          <input
                            type="text"
                            value={formData.customerInfo.companyName}
                            onChange={(e) => handleInputChange('customerInfo.companyName', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Contact Person
                          </label>
                          <input
                            type="text"
                            value={formData.customerInfo.contactPerson}
                            onChange={(e) => handleInputChange('customerInfo.contactPerson', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={formData.customerInfo.email}
                            onChange={(e) => handleInputChange('customerInfo.email', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={formData.customerInfo.phone}
                            onChange={(e) => handleInputChange('customerInfo.phone', e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Address
                          </label>
                          <input
                            type="text"
                            value={formData.customerInfo.address.street}
                            onChange={(e) => handleInputChange('customerInfo.address.street', e.target.value)}
                            disabled={!isEditing}
                            placeholder="Street Address"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 mb-2"
                          />
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <input
                              type="text"
                              value={formData.customerInfo.address.city}
                              onChange={(e) => handleInputChange('customerInfo.address.city', e.target.value)}
                              disabled={!isEditing}
                              placeholder="City"
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                            />
                            <input
                              type="text"
                              value={formData.customerInfo.address.state}
                              onChange={(e) => handleInputChange('customerInfo.address.state', e.target.value)}
                              disabled={!isEditing}
                              placeholder="State"
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                            />
                            <input
                              type="text"
                              value={formData.customerInfo.address.postcode}
                              onChange={(e) => handleInputChange('customerInfo.address.postcode', e.target.value)}
                              disabled={!isEditing}
                              placeholder="Postcode"
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                            />
                            <input
                              type="text"
                              value={formData.customerInfo.address.country}
                              onChange={(e) => handleInputChange('customerInfo.address.country', e.target.value)}
                              disabled={!isEditing}
                              placeholder="Country"
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Product Information */}
                    {formData.items && formData.items.length > 0 && (
                      <div>
                        <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <Package className="w-5 h-5 text-teal-600" />
                          Product Information
                        </h3>
                        {formData.items.map((item, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Bar Type
                                </label>
                                <input
                                  type="text"
                                  value={item.barType}
                                  onChange={(e) => {
                                    const newItems = [...formData.items];
                                    newItems[index].barType = e.target.value;
                                    setFormData(prev => ({ ...prev, items: newItems }));
                                  }}
                                  disabled={!isEditing}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Length (m)
                                </label>
                                <input
                                  type="number"
                                  value={item.length}
                                  onChange={(e) => {
                                    const newItems = [...formData.items];
                                    newItems[index].length = e.target.value;
                                    setFormData(prev => ({ ...prev, items: newItems }));
                                  }}
                                  disabled={!isEditing}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Quantity/Weight (t)
                                </label>
                                <input
                                  type="number"
                                  value={item.totalWeight || item.quantity}
                                  onChange={(e) => {
                                    const newItems = [...formData.items];
                                    newItems[index].totalWeight = e.target.value;
                                    newItems[index].quantity = e.target.value;
                                    setFormData(prev => ({ ...prev, items: newItems }));
                                  }}
                                  disabled={!isEditing}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Price per Tonne
                                </label>
                                <input
                                  type="number"
                                  value={item.pricePerTonne}
                                  onChange={(e) => {
                                    const newItems = [...formData.items];
                                    newItems[index].pricePerTonne = e.target.value;
                                    setFormData(prev => ({ ...prev, items: newItems }));
                                  }}
                                  disabled={!isEditing}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Total Price
                                </label>
                                <input
                                  type="number"
                                  value={item.totalPrice}
                                  onChange={(e) => {
                                    const newItems = [...formData.items];
                                    newItems[index].totalPrice = e.target.value;
                                    setFormData(prev => ({ ...prev, items: newItems }));
                                    }}
                                  disabled={!isEditing}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Financial Information */}
                    <div>
                      <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-teal-600" />
                        Financial Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Subtotal
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.subtotal}
                            onChange={(e) => {
                              handleInputChange('subtotal', parseFloat(e.target.value) || 0);
                              // Auto-calculate GST and total
                              const subtotal = parseFloat(e.target.value) || 0;
                              const gst = Math.round(subtotal * 0.1 * 100) / 100;
                              const total = subtotal + gst;
                              setFormData(prev => ({
                                ...prev,
                                subtotal: subtotal,
                                gst: gst,
                                totalAmount: total
                              }));
                            }}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            GST (10%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.gst}
                            onChange={(e) => handleInputChange('gst', parseFloat(e.target.value) || 0)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 bg-gray-100"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Total Amount
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.totalAmount}
                            onChange={(e) => handleInputChange('totalAmount', parseFloat(e.target.value) || 0)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50 font-bold text-lg bg-teal-50"
                            readOnly
                          />
                        </div>
                      </div>
                    </div>

                    {/* Assigned Users */}
                    {formData.assignedUsers && formData.assignedUsers.length > 0 && (
                      <div>
                        <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <User className="w-5 h-5 text-teal-600" />
                          Assigned Users ({formData.assignedUsers.length})
                        </h3>
                        <div className="space-y-2">
                          {formData.assignedUsers.map((assignedUser, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                                  {assignedUser.name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{assignedUser.name}</p>
                                  <p className="text-sm text-gray-600">{assignedUser.email}</p>
                                </div>
                              </div>
                              {assignedUser.type === 'self' && (
                                <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-teal-600" />
                          Notes & Instructions
                        </span>
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        disabled={!isEditing}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                        placeholder="Additional notes, delivery instructions, or special requirements..."
                      />
                    </div>

                    {/* Action Buttons */}
                    {isEditing && (
                      <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={saveOrder}
                          disabled={isSaving}
                          className="flex-1 bg-teal-600 text-white py-3 px-6 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                        >
                          {isSaving ? (
                            <>
                              <Loader className="w-5 h-5 animate-spin" />
                              Saving Order...
                            </>
                          ) : (
                            <>
                              <Save className="w-5 h-5" />
                              Save Order
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={resetScanner}
                          className="flex-1 sm:flex-none px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                          <span className="flex items-center justify-center gap-2">
                            <X className="w-5 h-5" />
                            Cancel
                          </span>
                        </button>
                      </div>
                    )}

                    {/* View Mode Info */}
                    {!isEditing && extractedData && (
                      <div className="pt-6 border-t border-gray-200">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Eye className="w-5 h-5 text-blue-600" />
                            <p className="font-medium text-blue-800">View Mode</p>
                          </div>
                          <p className="text-blue-700 text-sm">
                            Click the edit button above to modify the extracted data before saving.
                          </p>
                        </div>
                      </div>
                    )}
                  </form>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer Information */}
        <div className="mt-8 text-center">
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">How Document Scanner Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
              <div className="flex flex-col items-center">
                <Upload className="w-8 h-8 text-teal-600 mb-2" />
                <h4 className="font-medium text-gray-900 mb-1">1. Upload Document</h4>
                <p>Upload your purchase order, invoice, or quote (PDF, Word, or image formats supported)</p>
              </div>
              <div className="flex flex-col items-center">
                <Scan className="w-8 h-8 text-teal-600 mb-2" />
                <h4 className="font-medium text-gray-900 mb-1">2. AI Extraction</h4>
                <p>Our AI automatically extracts customer info, product details, and pricing from your document</p>
              </div>
              <div className="flex flex-col items-center">
                <Edit className="w-8 h-8 text-teal-600 mb-2" />
                <h4 className="font-medium text-gray-900 mb-1">3. Review & Save</h4>
                <p>Review the extracted data, make any necessary edits, and save as a new order</p>
              </div>
            </div>

            {/* Additional Features */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Supported Features</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>PDF Documents</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Word Documents</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Image Files</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Auto Calculations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Multi-User Orders</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Steel Specifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Australian GST</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Data Validation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentScanner;