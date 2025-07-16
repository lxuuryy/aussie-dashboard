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
  ChevronDown,
  Search,
  Shield,
  Tag,
  Ruler,
  Weight,
  Calculator
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
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showContractGenerator, setShowContractGenerator] = useState(false);

  // Product selection state
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);

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
    items: [{
      itemCode: '',
      productName: '',
      description: '',
      category: '',
      material: '',
      finish: '',
      dimensions: {
        length: '',
        width: '',
        height: '',
        diameter: '',
        thickness: '',
        unit: 'mm'
      },
      specifications: [],
      tags: [],
      quantity: 0,
      unitPrice: 0,
      pricePerUnit: 'each',
      currency: 'AUD',
      totalWeight: 0,
      isACRSCertified: false
    }],
    estimatedDelivery: '',
    reference: '',
    notes: '',
    authorizedEmails: [],
    contractTerms: {
      paymentTerms: '30 Days from delivery to yard',
      deliveryTerms: 'Delivery Duty paid - unloading by purchaser',
      quantityTolerance: '+/- 10%',
      invoicingBasis: 'Theoretical Weight',
      packing: "Mill's Standard for Export",
      documentation: 'Commercial Invoice\nCertificate of Origin\nMill Test Certificates\nACRS Certification'
    }
  });

  // Load order data, company data, and products
  useEffect(() => {
    if (orderId) {
      fetchOrder();
      fetchProducts();
    }
  }, [orderId]);

  // Filter products based on search
  useEffect(() => {
    if (!productSearch) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.itemCode?.toLowerCase().includes(productSearch.toLowerCase()) ||
        product.productName?.toLowerCase().includes(productSearch.toLowerCase()) ||
        product.description?.toLowerCase().includes(productSearch.toLowerCase()) ||
        product.category?.toLowerCase().includes(productSearch.toLowerCase()) ||
        product.material?.toLowerCase().includes(productSearch.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [products, productSearch]);

  const fetchProducts = async () => {
    try {
      const productsQuery = query(collection(db, 'products'));
      const productsSnapshot = await getDocs(productsQuery);
      
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setProducts(productsData.filter(p => p.isActive)); // Only active products
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const orderDoc = await getDoc(doc(db, 'orders', orderId));

      if (!orderDoc.exists()) {
        setError('Order not found');
        return;
      }

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
      console.log('Order data loaded:', orderData);

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
      
      // Items - Convert from order data structure
      items: orderData.items ? orderData.items.map(item => ({
        itemCode: item.itemCode || '',
        productName: item.productName || item.barType || '',
        description: item.description || '',
        category: item.category || '',
        material: item.material || '',
        finish: item.finish || '',
        dimensions: {
          length: item.dimensions?.length || item.length || '',
          width: item.dimensions?.width || '',
          height: item.dimensions?.height || '',
          diameter: item.dimensions?.diameter || '',
          thickness: item.dimensions?.thickness || '',
          unit: item.dimensions?.unit || 'mm'
        },
        specifications: item.specifications || [],
        tags: item.tags || [],
        quantity: item.quantity || item.totalWeight || 0,
        unitPrice: item.unitPrice || item.pricePerTonne || 0,
        pricePerUnit: item.pricePerUnit || 'each',
        currency: item.currency || 'AUD',
        totalWeight: item.totalWeight || item.quantity || 0,
        isACRSCertified: item.isACRSCertified || false,
        weight: item.weight || null
      })) : [{
        itemCode: '',
        productName: '',
        description: '',
        category: '',
        material: '',
        finish: '',
        dimensions: {
          length: '',
          width: '',
          height: '',
          diameter: '',
          thickness: '',
          unit: 'mm'
        },
        specifications: [],
        tags: [],
        quantity: 0,
        unitPrice: 0,
        pricePerUnit: 'each',
        currency: 'AUD',
        totalWeight: 0,
        isACRSCertified: false
      }],
      
      // Terms and Conditions
      contractTerms: {
        paymentTerms: orderData.paymentTerms || '30 Days from delivery to yard',
        deliveryTerms: orderData.deliveryTerms || 'Delivery Duty paid - unloading by purchaser',
        quantityTolerance: orderData.quantityTolerance || '+/- 10%',
        invoicingBasis: orderData.invoicingBasis || 'Theoretical Weight',
        packing: orderData.packing || "Mill's Standard for Export",
        documentation: orderData.documentation || 'Commercial Invoice\nCertificate of Origin\nMill Test Certificates\nACRS Certification'
      },
      
      // Delivery Information
      estimatedDelivery: formatDateForInput(orderData.estimatedDelivery),
      shipmentDetails: orderData.shipmentDetails || '',
      
      // Additional Notes
      notes: orderData.notes || '',
      reference: orderData.reference || '',
      
      // Financial
      subtotal: orderData.subtotal || 0,
      gst: orderData.gst || 0,
      totalAmount: orderData.totalAmount || 0,
      
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

  const handleInputChange = (field, value, itemIndex = null) => {
    if (itemIndex !== null) {
      // Handle item-specific changes
      setFormData(prev => {
        const newItems = [...prev.items];
        if (field.includes('.')) {
          const fields = field.split('.');
          let current = newItems[itemIndex];
          for (let i = 0; i < fields.length - 1; i++) {
            if (!current[fields[i]]) current[fields[i]] = {};
            current = current[fields[i]];
          }
          current[fields[fields.length - 1]] = value;
        } else {
          newItems[itemIndex][field] = value;
        }
        return { ...prev, items: newItems };
      });
    } else {
      // Handle general form changes
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
    }
    setHasChanges(true);
  };

  const selectProduct = (product, itemIndex = 0) => {
    const updatedItem = {
      itemCode: product.itemCode,
      productName: product.productName,
      description: product.description,
      category: product.category,
      material: product.material,
      finish: product.finish || '',
      dimensions: {
        length: product.dimensions?.length || '',
        width: product.dimensions?.width || '',
        height: product.dimensions?.height || '',
        diameter: product.dimensions?.diameter || '',
        thickness: product.dimensions?.thickness || '',
        unit: product.dimensions?.unit || 'mm'
      },
      specifications: product.specifications || [],
      tags: product.tags || [],
      quantity: formData.items[itemIndex]?.quantity || 1,
      unitPrice: product.pricing?.unitPrice || 0,
      pricePerUnit: product.pricing?.pricePerUnit || 'each',
      currency: product.pricing?.currency || 'AUD',
      totalWeight: product.weight || 0,
      isACRSCertified: product.isACRSCertified || false,
      weight: product.weight || null
    };

    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[itemIndex] = updatedItem;
      return { ...prev, items: newItems };
    });

    setShowProductSelector(false);
    setProductSearch('');
    setHasChanges(true);
    
    // Calculate totals
    setTimeout(calculateTotals, 100);
  };

  const addNewItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        itemCode: '',
        productName: '',
        description: '',
        category: '',
        material: '',
        finish: '',
        dimensions: {
          length: '',
          width: '',
          height: '',
          diameter: '',
          thickness: '',
          unit: 'mm'
        },
        specifications: [],
        tags: [],
        quantity: 0,
        unitPrice: 0,
        pricePerUnit: 'each',
        currency: 'AUD',
        totalWeight: 0,
        isACRSCertified: false
      }]
    }));
    setHasChanges(true);
  };

  const removeItem = (itemIndex) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, index) => index !== itemIndex)
      }));
      setHasChanges(true);
      setTimeout(calculateTotals, 100);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    
    formData.items.forEach(item => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      subtotal += quantity * unitPrice;
    });
    
    const gst = subtotal * 0.1;
    const total = subtotal + gst;
    
    setFormData(prev => ({
      ...prev,
      subtotal: subtotal,
      gst: gst,
      totalAmount: total
    }));
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
        
        // Update items with full product data
        items: formData.items.map(item => ({
          itemCode: item.itemCode,
          productName: item.productName,
          description: item.description,
          category: item.category,
          material: item.material,
          finish: item.finish,
          dimensions: item.dimensions,
          specifications: item.specifications,
          tags: item.tags,
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseFloat(item.unitPrice) || 0,
          pricePerUnit: item.pricePerUnit,
          currency: item.currency,
          totalWeight: parseFloat(item.totalWeight) || parseFloat(item.quantity) || 0,
          isACRSCertified: item.isACRSCertified,
          weight: item.weight,
          // Legacy fields for backward compatibility
          barType: item.productName,
          length: item.dimensions?.length || '',
          pricePerTonne: item.pricePerUnit === 'tonne' ? item.unitPrice : 0
        })),
        
        subtotal: formData.subtotal,
        gst: formData.gst,
        totalAmount: formData.totalAmount,
        
        paymentTerms: formData.contractTerms.paymentTerms,
        deliveryTerms: formData.contractTerms.deliveryTerms,
        quantityTolerance: formData.contractTerms.quantityTolerance,
        invoicingBasis: formData.contractTerms.invoicingBasis,
        packing: formData.contractTerms.packing,
        documentation: formData.contractTerms.documentation,
        
        estimatedDelivery: formData.estimatedDelivery ? new Date(formData.estimatedDelivery) : order.estimatedDelivery,
        shipmentDetails: formData.shipmentDetails,
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

  const formatPrice = (price, currency = 'AUD') => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency
    }).format(price);
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  Product Information ({formData.items.length} item{formData.items.length !== 1 ? 's' : ''})
                </h3>
                <button
                  onClick={addNewItem}
                  className="px-3 py-1 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors flex items-center gap-1 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              {formData.items.map((item, itemIndex) => (
                <div key={itemIndex} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Item {itemIndex + 1}</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowProductSelector(true)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
                      >
                        <Search className="w-4 h-4" />
                        Select Product
                      </button>
                      {formData.items.length > 1 && (
                        <button
                          onClick={() => removeItem(itemIndex)}
                          className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-1 text-sm"
                        >
                          <X className="w-4 h-4" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Product Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
                        <input
                          type="text"
                          value={item.itemCode || ''}
                          onChange={(e) => handleInputChange('itemCode', e.target.value, itemIndex)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="FBSB321330"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                        <input
                          type="text"
                          value={item.productName || ''}
                          onChange={(e) => handleInputChange('productName', e.target.value, itemIndex)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="Product Name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={item.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value, itemIndex)}
                        rows="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Product description"
                      />
                    </div>

                    {/* Category, Material, Finish */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <input
                          type="text"
                          value={item.category || ''}
                          onChange={(e) => handleInputChange('category', e.target.value, itemIndex)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="Category"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Material</label>
                        <input
                          type="text"
                          value={item.material || ''}
                          onChange={(e) => handleInputChange('material', e.target.value, itemIndex)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="Material"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Finish</label>
                        <input
                          type="text"
                          value={item.finish || ''}
                          onChange={(e) => handleInputChange('finish', e.target.value, itemIndex)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="Finish"
                        />
                      </div>
                    </div>

                    {/* Dimensions */}
                    <div className="bg-white p-3 rounded-md border">
                      <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Ruler className="w-4 h-4" />
                        Dimensions
                      </h5>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Length</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.dimensions?.length || ''}
                            onChange={(e) => handleInputChange('dimensions.length', e.target.value, itemIndex)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            placeholder="1330"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Diameter</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.dimensions?.diameter || ''}
                            onChange={(e) => handleInputChange('dimensions.diameter', e.target.value, itemIndex)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            placeholder="32"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Unit</label>
                          <select
                            value={item.dimensions?.unit || 'mm'}
                            onChange={(e) => handleInputChange('dimensions.unit', e.target.value, itemIndex)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="mm">mm</option>
                            <option value="cm">cm</option>
                            <option value="m">m</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Pricing and Quantity */}
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                        <input
                          type="number"
                          step="0.1"
                          value={item.quantity || ''}
                          onChange={(e) => {
                            handleInputChange('quantity', parseFloat(e.target.value), itemIndex);
                            setTimeout(calculateTotals, 100);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice || ''}
                          onChange={(e) => {
                            handleInputChange('unitPrice', parseFloat(e.target.value), itemIndex);
                            setTimeout(calculateTotals, 100);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="14.92"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Per</label>
                        <select
                          value={item.pricePerUnit || 'each'}
                          onChange={(e) => handleInputChange('pricePerUnit', e.target.value, itemIndex)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="each">Each</option>
                          <option value="meter">Per Meter</option>
                          <option value="kg">Per Kg</option>
                          <option value="tonne">Per Tonne</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                        <select
                          value={item.currency || 'AUD'}
                          onChange={(e) => handleInputChange('currency', e.target.value, itemIndex)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="AUD">AUD</option>
                          <option value="USD">USD</option>
                          <option value="MYR">MYR</option>
                        </select>
                      </div>
                    </div>

                    {/* ACRS Certification */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`acrs-${itemIndex}`}
                        checked={item.isACRSCertified || false}
                        onChange={(e) => handleInputChange('isACRSCertified', e.target.checked, itemIndex)}
                        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                      <label htmlFor={`acrs-${itemIndex}`} className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Shield className="w-4 h-4 text-blue-600" />
                        ACRS Certified
                      </label>
                    </div>

                    {/* Tags Display */}
                    {item.tags && item.tags.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((tag, tagIndex) => (
                            <span key={tagIndex} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Item Total */}
                    <div className="bg-green-50 p-2 rounded border-l-4 border-green-400">
                      <div className="text-sm font-medium text-green-800">
                        Item Total: {formatPrice((item.quantity || 0) * (item.unitPrice || 0), item.currency)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                    value={formData.contractTerms?.paymentTerms || ''}
                    onChange={(e) => handleInputChange('contractTerms.paymentTerms', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="30 Days from delivery to yard"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Terms</label>
                  <input
                    type="text"
                    value={formData.contractTerms?.deliveryTerms || ''}
                    onChange={(e) => handleInputChange('contractTerms.deliveryTerms', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Delivery Duty paid - unloading by purchaser"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Tolerance</label>
                    <input
                      type="text"
                      value={formData.contractTerms?.quantityTolerance || ''}
                      onChange={(e) => handleInputChange('contractTerms.quantityTolerance', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder="+/- 10%"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Invoicing Basis</label>
                   <input
                     type="text"
                     value={formData.contractTerms?.invoicingBasis || ''}
                     onChange={(e) => handleInputChange('contractTerms.invoicingBasis', e.target.value)}
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder="Theoretical Weight"
                   />
                 </div>
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Packing</label>
                 <input
                   type="text"
                   value={formData.contractTerms?.packing || ''}
                   onChange={(e) => handleInputChange('contractTerms.packing', e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="Mill's Standard for Export"
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Documentation</label>
                 <textarea
                   value={formData.contractTerms?.documentation || ''}
                   onChange={(e) => handleInputChange('contractTerms.documentation', e.target.value)}
                   rows="3"
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="Commercial Invoice&#10;Certificate of Origin&#10;Mill Test Certificates&#10;ACRS Certification"
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

     {/* Product Selector Modal */}
     {showProductSelector && (
       <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
         <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ duration: 0.2 }}
           className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
         >
           <div className="bg-gradient-to-r from-teal-50 to-blue-50 border-b border-teal-100 p-6">
             <div className="flex items-center justify-between">
               <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                 <Package className="w-6 h-6 text-teal-600" />
                 Select Product
               </h2>
               <button
                 onClick={() => setShowProductSelector(false)}
                 className="p-2 hover:bg-teal-100 rounded-lg transition-colors"
               >
                 <X className="w-5 h-5 text-gray-500" />
               </button>
             </div>
             
             {/* Search */}
             <div className="mt-4 relative">
               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
               <input
                 type="text"
                 placeholder="Search products by code, name, category, material..."
                 value={productSearch}
                 onChange={(e) => setProductSearch(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
               />
             </div>
           </div>

           <div className="p-6 max-h-96 overflow-y-auto">
             {filteredProducts.length === 0 ? (
               <div className="text-center py-8 text-gray-500">
                 <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                 <p>No products found</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 gap-4">
                 {filteredProducts.map((product) => (
                   <div
                     key={product.id}
                     onClick={() => selectProduct(product)}
                     className="p-4 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50/50 cursor-pointer transition-all"
                   >
                     <div className="flex items-start justify-between">
                       <div className="flex-1">
                         <div className="flex items-center gap-2 mb-1">
                           <span className="font-medium text-gray-900">{product.itemCode}</span>
                           {product.isACRSCertified && (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                               <Shield className="w-3 h-3 mr-1" />
                               ACRS
                             </span>
                           )}
                         </div>
                         <h4 className="font-medium text-gray-900 mb-1">{product.productName}</h4>
                         <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                         
                         <div className="flex items-center gap-4 text-xs text-gray-500">
                           <span className="flex items-center gap-1">
                             <Tag className="w-3 h-3" />
                             {product.category}
                           </span>
                           <span>{product.material}</span>
                           {product.dimensions?.diameter && (
                             <span className="flex items-center gap-1">
                               <Ruler className="w-3 h-3" />
                               ⌀{product.dimensions.diameter}{product.dimensions.unit}
                             </span>
                           )}
                           {product.weight && (
                             <span className="flex items-center gap-1">
                               <Weight className="w-3 h-3" />
                               {product.weight}kg
                             </span>
                           )}
                         </div>
                         
                         {product.tags && product.tags.length > 0 && (
                           <div className="flex flex-wrap gap-1 mt-2">
                             {product.tags.slice(0, 3).map((tag, index) => (
                               <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                                 {tag}
                               </span>
                             ))}
                             {product.tags.length > 3 && (
                               <span className="text-xs text-gray-500">+{product.tags.length - 3}</span>
                             )}
                           </div>
                         )}
                       </div>
                       
                       <div className="text-right">
                         <div className="font-medium text-gray-900">
                           {formatPrice(product.pricing?.unitPrice, product.pricing?.currency)}
                         </div>
                         <div className="text-sm text-gray-500">
                           per {product.pricing?.pricePerUnit}
                         </div>
                         <div className="text-xs text-gray-500 mt-1">
                           Stock: {product.stock?.quantity || 0}
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
         </motion.div>
       </div>
     )}

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