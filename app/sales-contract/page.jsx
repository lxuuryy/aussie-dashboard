'use client'
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Download, Eye, Building, User, Calendar, DollarSign, Package, FileText, Upload, Scan, CheckCircle, XCircle, Camera } from 'lucide-react';

const SalesContractFormBuilder = () => {
  const [contract, setContract] = useState({
    // Company Details
    companyInfo: {
      name: 'Aussie Steel Direct Pty Ltd',
      abn: '95 675 742 720',
      address: 'U 6008/370 Queen Street, Melbourne VIC 3000 Australia',
      email: 'sales@aussiesteeldirect.com.au',
      phone: '+61 4 4952 5928',
      logo: ''
    },
    
    // Contract Details
    contractNumber: '',
    orderReference: '',
    date: new Date().toISOString().split('T')[0],
    
    // Customer Details
    customer: {
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      deliveryAddress: '',
      attentionTo: ''
    },
    
    // Products
    products: [{
      id: 1,
      itemCode: '',
      description: '',
      specifications: '',
      quantity: 0,
      unitPrice: 0,
      amount: 0
    }],
    
    // Terms
    paymentTerms: '20% Deposit and balance to be paid upon arrival / before delivery',
    deliveryTerms: 'Free Into Store - unloading by purchaser. Delivery on top of a flat top truck.',
    shipmentDate: '',
    
    // Financial
    subtotal: 0,
    gstRate: 10,
    gst: 0,
    total: 0,
    
    // Bank Details
    bankDetails: {
      bankName: 'Commonwealth Bank',
      bsb: '063-019',
      accountNumber: '1273 6650',
      accountName: 'Aussie Steel Direct Pty Ltd'
    },
    
    // Documentation
    documentation: [
      'Commercial Invoice',
      'Mill Test Certificates',
      'Certificate of Origin',
      'ACRS Certificates',
      'Tests reports',
      'QA/QC Certification for compliance with PSA\'s specified tolerance requirements'
    ],
    
    // Additional Terms
    additionalTerms: 'All sales are subject to Aussie Steel Direct\'s General Terms and Conditions of Sale 2025.',
    
    // Signatures
    supplierSignatory: {
      name: 'Wilson Wong',
      title: 'Aussie Steel Direct Pty Ltd',
      date: new Date().toISOString().split('T')[0]
    },
    customerSignatory: {
      name: '',
      title: '',
      date: new Date().toISOString().split('T')[0]
    }
  });

  const [activeTab, setActiveTab] = useState('scanner');
  const [showPreview, setShowPreview] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Calculate totals
  useEffect(() => {
    const subtotal = contract.products.reduce((sum, product) => sum + (product.amount || 0), 0);
    const gst = subtotal * (contract.gstRate / 100);
    const total = subtotal + gst;
    
    setContract(prev => ({
      ...prev,
      subtotal,
      gst,
      total
    }));
  }, [contract.products, contract.gstRate]);

  // Update product amounts when quantity or price changes
  useEffect(() => {
    setContract(prev => ({
      ...prev,
      products: prev.products.map(product => ({
        ...product,
        amount: (product.quantity || 0) * (product.unitPrice || 0)
      }))
    }));
  }, [contract.products.map(p => `${p.quantity}-${p.unitPrice}`).join(',')]);

  // Document Scanner Functions
  const scanDocument = async (file) => {
    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch('/api/scanning-doc', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to scan document');
      }

      const result = await response.json();
      setScanResults(result);
      
      // Auto-fill form with extracted data
      if (result.success && result.data) {
        autoFillForm(result.data);
      }
    } catch (error) {
      console.error('Error scanning document:', error);
      setScanResults({
        success: false,
        error: error.message || 'Failed to scan document. Please try again.'
      });
    } finally {
      setIsScanning(false);
    }
  };

  const autoFillForm = (extractedData) => {
    setContract(prev => ({
      ...prev,
      // Company Info
      ...(extractedData.companyInfo && {
        companyInfo: {
          ...prev.companyInfo,
          ...extractedData.companyInfo
        }
      }),
      // Contract Details
      ...(extractedData.contractNumber && { contractNumber: extractedData.contractNumber }),
      ...(extractedData.orderReference && { orderReference: extractedData.orderReference }),
      ...(extractedData.date && { date: extractedData.date }),
      ...(extractedData.shipmentDate && { shipmentDate: extractedData.shipmentDate }),
      // Customer Info
      ...(extractedData.customer && {
        customer: {
          ...prev.customer,
          ...extractedData.customer
        }
      }),
      // Products
      ...(extractedData.products && extractedData.products.length > 0 && {
        products: extractedData.products.map((product, index) => ({
          id: Date.now() + index,
          itemCode: product.itemCode || '',
          description: product.description || '',
          specifications: product.specifications || '',
          quantity: product.quantity || 0,
          unitPrice: product.unitPrice || 0,
          amount: (product.quantity || 0) * (product.unitPrice || 0)
        }))
      }),
      // Terms
      ...(extractedData.paymentTerms && { paymentTerms: extractedData.paymentTerms }),
      ...(extractedData.deliveryTerms && { deliveryTerms: extractedData.deliveryTerms }),
      // Bank Details
      ...(extractedData.bankDetails && {
        bankDetails: {
          ...prev.bankDetails,
          ...extractedData.bankDetails
        }
      }),
      // Documentation
      ...(extractedData.documentation && { documentation: extractedData.documentation }),
      // Additional Terms
      ...(extractedData.additionalTerms && { additionalTerms: extractedData.additionalTerms }),
      // Signatures
      ...(extractedData.supplierSignatory && {
        supplierSignatory: {
          ...prev.supplierSignatory,
          ...extractedData.supplierSignatory
        }
      }),
      ...(extractedData.customerSignatory && {
        customerSignatory: {
          ...prev.customerSignatory,
          ...extractedData.customerSignatory
        }
      })
    }));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        scanDocument(file);
      } else {
        alert('Please upload a PDF or image file.');
      }
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        scanDocument(file);
      } else {
        alert('Please upload a PDF or image file.');
      }
    }
  };

  const addProduct = () => {
    const newProduct = {
      id: Date.now(),
      itemCode: '',
      description: '',
      specifications: '',
      quantity: 0,
      unitPrice: 0,
      amount: 0
    };
    setContract(prev => ({
      ...prev,
      products: [...prev.products, newProduct]
    }));
  };

  const removeProduct = (id) => {
    setContract(prev => ({
      ...prev,
      products: prev.products.filter(product => product.id !== id)
    }));
  };

  const updateProduct = (id, field, value) => {
    setContract(prev => ({
      ...prev,
      products: prev.products.map(product =>
        product.id === id ? { ...product, [field]: value } : product
      )
    }));
  };

  const duplicateProduct = (id) => {
    const productToDuplicate = contract.products.find(p => p.id === id);
    if (productToDuplicate) {
      const newProduct = {
        ...productToDuplicate,
        id: Date.now(),
        quantity: 0,
        amount: 0
      };
      setContract(prev => ({
        ...prev,
        products: [...prev.products, newProduct]
      }));
    }
  };

  const updateNestedField = (section, field, value) => {
    setContract(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const updateDocumentation = (index, value) => {
    setContract(prev => ({
      ...prev,
      documentation: prev.documentation.map((doc, i) => i === index ? value : doc)
    }));
  };

  const addDocumentation = () => {
    setContract(prev => ({
      ...prev,
      documentation: [...prev.documentation, '']
    }));
  };

  const removeDocumentation = (index) => {
    setContract(prev => ({
      ...prev,
      documentation: prev.documentation.filter((_, i) => i !== index)
    }));
  };

  const generateContractNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SC${year}${month}${day}${random}`;
  };

  const generateOrderReference = () => {
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `VP${random}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount || 0);
  };

  const tabs = [
    { id: 'scanner', label: 'Document Scanner', icon: Scan },
    { id: 'company', label: 'Company Info', icon: Building },
    { id: 'contract', label: 'Contract Details', icon: FileText },
    { id: 'customer', label: 'Customer Info', icon: User },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'terms', label: 'Terms & Payment', icon: DollarSign },
    { id: 'signatures', label: 'Signatures', icon: User }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Sales Contract Builder</h1>
              <p className="text-blue-100 mt-1">Create professional sales contracts with ease</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
              <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6">
            {/* Document Scanner Tab */}
            {activeTab === 'scanner' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <Scan className="w-5 h-5" />
                    Document Scanner
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Camera className="w-4 h-4" />
                    <span>AI-Powered Data Extraction</span>
                  </div>
                </div>
                
                {/* Main Upload Area */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                      <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Upload Document to Auto-Fill Form</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      Upload a PDF or image of an existing sales contract to automatically extract and populate all form fields using AI.
                    </p>
                  </div>
                  
                  {/* Drag & Drop Area */}
                  <div 
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                      dragActive 
                        ? 'border-blue-400 bg-blue-50' 
                        : isScanning 
                          ? 'border-gray-300 bg-gray-50' 
                          : 'border-blue-300 bg-white hover:border-blue-400 hover:bg-blue-50'
                    } ${!isScanning ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !isScanning && document.getElementById('document-upload').click()}
                  >
                    <input
                      type="file"
                      id="document-upload"
                      accept=".pdf,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isScanning}
                    />
                    
                    <div className="flex flex-col items-center">
                      {isScanning ? (
                        <>
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                          <span className="text-lg font-medium text-gray-700 mb-2">
                            Scanning Document...
                          </span>
                          <span className="text-sm text-gray-500">
                            AI is analyzing your document and extracting data
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-12 h-12 text-blue-500 mb-4" />
                          <span className="text-lg font-medium text-gray-700 mb-2">
                            {dragActive ? 'Drop your document here' : 'Click to upload or drag & drop'}
                          </span>
                          <span className="text-sm text-gray-500 mb-4">
                            Supports PDF, PNG, JPG, JPEG files (max 10MB)
                          </span>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>✓ Secure Processing</span>
                            <span>✓ Auto-Delete After Scan</span>
                            <span>✓ AI-Powered Extraction</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Scan Results */}
                  {scanResults && (
                    <div className={`mt-6 rounded-lg p-4 ${
                      scanResults.success 
                        ? 'bg-green-50 border border-green-200' 
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-3">
                        {scanResults.success ? (
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        
                        <div className="flex-1">
                          <h4 className={`font-semibold mb-2 ${
                            scanResults.success ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {scanResults.success ? 'Document Processed Successfully!' : 'Processing Failed'}
                          </h4>
                          
                          {scanResults.success ? (
                            <div className="text-green-700 space-y-2">
                              <p className="text-sm">
                                ✅ Data has been automatically extracted and filled into the form fields.
                              </p>
                              <p className="text-sm font-medium">
                                Please review all tabs to verify the information before generating your contract.
                              </p>
                              
                              {scanResults.fieldsExtracted && scanResults.fieldsExtracted.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-sm font-medium mb-2">Fields Successfully Extracted:</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {scanResults.fieldsExtracted.map((field, index) => (
                                      <div key={index} className="flex items-center gap-2 text-xs">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-red-700">
                              <p className="text-sm">❌ {scanResults.error}</p>
                              <p className="text-xs mt-1">
                                Please try uploading a clearer image or check that the document contains contract information.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* How It Works Section */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-amber-800 mb-4 flex items-center gap-2">
                    <Scan className="w-5 h-5" />
                    How Document Scanning Works
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                        <div>
                          <h4 className="font-medium text-amber-800">Upload Document</h4>
                          <p className="text-sm text-amber-700">Upload a PDF or image of an existing sales contract</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                        <div>
                          <h4 className="font-medium text-amber-800">AI Analysis</h4>
                          <p className="text-sm text-amber-700">Our AI extracts key information like company details, products, and pricing</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                        <div>
                          <h4 className="font-medium text-amber-800">Auto-Fill Form</h4>
                          <p className="text-sm text-amber-700">The form is automatically populated with extracted data</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
                        <div>
                          <h4 className="font-medium text-amber-800">Review & Generate</h4>
                          <p className="text-sm text-amber-700">Review the information and generate a professional contract</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Supported Formats */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Supported Document Types</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="w-4 h-4 text-red-500" />
                      <span>PDF Documents</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Camera className="w-4 h-4 text-blue-500" />
                      <span>PNG Images</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Camera className="w-4 h-4 text-green-500" />
                      <span>JPG/JPEG Images</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Upload className="w-4 h-4 text-purple-500" />
                      <span>Up to 10MB</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Company Info Tab */}
            {activeTab === 'company' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Company Information
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                    <input
                      type="text"
                      value={contract.companyInfo.name}
                      onChange={(e) => updateNestedField('companyInfo', 'name', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Your Company Name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ABN</label>
                    <input
                      type="text"
                      value={contract.companyInfo.abn}
                      onChange={(e) => updateNestedField('companyInfo', 'abn', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="XX XXX XXX XXX"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                    <textarea
                      value={contract.companyInfo.address}
                      onChange={(e) => updateNestedField('companyInfo', 'address', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                      placeholder="Full company address"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={contract.companyInfo.email}
                      onChange={(e) => updateNestedField('companyInfo', 'email', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="contact@company.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={contract.companyInfo.phone}
                      onChange={(e) => updateNestedField('companyInfo', 'phone', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+61 X XXXX XXXX"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Contract Details Tab */}
            {activeTab === 'contract' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Contract Details
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contract Number</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={contract.contractNumber}
                        onChange={(e) => setContract(prev => ({ ...prev, contractNumber: e.target.value }))}
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="SC25055"
                      />
                      <button
                        onClick={() => setContract(prev => ({ ...prev, contractNumber: generateContractNumber() }))}
                        className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Order Reference</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={contract.orderReference}
                        onChange={(e) => setContract(prev => ({ ...prev, orderReference: e.target.value }))}
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="VP45845"
                      />
                      <button
                        onClick={() => setContract(prev => ({ ...prev, orderReference: generateOrderReference() }))}
                        className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={contract.date}
                      onChange={(e) => setContract(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Shipment Date</label>
                    <input
                      type="text"
                      value={contract.shipmentDate}
                      onChange={(e) => setContract(prev => ({ ...prev, shipmentDate: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Early August 2025"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Customer Info Tab */}
            {activeTab === 'customer' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer Information
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                    <input
                      type="text"
                      value={contract.customer.companyName}
                      onChange={(e) => updateNestedField('customer', 'companyName', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Customer Company Name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
                    <input
                      type="text"
                      value={contract.customer.contactPerson}
                      onChange={(e) => updateNestedField('customer', 'contactPerson', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Contact Person Name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={contract.customer.email}
                      onChange={(e) => updateNestedField('customer', 'email', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="customer@email.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={contract.customer.phone}
                      onChange={(e) => updateNestedField('customer', 'phone', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+61 X XXXX XXXX"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
                    <textarea
                      value={contract.customer.deliveryAddress}
                      onChange={(e) => updateNestedField('customer', 'deliveryAddress', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                      placeholder="Full delivery address"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Attention To</label>
                    <input
                      type="text"
                      value={contract.customer.attentionTo}
                      onChange={(e) => updateNestedField('customer', 'attentionTo', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Specific person to contact"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Products & Services
                  </h2>
                  <button
                    onClick={addProduct}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Product
                  </button>
                </div>
                
                <div className="space-y-4">
                  {contract.products.map((product, index) => (
                    <div key={product.id} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-800">Product {index + 1}</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() => duplicateProduct(product.id)}
                            className="text-blue-600 hover:text-blue-800 p-2"
                            title="Duplicate Product"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {contract.products.length > 1 && (
                            <button
                              onClick={() => removeProduct(product.id)}
                              className="text-red-600 hover:text-red-800 p-2"
                              title="Remove Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Item Code</label>
                          <input
                            type="text"
                            value={product.itemCode}
                            onChange={(e) => updateProduct(product.id, 'itemCode', e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="FB40-CUSTOM"
                          />
                        </div>
                        
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                          <input
                            type="text"
                            value={product.description}
                            onChange={(e) => updateProduct(product.id, 'description', e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Product description"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                          <input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => updateProduct(product.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price (AUD)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={product.unitPrice}
                            onChange={(e) => updateProduct(product.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (AUD)</label>
                          <input
                            type="text"
                            value={formatCurrency(product.amount)}
                            readOnly
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                          />
                        </div>
                        
                        <div className="md:col-span-2 lg:col-span-6">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Specifications</label>
                          <textarea
                            value={product.specifications}
                            onChange={(e) => updateProduct(product.id, 'specifications', e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows="3"
                            placeholder="Detailed specifications, threading details, etc."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Totals */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-lg">
                      <span className="font-medium">Subtotal:</span>
                      <span>{formatCurrency(contract.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span className="font-medium">GST ({contract.gstRate}%):</span>
                      <span>{formatCurrency(contract.gst)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-blue-700 border-t border-blue-200 pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(contract.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Terms & Payment Tab */}
            {activeTab === 'terms' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Terms & Payment
                </h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                      <textarea
                        value={contract.paymentTerms}
                        onChange={(e) => setContract(prev => ({ ...prev, paymentTerms: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows="3"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Terms</label>
                      <textarea
                        value={contract.deliveryTerms}
                        onChange={(e) => setContract(prev => ({ ...prev, deliveryTerms: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows="3"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Additional Terms</label>
                      <textarea
                        value={contract.additionalTerms}
                        onChange={(e) => setContract(prev => ({ ...prev, additionalTerms: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows="3"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-4">Bank Details</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                          <input
                            type="text"
                            value={contract.bankDetails.bankName}
                            onChange={(e) => updateNestedField('bankDetails', 'bankName', e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">BSB</label>
                          <input
                            type="text"
                            value={contract.bankDetails.bsb}
                            onChange={(e) => updateNestedField('bankDetails', 'bsb', e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                          <input
                            type="text"
                            value={contract.bankDetails.accountNumber}
                            onChange={(e) => updateNestedField('bankDetails', 'accountNumber', e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                          <input
                            type="text"
                            value={contract.bankDetails.accountName}
                            onChange={(e) => updateNestedField('bankDetails', 'accountName', e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-4">Documentation Required</h3>
                      <div className="space-y-3">
                        {contract.documentation.map((doc, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={doc}
                              onChange={(e) => updateDocumentation(index, e.target.value)}
                              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Documentation item"
                            />
                            <button
                              onClick={() => removeDocumentation(index)}
                              className="text-red-600 hover:text-red-800 p-3"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={addDocumentation}
                          className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                        >
                          <Plus className="w-4 h-4 inline mr-2" />
                          Add Documentation Item
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Signatures Tab */}
            {activeTab === 'signatures' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Signatures
                </h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-blue-800 mb-4">Supplier Signatory</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input
                          type="text"
                          value={contract.supplierSignatory.name}
                          onChange={(e) => updateNestedField('supplierSignatory', 'name', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Signatory name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Title/Company</label>
                        <input
                          type="text"
                          value={contract.supplierSignatory.title}
                          onChange={(e) => updateNestedField('supplierSignatory', 'title', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Title or company name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                        <input
                          type="date"
                          value={contract.supplierSignatory.date}
                          onChange={(e) => updateNestedField('supplierSignatory', 'date', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-green-800 mb-4">Customer Signatory</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input
                          type="text"
                          value={contract.customerSignatory.name}
                          onChange={(e) => updateNestedField('customerSignatory', 'name', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Customer signatory name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Title/Company</label>
                        <input
                          type="text"
                          value={contract.customerSignatory.title}
                          onChange={(e) => updateNestedField('customerSignatory', 'title', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Customer company name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                        <input
                          type="date"
                          value={contract.customerSignatory.date}
                          onChange={(e) => updateNestedField('customerSignatory', 'date', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Contract Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto max-h-[calc(95vh-80px)] bg-white">
              {/* Contract Preview Content - Exact Document Style */}
              <div className="max-w-4xl mx-auto bg-white">
                
                {/* Header with Logo and Company Info */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center">
                    <div className="border-2 border-teal-500 px-4 py-2 mr-4">
                      <div className="text-lg font-bold text-gray-800">AUSSIE STEEL DIRECT</div>
                      <div className="text-xs text-teal-500 font-medium tracking-wider">GET 'EM DIRECT</div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-bold text-lg">Aussie Steel Direct Pty Ltd</div>
                    <div className="mt-1"><strong>ABN:</strong> {contract.companyInfo.abn}</div>
                    <div>{contract.companyInfo.email}</div>
                    <div>{contract.companyInfo.phone}</div>
                  </div>
                </div>

                {/* Contract Header Info */}
                <div className="mb-6 text-sm">
                  <div className="flex justify-between">
                    <div>
                      <div><strong>Australian Business Number:</strong> {contract.companyInfo.abn}</div>
                      <div><strong>Company Address:</strong> {contract.companyInfo.address}</div>
                      <div><strong>Sales Contract:</strong> {contract.contractNumber}</div>
                    </div>
                    <div className="text-right">
                      <div><strong>PSA Pty Ltd Order Ref No:</strong> {contract.orderReference || '-'}</div>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-800 mb-6" />

                {/* Customer and Date Info */}
                <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
                  <div>
                    <div className="mb-4">
                      <strong>Customer:</strong> {contract.customer.companyName}
                    </div>
                    <div className="mb-4">
                      <strong>Delivery Address:</strong>
                      <div className="mt-1 whitespace-pre-line">{contract.customer.deliveryAddress}</div>
                    </div>
                    <div className="mb-4">
                      <strong>Attention to:</strong> {contract.customer.attentionTo}
                    </div>
                  </div>
                  <div className="text-right">
                    <div><strong>Date:</strong> {new Date(contract.date).toLocaleDateString('en-GB')}</div>
                  </div>
                </div>

                {/* Product Description */}
                <div className="mb-6 text-sm">
                  <div className="mb-2"><strong>We are pleased to advise that we will supply the following material:</strong></div>
                  
                  <div className="mb-4">
                    <strong>Product Description:</strong>
                    <div className="mt-1">
                      {contract.products.map((product, index) => (
                        <div key={product.id} className="mb-1">
                          {product.description} {product.specifications && `(${product.specifications})`}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <strong>Total Quantity:</strong> {contract.products.reduce((sum, p) => sum + (p.quantity || 0), 0).toLocaleString()} pieces
                  </div>

                  <div className="mb-4">
                    <strong>Payment Terms:</strong> {contract.paymentTerms}
                  </div>

                  <div className="mb-4">
                    <strong>Delivery Terms:</strong> {contract.deliveryTerms}
                  </div>

                  <div className="mb-4">
                    <strong>Total Amount:</strong> {formatCurrency(contract.total)} GST inclusive
                  </div>

                  <div className="mb-4">
                    <strong>Bank details:</strong>
                    <div className="mt-1">
                      {contract.bankDetails.bankName}<br />
                      {contract.bankDetails.accountName}<br />
                      BSB: {contract.bankDetails.bsb}<br />
                      Account: {contract.bankDetails.accountNumber}
                    </div>
                  </div>

                  <div className="mb-4">
                    <strong>Packing:</strong> Bars will be packed in bundles on top of pieces steel pallets, separated in the middle, with steel pieces placed below and on top of each bundle for ease of forklift handling.
                  </div>

                  {contract.shipmentDate && (
                    <div className="mb-4">
                      <strong>Shipment:</strong> {contract.shipmentDate}
                    </div>
                  )}

                  <div className="mb-4">
                    <strong>Documentation:</strong> {contract.documentation.join(', ')}
                  </div>
                </div>

                {/* Bottom Terms */}
                <div className="text-sm space-y-3 mb-8">
                  {contract.additionalTerms && (
                    <div>{contract.additionalTerms}</div>
                  )}
                  
                  <div><strong>Duties / Taxes:</strong> Any changes in government or export taxes into Aussie Steel Direct's accounts.</div>
                  
                  <div><strong>Other terms of this Contract shall be as per INCOTERMS 2020.</strong></div>
                </div>

                {/* PAGE 2 - Products Table */}
                <div className="border-t-2 border-gray-300 pt-8 mb-8">
                  {/* Header repeat for page 2 */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center">
                      <div className="border-2 border-teal-500 px-4 py-2 mr-4">
                        <div className="text-lg font-bold text-gray-800">AUSSIE STEEL DIRECT</div>
                        <div className="text-xs text-teal-500 font-medium tracking-wider">GET 'EM DIRECT</div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-bold text-lg">Aussie Steel DirectPty Ltd</div>
                      <div className="mt-1"><strong>ABN:</strong> {contract.companyInfo.abn}</div>
                      <div>{contract.companyInfo.email}</div>
                      <div>{contract.companyInfo.phone}</div>
                    </div>
                  </div>

                  <div className="text-sm mb-4">
                    <strong>Sales Contract:</strong> {contract.contractNumber} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>PSA Pty Ltd Order Ref No:</strong> {contract.orderReference || '-'}
                  </div>

                  {/* Products Table */}
                  <table className="w-full border border-gray-800 text-sm mb-6">
                    <thead className="bg-teal-400">
                      <tr>
                        <th className="border border-gray-800 p-2 text-left font-bold">Item</th>
                        <th className="border border-gray-800 p-2 text-left font-bold">Description of Goods</th>
                        <th className="border border-gray-800 p-2 text-center font-bold">Price<br />(AUD per<br />bar)</th>
                        <th className="border border-gray-800 p-2 text-center font-bold">Qty<br />(pieces)</th>
                        <th className="border border-gray-800 p-2 text-center font-bold">Amount<br />(AUD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contract.products.map((product, index) => (
                        <tr key={product.id}>
                          <td className="border border-gray-800 p-2 font-medium">{product.itemCode}</td>
                          <td className="border border-gray-800 p-2">
                            {product.description}
                            {product.specifications && (
                              <div className="text-xs mt-1">{product.specifications}</div>
                            )}
                          </td>
                          <td className="border border-gray-800 p-2 text-center">
                            ${product.unitPrice?.toFixed(2) || '0.00'}
                          </td>
                          <td className="border border-gray-800 p-2 text-center">{product.quantity?.toLocaleString() || '0'}</td>
                          <td className="border border-gray-800 p-2 text-center">
                            ${product.amount?.toFixed(2) || '0.00'}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="border border-gray-800 p-2 font-bold" colSpan="3">Sundry Total</td>
                        <td className="border border-gray-800 p-2 text-center font-bold">{contract.products.reduce((sum, p) => sum + (p.quantity || 0), 0).toLocaleString()}</td>
                        <td className="border border-gray-800 p-2 text-center font-bold">${contract.subtotal?.toFixed(2) || '0.00'}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-800 p-2" colSpan="3"></td>
                        <td className="border border-gray-800 p-2 text-right font-bold">Sales Amount :</td>
                        <td className="border border-gray-800 p-2 text-center font-bold">${contract.subtotal?.toFixed(2) || '0.00'}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-800 p-2" colSpan="3"></td>
                        <td className="border border-gray-800 p-2 text-right font-bold">GST (10%) :</td>
                        <td className="border border-gray-800 p-2 text-center font-bold">${contract.gst?.toFixed(2) || '0.00'}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-800 p-2" colSpan="3"></td>
                        <td className="border border-gray-800 p-2 text-right font-bold">Total Contract (incl. GST) :</td>
                        <td className="border border-gray-800 p-2 text-center font-bold">${contract.total?.toFixed(2) || '0.00'}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-800 p-3" colSpan="5">
                          <div className="font-bold mb-2">20% DEPOSIT PAYMENT DUE</div>
                          <div className="font-bold mb-2">BALANCE OF PAYMENT MAY BE MADE BY DIRECT DEPOSIT UPON MATURITY</div>
                          <div className="flex justify-between">
                            <div>
                              <div><strong>Bank :</strong> {contract.bankDetails.bankName}</div>
                              <div><strong>BSB :</strong> {contract.bankDetails.bsb}</div>
                              <div><strong>ACC :</strong> {contract.bankDetails.accountNumber}</div>
                            </div>
                            <div>
                              <div><strong>Acc Name :</strong> {contract.bankDetails.accountName}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-16 pt-16">
                  <div>
                    <div className="text-sm font-bold mb-8">Signed for and on behalf of</div>
                    <div className="border-b border-gray-800 mb-4 pb-12"></div>
                    <div className="text-sm">
                      <div className="font-bold">{contract.supplierSignatory.name}</div>
                      <div>ABN: {contract.companyInfo.abn}</div>
                      <div>Date: {new Date(contract.supplierSignatory.date).toLocaleDateString('en-GB')}</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-bold mb-8">Signed for and on behalf of</div>
                    <div className="border-b border-gray-800 mb-4 pb-12"></div>
                    <div className="text-sm">
                      <div className="font-bold">{contract.customerSignatory.name || contract.customer.companyName}</div>
                      <div>ABN: 83 158 619 268</div>
                      <div>Date: {contract.customerSignatory.date ? new Date(contract.customerSignatory.date).toLocaleDateString('en-GB') : new Date(contract.date).toLocaleDateString('en-GB')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesContractFormBuilder;