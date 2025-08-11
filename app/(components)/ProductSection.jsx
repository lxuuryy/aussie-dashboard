'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Shield, ShoppingCart, Eye, Package, Search, Filter, Edit, CheckCircle, Users, Mail, X, Check, ChevronDown, AlertTriangle, Image, Tag, Ruler, Weight, DollarSign } from 'lucide-react';
import OrderForm from './OrderForm';

// Authorized Users Selector Component with mandatory validation
const AuthorizedUsersSelector = ({ 
  companyData, 
  selectedEmails, 
  setSelectedEmails, 
  isRequired = true,
  showError = false 
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Get authorized users from company data
  const authorizedUsers = companyData?.authorizedUsers || [];

  React.useEffect(() => {
    console.log('Authorized Users:', authorizedUsers);
  }, []);
  
  // Filter users based on search term
  const filteredUsers = authorizedUsers.filter(email => 
    email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEmailToggle = (email) => {
    if (selectedEmails.includes(email)) {
      setSelectedEmails(selectedEmails.filter(e => e !== email));
    } else {
      setSelectedEmails([...selectedEmails, email]);
    }
  };

  const handleRemoveEmail = (emailToRemove) => {
    setSelectedEmails(selectedEmails.filter(email => email !== emailToRemove));
  };

  const handleSelectAll = () => {
    if (selectedEmails.length === authorizedUsers.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails([...authorizedUsers]);
    }
  };

  return (
    <div className="space-y-4 bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/30 shadow-lg">
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-teal-600" />
        <label className="text-sm font-medium text-slate-700">
          Include Authorized Users in Order
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>

      {/* Error Message */}
      {showError && selectedEmails.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            You must select at least one authorized user before placing the order.
          </p>
        </motion.div>
      )}

      {/* Selected Emails Display */}
      {selectedEmails.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">Selected users ({selectedEmails.length}):</p>
          <div className="flex flex-wrap gap-2">
            {selectedEmails.map((email) => (
              <motion.div
                key={email}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 border border-teal-200"
              >
                <Mail className="w-3 h-3" />
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  className="hover:bg-teal-200 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown Selector with validation styling */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`w-full backdrop-blur-sm border rounded-xl px-4 py-3 text-left focus:outline-none focus:ring-2 transition-all duration-200 hover:bg-white/80 flex items-center justify-between ${
            showError && selectedEmails.length === 0 
              ? 'bg-red-50/70 border-red-300 focus:ring-red-500 focus:border-red-500' 
              : 'bg-white/70 border-white/40 focus:ring-teal-500 focus:border-teal-500'
          }`}
        >
          <span className={showError && selectedEmails.length === 0 ? 'text-red-700' : 'text-slate-700'}>
            {selectedEmails.length > 0 
              ? `${selectedEmails.length} user${selectedEmails.length > 1 ? 's' : ''} selected`
              : 'Select authorized users'
            }
          </span>
          <ChevronDown 
            className={`w-4 h-4 transition-transform duration-200 ${
              isDropdownOpen ? 'transform rotate-180' : ''
            } ${showError && selectedEmails.length === 0 ? 'text-red-500' : 'text-slate-500'}`}
          />
        </button>

        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className=" bg-white/95 backdrop-blur-xl border border-white/40 rounded-xl shadow-xl z-[9999]  overflow-scroll w-full"
            style={{ zIndex: 9999 }}
          >
            {/* Search Input */}
            <div className="p-3 border-b border-white/20">
              <input
                type="text"
                placeholder="Search authorized users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/50 border border-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Select All Option */}
            {authorizedUsers.length > 1 && (
              <div className="p-2 border-b border-white/20">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50/50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    selectedEmails.length === authorizedUsers.length
                      ? 'bg-teal-500 border-teal-500'
                      : 'border-slate-300'
                  }`}>
                    {selectedEmails.length === authorizedUsers.length && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="font-medium text-teal-700">
                    {selectedEmails.length === authorizedUsers.length ? 'Deselect All' : 'Select All'}
                  </span>
                </button>
              </div>
            )}

            {/* User List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((email) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => handleEmailToggle(email)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50/50 transition-colors flex items-center gap-3 border-b border-white/10 last:border-b-0"
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      selectedEmails.includes(email)
                        ? 'bg-teal-500 border-teal-500'
                        : 'border-slate-300'
                    }`}>
                      {selectedEmails.includes(email) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-700">{email}</span>
                      </div>
                      {email === companyData?.superAdmin && (
                        <span className="text-xs text-teal-600 font-medium">Super Admin</span>
                      )}
                      {companyData?.admins?.includes(email) && email !== companyData?.superAdmin && (
                        <span className="text-xs text-blue-600 font-medium">Admin</span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500 text-sm">
                  {searchTerm ? 'No users found matching your search' : 'No authorized users available'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Helper Text */}
      <p className={`text-xs ${showError && selectedEmails.length === 0 ? 'text-red-600' : 'text-slate-500'}`}>
        {isRequired ? 'You must select at least one authorized user to proceed with the order.' : 'Select authorized users who should be included in this order. Only users authorized for your company will appear in the list.'}
      </p>
    </div>
  );
};

const ProductSection = ({ 
  products , // Updated from steelProducts to products
  companyData, 
  user, 
  getUserEmail, 
  onOrderSubmit,
  formatCurrency,
  formatDate 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMaterial, setSelectedMaterial] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [selectedAuthorizedEmails, setSelectedAuthorizedEmails] = useState([]);
  const [showAuthError, setShowAuthError] = useState(false);
  const [orderFormData, setOrderFormData] = useState({
    quantity: 1,
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
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    reference: '',
    notes: ''
  });

  // Get unique categories and materials for filtering
  const categories = [...new Set(products?.map(p => p.category).filter(Boolean))] || [];
  const materials = [...new Set(products?.map(p => p.material).filter(Boolean))] || [];

  // Handle order form with company data pre-fill
  const handleOrderNow = (product) => {
    setSelectedProduct(product);
    setIsOrderFormOpen(true);
    setShowAuthError(false);
    
    // Pre-fill form with company data and user data
    if (companyData && user) {
      setOrderFormData(prev => ({
        ...prev,
        customerInfo: {
          companyName: companyData.companyName || '',
          contactPerson: companyData.contactPerson || user.fullName || '',
          email: companyData.email || getUserEmail() || '',
          phone: companyData.phone || '',
          address: {
            street: companyData.address?.street || '',
            city: companyData.address?.city || '',
            state: companyData.address?.state || '',
            postcode: companyData.address?.postcode || '',
            country: companyData.address?.country || 'Australia'
          }
        }
      }));
    } else if (user) {
      setOrderFormData(prev => ({
        ...prev,
        customerInfo: {
          ...prev.customerInfo,
          email: getUserEmail() || '',
          contactPerson: user.fullName || ''
        }
      }));
    }
  };

  const handleCloseOrderForm = () => {
    setIsOrderFormOpen(false);
    setSelectedProduct(null);
    setIsSubmittingOrder(false);
    setSelectedAuthorizedEmails([]);
    setShowAuthError(false);
    setOrderFormData({
      quantity: 1,
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
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: '',
      reference: '',
      notes: ''
    });
  };

  const handleFormDataChange = (field, value) => {
    if (field.includes('.')) {
      const fields = field.split('.');
      setOrderFormData(prev => {
        const newData = { ...prev };
        let current = newData;
        for (let i = 0; i < fields.length - 1; i++) {
          current = current[fields[i]];
        }
        current[fields[fields.length - 1]] = value;
        return newData;
      });
    } else {
      setOrderFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const calculateTotals = () => {
    if (!selectedProduct) return { subtotal: 0, gst: 0, total: 0 };
    
    // Use the product's pricing structure
    const unitPrice = selectedProduct.pricing?.unitPrice || selectedProduct.pricePerTonne || 0;
    const subtotal = unitPrice * orderFormData.quantity;
    const gst = subtotal * 0.1; // 10% GST
    const total = subtotal + gst;
    
    return { subtotal, gst, total };
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    
    if (!selectedProduct) return;
    
    // Validate authorized users selection
    if (companyData && companyData.authorizedUsers && companyData.authorizedUsers.length > 0 && selectedAuthorizedEmails.length === 0) {
      setShowAuthError(true);
      const authUsersSection = document.querySelector('.authorized-users-section');
      if (authUsersSection) {
        authUsersSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    try {
      setIsSubmittingOrder(true);
      setShowAuthError(false);
      
      // Create order-compatible product structure
      const orderProduct = {
        // Map product fields to order-compatible fields
        itemCode: selectedProduct.itemCode,
        productName: selectedProduct.productName,
        barType: selectedProduct.productName || selectedProduct.itemCode, // For backward compatibility
        description: selectedProduct.description,
        category: selectedProduct.category,
        material: selectedProduct.material,
        length: selectedProduct.dimensions?.length ? 
          `${selectedProduct.dimensions.length}${selectedProduct.dimensions.unit}` : 
          '',
        dimensions: selectedProduct.dimensions,
        weight: selectedProduct.weight,
        finish: selectedProduct.finish,
        specifications: selectedProduct.specifications,
        tags: selectedProduct.tags,
        imageUrl: selectedProduct.imageUrl,
        
        // Pricing information
        pricePerTonne: selectedProduct.pricing?.unitPrice || 0,
        unitPrice: selectedProduct.pricing?.unitPrice || 0,
        currency: selectedProduct.pricing?.currency || 'AUD',
        pricePerUnit: selectedProduct.pricing?.pricePerUnit || 'each',
        
        // Stock information
        stock: selectedProduct.stock,
        
        // Create a sales contract reference
        notes: selectedProduct.description || ''
      };
      
      await onOrderSubmit({
        selectedProduct: orderProduct,
        orderFormData: {
          ...orderFormData,
          authorizedEmails: selectedAuthorizedEmails
        },
        calculateTotals: calculateTotals()
      });
      
      handleCloseOrderForm();
      
    } catch (error) {
      console.error('Error submitting order:', error);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Enhanced filtering logic for products
  const filteredProducts = products?.filter(product => {
    if (!product.isActive) return false; // Only show active products
    
    const matchesSearch = 
      product.itemCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.material?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesMaterial = selectedMaterial === 'all' || product.material === selectedMaterial;
    
    // Enhanced filter options
    let matchesFilter = true;
    if (filterBy === 'in-stock') {
      matchesFilter = (product.stock?.quantity || 0) > 0;
    } else if (filterBy === 'low-stock') {
      matchesFilter = (product.stock?.quantity || 0) <= (product.stock?.minStock || 0);
    } else if (filterBy === 'with-images') {
      matchesFilter = !!product.imageUrl;
    } else if (filterBy === 'with-specs') {
      matchesFilter = product.specifications && product.specifications.length > 0;
    }
    
    return matchesSearch && matchesCategory && matchesMaterial && matchesFilter;
  }) || [];

  // Format dimensions for display
  const formatDimensions = (product) => {
    const dims = product.dimensions;
    if (!dims) return 'Standard';
    
    const parts = [];
    if (dims.length) parts.push(`L: ${dims.length}${dims.unit}`);
    if (dims.width) parts.push(`W: ${dims.width}${dims.unit}`);
    if (dims.height) parts.push(`H: ${dims.height}${dims.unit}`);
    if (dims.diameter) parts.push(`⌀: ${dims.diameter}${dims.unit}`);
    if (dims.thickness) parts.push(`T: ${dims.thickness}${dims.unit}`);
    
    return parts.length > 0 ? parts.join(' × ') : 'Standard';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="space-y-6 border-t border-white/30 pt-12"
    >
      {/* Products Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/5 via-teal-900/10 to-blue-900/5 rounded-2xl blur-xl"></div>
        <div className="relative bg-gradient-to-br from-white/70 via-white/50 to-white/40 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-white/50 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex justify-center sm:justify-start">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-emerald-700 via-teal-600 to-emerald-800 rounded-xl flex items-center justify-center shadow-xl">
                <Package className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
            
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-light mb-2">
                <span className="bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-900 bg-clip-text text-transparent">
                  Product Catalog
                </span>
              </h2>
              <p className="text-slate-600/80 text-sm sm:text-lg">
                Browse our comprehensive steel and metal product inventory
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Search and Filter Bar */}
      <div className="bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/30 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-teal-600/60" />
            <input
              type="text"
              placeholder="Search products by code, name, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-white/30 bg-white/20 backdrop-blur-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent text-teal-800 placeholder-teal-600/50 transition-all duration-200"
            />
          </div>
          
          {/* Category Filter */}
          {categories.length > 0 && (
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-white/30 bg-white/20 backdrop-blur-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent text-teal-800 transition-all duration-200"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Material Filter */}
          {materials.length > 0 && (
            <div>
              <select
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-white/30 bg-white/20 backdrop-blur-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent text-teal-800 transition-all duration-200"
              >
                <option value="all">All Materials</option>
                {materials.map(material => (
                  <option key={material} value={material}>{material}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
     
        
      </div>

      {/* Order Form */}
      <AnimatePresence>
        {isOrderFormOpen && selectedProduct && (
          <>
            {companyData && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-teal-50/90 backdrop-blur-sm border border-teal-200/50 rounded-lg p-4 text-center mb-4"
              >
                <div className="flex items-center justify-center gap-2 text-teal-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">
                    Form auto-filled with {companyData.companyName} details - you can edit any field as needed
                  </span>
                  <Edit className="w-4 h-4" />
                </div>
              </motion.div>
            )}
            
            {/* Mandatory Authorized Users Selector */}
            {companyData && companyData.authorizedUsers && companyData.authorizedUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="authorized-users-section"
              >
                <AuthorizedUsersSelector
                  companyData={companyData}
                  selectedEmails={selectedAuthorizedEmails}
                  setSelectedEmails={setSelectedAuthorizedEmails}
                  isRequired={true}
                  showError={showAuthError}
                />
              </motion.div>
            )}
            
            <OrderForm
              selectedProduct={selectedProduct}
              orderFormData={orderFormData}
              isSubmitting={isSubmittingOrder}
              onClose={handleCloseOrderForm}
              onFormDataChange={handleFormDataChange}
              onSubmit={handleSubmitOrder}
              calculateTotals={calculateTotals}
              formatCurrency={formatCurrency}
            />
          </>
        )}
      </AnimatePresence>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
        {filteredProducts.map((product) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white/40 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg md:hover:shadow-xl md:hover:border-teal-300/50 md:hover:scale-[1.02] transition-all duration-200 flex flex-col overflow-hidden"
          >
            {/* Product Image */}
            {product.imageUrl && (
              <div className="relative h-48 bg-gray-100/50">
                <img
                  src={product.imageUrl}
                  alt={product.productName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2">
                  <div className="bg-white/80 backdrop-blur-sm rounded-full p-1">
                    <Image className="w-4 h-4 text-teal-600" />
                  </div>
                </div>
              </div>
            )}
            
            <div className="p-6 flex flex-col flex-1">
  {/* Product Header */}
  <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/20">
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-lg font-semibold text-teal-800">{product.productName}</h3>
        {product.itemCode && (
          <span className="bg-teal-100/50 text-teal-700 px-2 py-0.5 rounded text-xs font-medium">
            {product.itemCode}
          </span>
        )}
      </div>
      
      
      
    </div>
  </div>
  
  {/* Product Details */}
 <div className="space-y-3 mb-4 flex-1">
   <div className="flex justify-between items-center border-b border-white/10 pb-2">
     <span className="text-teal-700/70 flex items-center gap-1">
       <Tag className="w-3 h-3" />
       Material:
     </span>
     <span className="font-medium text-teal-800 bg-teal-100/50 px-2 py-1 rounded border border-teal-200/50 text-sm">
       {product.material}
     </span>
   </div>
   
   
   
   {product.weight && (
     <div className="flex justify-between items-center border-b border-white/10 pb-2">
       <span className="text-teal-700/70 flex items-center gap-1">
         <Weight className="w-3 h-3" />
         Weight:
       </span>
       <span className="font-medium text-teal-800 text-sm">{product.weight}kg</span>
     </div>
   )}
   
   <div className="flex justify-between items-center border-b border-white/10 pb-2">
     <span className="text-teal-700/70 flex items-center gap-1">
       <DollarSign className="w-3 h-3" />
       Price:
     </span>
     <span className="font-medium text-teal-600 bg-teal-100/50 px-2 py-1 rounded border border-teal-200/50 text-sm">
       {formatCurrency(product.pricing?.unitPrice || 0)} / {product.pricing?.pricePerUnit || 'each'}
     </span>
   </div>
   
     {product.isACRSCertified && (
     <div className="text-center mb-2">
       <span className="font-medium text-teal-600 px-2 py-1 text-xs underline flex items-center justify-center gap-1">
         <Shield className="w-3 h-3" />
         This product is ACRS certified
       </span>
     </div>
   )}
   
   {product.finish && (
     <div className="flex justify-between items-center">
       <span className="text-teal-700/70">Finish:</span>
       <span className="font-medium text-teal-800 text-sm">{product.finish}</span>
     </div>
   )}
 </div>
 
 {/* Product Tags */}
 {product.tags && product.tags.length > 0 && (
   <div className="mb-4 pb-4 border-b border-white/20">
     <div className="flex flex-wrap gap-1">
       {product.tags.slice(0, 3).map((tag, index) => (
         <span
           key={index}
           className="bg-blue-100/50 text-blue-700 px-2 py-0.5 rounded-full text-xs border border-blue-200/50"
         >
           {tag}
         </span>
       ))}
       {product.tags.length > 3 && (
         <span className="text-xs text-slate-500">+{product.tags.length - 3}</span>
       )}
     </div>
   </div>
 )}
 
 {/* Specifications Preview */}
 {product.specifications && product.specifications.length > 0 && (
   <div className="mb-4 pb-4 border-b border-white/20">
     <p className="text-xs text-teal-700/70 mb-2">Key Specifications:</p>
     <div className="space-y-1">
       {product.specifications.slice(0, 2).map((spec, index) => (
         <div key={index} className="flex justify-between text-xs">
           <span className="text-slate-600">{spec.key}:</span>
           <span className="text-slate-800 font-medium">{spec.value}</span>
         </div>
       ))}
       {product.specifications.length > 2 && (
         <p className="text-xs text-blue-600">+{product.specifications.length - 2} more specs</p>
       )}
     </div>
   </div>
 )}
 
 {/* Action Buttons */}
 <div className="flex gap-2 mt-auto">
   <button 
     onClick={() => handleOrderNow(product)}
     disabled={isOrderFormOpen}
     className="flex-1 bg-teal-600 text-white py-3 rounded-lg md:hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed border border-teal-500/30"
   >
     <ShoppingCart className="w-4 h-4" />
     Order Now
   </button>
   
  
 </div>
</div>
         </motion.div>
       ))}
     </div>
     
     {/* No Products Found State */}
     {filteredProducts.length === 0 && (
       <div className="text-center py-12 border border-teal-200/30 rounded-xl bg-white/20 backdrop-blur-sm">
         <Package className="w-16 h-16 text-teal-400/60 mx-auto mb-4" />
         <h3 className="text-lg font-medium text-teal-800 mb-2">No products found</h3>
         <p className="text-teal-700/70 mb-4">
           {searchTerm || selectedCategory !== 'all' || selectedMaterial !== 'all' || filterBy !== 'all'
             ? 'Try adjusting your search or filter criteria.'
             : 'No products are currently available in the catalog.'
           }
         </p>
         {(searchTerm || selectedCategory !== 'all' || selectedMaterial !== 'all' || filterBy !== 'all') && (
           <button
             onClick={() => {
               setSearchTerm('');
               setSelectedCategory('all');
               setSelectedMaterial('all');
               setFilterBy('all');
             }}
             className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
           >
             Clear All Filters
           </button>
         )}
       </div>
     )}
     
     {/* Products Summary */}
     {filteredProducts.length > 0 && (
       <div className="text-center py-4 border-t border-white/20">
         <p className="text-sm text-slate-600">
           Showing {filteredProducts.length} of {products?.length || 0} products
           {(searchTerm || selectedCategory !== 'all' || selectedMaterial !== 'all' || filterBy !== 'all') && (
             <span className="ml-2">
               <button
                 onClick={() => {
                   setSearchTerm('');
                   setSelectedCategory('all');
                   setSelectedMaterial('all');
                   setFilterBy('all');
                 }}
                 className="text-teal-600 hover:text-teal-700 underline"
               >
                 Clear filters
               </button>
             </span>
           )}
         </p>
       </div>
     )}
   </motion.div>
 );
};

export default ProductSection;