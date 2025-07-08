'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Tag, 
  DollarSign, 
  Ruler, 
  FileText, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Loader, 
  AlertCircle,
  Save,
  RefreshCw,
  Star,
  Shield,
  Edit,
  Trash2,
  Search,
  Plus,
  Eye,
  Wrench,
  Palette,
  X,
  Calculator,
  Weight
} from 'lucide-react';
import { collection, addDoc, query, getDocs, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  
  const [formData, setFormData] = useState({
  itemCode: '',
  productName: '',
  description: '',
  category: '',
  dimensions: {
    length: '',
    width: '',
    height: '',
    diameter: '',
    thickness: '',
    unit: 'mm'
  },
  material: '',
  finish: '',
  weight: '',
  pricing: {
    unitPrice: '',
    currency: 'AUD',
    pricePerUnit: 'each',
    bulkPricing: []
  },
  stock: {
    quantity: '',
    minStock: '',
    location: ''
  },
  specifications: [],
  tags: [],
  isActive: true,
  isACRSCertified: false  // ADD THIS LINE
});


  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeExists, setCodeExists] = useState(false);

  // New specification and tag states
  const [newSpec, setNewSpec] = useState({ key: '', value: '' });
  const [newTag, setNewTag] = useState('');

  // Categories for steel products
  const categories = [
    'Bars & Rods',
    'Beams & Columns', 
    'Plates & Sheets',
    'Pipes & Tubes',
    'Angles & Channels',
    'Wire & Mesh',
    'Fasteners',
    'Structural Steel',
    'Reinforcement',
    'Custom Fabrication'
  ];

  const materials = [
   'AS/NZS 4671:2019',
   'AS/NZS 1163',
   'AS/NZS 3678'

   
];

  const finishes = [
    'Raw/Mill Finish',
    'Galvanized',
    'Powder Coated',
    'Painted',
    'Polished',
    'Brushed',
    'Anodized',
    'Zinc Plated',
    'Chrome Plated'
  ];

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Filter products based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.itemCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.material?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [products, searchTerm]);

  // Fetch all products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const productsQuery = query(collection(db, 'products'));
      const productsSnapshot = await getDocs(productsQuery);
      
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? 
          doc.data().createdAt.toDate() : 
          new Date(doc.data().createdAt)
      }));
      
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if item code already exists
  const checkCodeExists = async (itemCode) => {
    if (!itemCode.trim()) return;
    
    try {
      setIsCheckingCode(true);
      
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('itemCode', '==', itemCode.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      const existingProduct = querySnapshot.docs.find(doc => 
        editingProduct ? doc.id !== editingProduct.id : true
      );
      
      setCodeExists(!!existingProduct);
    } catch (error) {
      console.error('Error checking item code:', error);
    } finally {
      setIsCheckingCode(false);
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

  
  // Add specification
  const addSpecification = () => {
    if (!newSpec.key.trim() || !newSpec.value.trim()) {
      alert('Please enter both specification key and value');
      return;
    }

    setFormData(prev => ({
      ...prev,
      specifications: [...prev.specifications, { ...newSpec }]
    }));
    setNewSpec({ key: '', value: '' });
  };

  // Remove specification
  const removeSpecification = (index) => {
    setFormData(prev => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index)
    }));
  };

  // Add tag
  const addTag = () => {
    if (!newTag.trim()) {
      alert('Please enter a tag');
      return;
    }

    if (formData.tags.includes(newTag.trim())) {
      alert('Tag already exists');
      return;
    }

    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, newTag.trim()]
    }));
    setNewTag('');
  };

  // Remove tag
  const removeTag = (index) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.itemCode.trim()) {
      newErrors.itemCode = 'Item code is required';
    } else if (codeExists) {
      newErrors.itemCode = 'This item code already exists';
    }
    
    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    
    if (!formData.material) {
      newErrors.material = 'Material is required';
    }
    
    if (!formData.pricing.unitPrice || parseFloat(formData.pricing.unitPrice) <= 0) {
      newErrors['pricing.unitPrice'] = 'Valid unit price is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Reset form
  const resetForm = () => {
  setFormData({
    itemCode: '',
    productName: '',
    description: '',
    category: '',
    dimensions: {
      length: '',
      width: '',
      height: '',
      diameter: '',
      thickness: '',
      unit: 'mm'
    },
    material: '',
    finish: '',
    weight: '',
    pricing: {
      unitPrice: '',
      currency: 'AUD',
      pricePerUnit: 'each',
      bulkPricing: []
    },
    stock: {
      quantity: '',
      minStock: '',
      location: ''
    },
    specifications: [],
    tags: [],
    isActive: true,
    isACRSCertified: false  // ADD THIS LINE
  });
  setErrors({});
  setEditingProduct(null);
  setCodeExists(false);
  setNewSpec({ key: '', value: '' });
  setNewTag('');
};

  // Handle new product button
  const handleNewProduct = () => {
    resetForm();
    setShowForm(true);
  };

  // Handle edit product
  const handleEditProduct = (product) => {
  setFormData({
    itemCode: product.itemCode || '',
    productName: product.productName || '',
    description: product.description || '',
    category: product.category || '',
    dimensions: {
      length: product.dimensions?.length || '',
      width: product.dimensions?.width || '',
      height: product.dimensions?.height || '',
      diameter: product.dimensions?.diameter || '',
      thickness: product.dimensions?.thickness || '',
      unit: product.dimensions?.unit || 'mm'
    },
    material: product.material || '',
    finish: product.finish || '',
    weight: product.weight || '',
    pricing: {
      unitPrice: product.pricing?.unitPrice || '',
      currency: product.pricing?.currency || 'AUD',
      pricePerUnit: product.pricing?.pricePerUnit || 'each',
      bulkPricing: product.pricing?.bulkPricing || []
    },
    stock: {
      quantity: product.stock?.quantity || '',
      minStock: product.stock?.minStock || '',
      location: product.stock?.location || ''
    },
    specifications: product.specifications || [],
    tags: product.tags || [],
    isActive: product.isActive !== undefined ? product.isActive : true,
    isACRSCertified: product.isACRSCertified !== undefined ? product.isACRSCertified : false  // ADD THIS LINE
  });
  
  setEditingProduct(product);
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
      
      

      // Prepare product data
      const productData = {
  itemCode: formData.itemCode.trim().toUpperCase(),
  productName: formData.productName.trim(),
  description: formData.description.trim(),
  category: formData.category,
  dimensions: {
    length: formData.dimensions.length ? parseFloat(formData.dimensions.length) : null,
    width: formData.dimensions.width ? parseFloat(formData.dimensions.width) : null,
    height: formData.dimensions.height ? parseFloat(formData.dimensions.height) : null,
    diameter: formData.dimensions.diameter ? parseFloat(formData.dimensions.diameter) : null,
    thickness: formData.dimensions.thickness ? parseFloat(formData.dimensions.thickness) : null,
    unit: formData.dimensions.unit
  },
  material: formData.material,
  finish: formData.finish,
  weight: formData.weight ? parseFloat(formData.weight) : null,
  pricing: {
    unitPrice: parseFloat(formData.pricing.unitPrice),
    currency: formData.pricing.currency,
    pricePerUnit: formData.pricing.pricePerUnit,
    bulkPricing: formData.pricing.bulkPricing
  },
  stock: {
    quantity: formData.stock.quantity ? parseInt(formData.stock.quantity) : 0,
    minStock: formData.stock.minStock ? parseInt(formData.stock.minStock) : 0,
    location: formData.stock.location.trim()
  },
  specifications: formData.specifications,
  tags: formData.tags,
  isActive: formData.isActive,
  isACRSCertified: formData.isACRSCertified,  // ADD THIS LINE
  updatedAt: new Date()
};


      if (editingProduct) {
        // Update existing product
        const productRef = doc(db, 'products', editingProduct.id);
        await updateDoc(productRef, productData);
        console.log('Product updated successfully');
      } else {
        // Create new product
        productData.createdAt = new Date();
        
        await addDoc(collection(db, 'products'), productData);
        console.log('Product created successfully');
      }

      // Refresh products list and close form
      await fetchProducts();
      setShowForm(false);
      resetForm();

    } catch (error) {
      console.error('Error saving product:', error);
      setErrors({
        submit: 'Failed to save product. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete product
  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete ${product.productName}? This action cannot be undone.`)) {
      return;
    }

    try {
     

      // Delete product document
      await deleteDoc(doc(db, 'products', product.id));
      
      // Refresh products list
      await fetchProducts();
      
      console.log('Product deleted successfully');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product. Please try again.');
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

  const formatPrice = (price, currency = 'AUD') => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader className="w-12 h-12 text-teal-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading products...</p>
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
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Product Management</h1>
              <p className="text-gray-600 text-sm sm:text-base">Manage your steel product catalog and inventory</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchProducts}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={handleNewProduct}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Product
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Products</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{products.length}</p>
                </div>
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Active Products</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {products.filter(p => p.isActive).length}
                  </p>
                </div>
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Categories</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {new Set(products.map(p => p.category)).size}
                  </p>
                </div>
                <Tag className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
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
              placeholder="Search products by code, name, category, material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Showing {filteredProducts.length} of {products.length} products
          </p>
        </div>

        {/* Form Dropdown */}
        {showForm && (
          <div className="bg-white rounded-lg border shadow-lg mb-6 overflow-hidden transition-all duration-300 ease-in-out animate-in slide-in-from-top-2">
            <div className="bg-gradient-to-r from-teal-50 to-blue-50 border-b border-teal-100 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Package className="w-6 h-6 text-teal-600" />
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
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
                {editingProduct ? 'Update product information and specifications' : 'Fill in all required fields to add a new product to your catalog'}
              </p>
            </div>

            <div className="p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-teal-600" />
                    Basic Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Item Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item Code *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.itemCode}
                          onChange={(e) => {
                            handleInputChange('itemCode', e.target.value);
                            if (codeExists) {
                              setCodeExists(false);
                            }
                          }}
                          onBlur={() => checkCodeExists(formData.itemCode)}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                            errors.itemCode || codeExists ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="e.g. FBSB321330"
                        />
                        {isCheckingCode && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Loader className="w-4 h-4 animate-spin text-teal-600" />
                          </div>
                        )}
                      </div>
                      {(errors.itemCode || codeExists) && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.itemCode || 'This item code already exists'}
                        </p>
                      )}
                    </div>

                    {/* Product Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={formData.productName}
                        onChange={(e) => handleInputChange('productName', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                          errors.productName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g. Forge Bar Starter Bar"
                      />
                      {errors.productName && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.productName}
                        </p>
                      )}
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                          errors.category ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select category</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {errors.category && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.category}
                        </p>
                      )}
                    </div>

                    {/* Material */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Material *
                      </label>
                      <select
                        value={formData.material}
                        onChange={(e) => handleInputChange('material', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                          errors.material ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select material</option>
                        {materials.map(mat => (
                          <option key={mat} value={mat}>{mat}</option>
                        ))}
                      </select>
                      {errors.material && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.material}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description *
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        rows={3}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                          errors.description ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g. 32mm x 1330mm assembled with FBENDCAP32"
                        />
                     {errors.description && (
                       <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                         <AlertCircle className="w-4 h-4" />
                         {errors.description}
                       </p>
                     )}
                   </div>
                 </div>

                 
               </div>

               {/* Dimensions & Physical Properties */}
               <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                   <Ruler className="w-5 h-5 text-teal-600" />
                   Dimensions & Physical Properties
                 </h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {/* Length */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Length
                     </label>
                     <input
                       type="number"
                       step="0.01"
                       value={formData.dimensions.length}
                       onChange={(e) => handleInputChange('dimensions.length', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                       placeholder="1330"
                     />
                   </div>

                   {/* Width */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Width
                     </label>
                     <input
                       type="number"
                       step="0.01"
                       value={formData.dimensions.width}
                       onChange={(e) => handleInputChange('dimensions.width', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                       placeholder="50"
                     />
                   </div>

                   {/* Height */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Height
                     </label>
                     <input
                       type="number"
                       step="0.01"
                       value={formData.dimensions.height}
                       onChange={(e) => handleInputChange('dimensions.height', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                       placeholder="25"
                     />
                   </div>

                   {/* Diameter */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Diameter
                     </label>
                     <input
                       type="number"
                       step="0.01"
                       value={formData.dimensions.diameter}
                       onChange={(e) => handleInputChange('dimensions.diameter', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                       placeholder="32"
                     />
                   </div>

                   {/* Thickness */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Thickness
                     </label>
                     <input
                       type="number"
                       step="0.01"
                       value={formData.dimensions.thickness}
                       onChange={(e) => handleInputChange('dimensions.thickness', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                       placeholder="5"
                     />
                   </div>

                   {/* Unit */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Unit
                     </label>
                     <select
                       value={formData.dimensions.unit}
                       onChange={(e) => handleInputChange('dimensions.unit', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                     >
                       <option value="mm">Millimeters (mm)</option>
                       <option value="cm">Centimeters (cm)</option>
                       <option value="m">Meters (m)</option>
                       <option value="in">Inches (in)</option>
                       <option value="ft">Feet (ft)</option>
                     </select>
                   </div>

                   {/* Weight */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Weight (kg)
                     </label>
                     <input
                       type="number"
                       step="0.01"
                       value={formData.weight}
                       onChange={(e) => handleInputChange('weight', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                       placeholder="2.5"
                     />
                   </div>

                   {/* Finish */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Finish
                     </label>
                     <select
                       value={formData.finish}
                       onChange={(e) => handleInputChange('finish', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                     >
                       <option value="">Select finish</option>
                       {finishes.map(finish => (
                         <option key={finish} value={finish}>{finish}</option>
                       ))}
                     </select>
                   </div>

                   {/* Status */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Status
                     </label>
                     <select
                       value={formData.isActive}
                       onChange={(e) => handleInputChange('isActive', e.target.value === 'true')}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                     >
                       <option value={true}>Active</option>
                       <option value={false}>Inactive</option>
                     </select>
                   </div>
                   <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    ACRS Certified
  </label>
  <select
    value={formData.isACRSCertified}
    onChange={(e) => handleInputChange('isACRSCertified', e.target.value === 'true')}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
  >
    <option value={false}>No</option>
    <option value={true}>Yes</option>
  </select>
</div>
                 </div>
               </div>

               {/* Pricing Information */}
               <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                   <DollarSign className="w-5 h-5 text-teal-600" />
                   Pricing Information
                 </h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {/* Unit Price */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Unit Price *
                     </label>
                     <input
                       type="number"
                       step="0.01"
                       value={formData.pricing.unitPrice}
                       onChange={(e) => handleInputChange('pricing.unitPrice', e.target.value)}
                       className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                         errors['pricing.unitPrice'] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                       }`}
                       placeholder="14.92"
                     />
                     {errors['pricing.unitPrice'] && (
                       <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                         <AlertCircle className="w-4 h-4" />
                         {errors['pricing.unitPrice']}
                       </p>
                     )}
                   </div>

                   {/* Currency */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Currency
                     </label>
                     <select
                       value={formData.pricing.currency}
                       onChange={(e) => handleInputChange('pricing.currency', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                     >
                       <option value="AUD">AUD</option>
                       <option value="USD">USD</option>
                        <option value="MYR">MYR</option>
                       
                     </select>
                   </div>

                   {/* Price Per Unit */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Price Per
                     </label>
                     <select
                       value={formData.pricing.pricePerUnit}
                       onChange={(e) => handleInputChange('pricing.pricePerUnit', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                     >
                       <option value="each">Each</option>
                       <option value="meter">Per Meter</option>
                       <option value="kg">Per Kg</option>
                       <option value="tonne">Per Tonne</option>
                       <option value="sheet">Per Sheet</option>
                       <option value="sqm">Per Square Meter</option>
                     </select>
                   </div>
                 </div>
               </div>

               {/* Stock Information */}
               <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                   <Package className="w-5 h-5 text-teal-600" />
                   Stock Information
                 </h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {/* Current Quantity */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Current Quantity
                     </label>
                     <input
                       type="number"
                       value={formData.stock.quantity}
                       onChange={(e) => handleInputChange('stock.quantity', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                       placeholder="9000"
                     />
                   </div>

                   {/* Minimum Stock */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Minimum Stock Level
                     </label>
                     <input
                       type="number"
                       value={formData.stock.minStock}
                       onChange={(e) => handleInputChange('stock.minStock', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                       placeholder="100"
                     />
                   </div>

                   {/* Storage Location */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Storage Location
                     </label>
                     <input
                       type="text"
                       value={formData.stock.location}
                       onChange={(e) => handleInputChange('stock.location', e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                       placeholder="Warehouse A - Section B2"
                     />
                   </div>
                 </div>
               </div>

               {/* Specifications */}
               <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                   <Wrench className="w-5 h-5 text-teal-600" />
                   Technical Specifications
                 </h3>
                 
                 {/* Add Specification */}
                 <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                   <h4 className="font-medium text-gray-900 mb-3">Add Specification</h4>
                   <div className="flex flex-col sm:flex-row gap-3">
                     <input
                       type="text"
                       value={newSpec.key}
                       onChange={(e) => setNewSpec({...newSpec, key: e.target.value})}
                       placeholder="Property name (e.g. Tensile Strength)"
                       className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                     />
                     <input
                       type="text"
                       value={newSpec.value}
                       onChange={(e) => setNewSpec({...newSpec, value: e.target.value})}
                       placeholder="Value (e.g. 400 MPa)"
                       className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                     />
                     <button
                       type="button"
                       onClick={addSpecification}
                       className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                     >
                       <Plus className="w-4 h-4" />
                       Add Spec
                     </button>
                   </div>
                 </div>

                 {/* Current Specifications List */}
                 <div>
                   <h4 className="font-medium text-gray-900 mb-3">Current Specifications ({formData.specifications.length})</h4>
                   <div className="space-y-2 max-h-60 overflow-y-auto">
                     {formData.specifications.length === 0 ? (
                       <div className="text-center py-8 text-gray-500">
                         <Wrench className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                         <p>No specifications added yet</p>
                         <p className="text-sm">Add technical specifications above</p>
                       </div>
                     ) : (
                       formData.specifications.map((spec, index) => (
                         <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                           <div className="flex-1">
                             <div className="font-medium text-gray-900">{spec.key}</div>
                             <div className="text-sm text-gray-600">{spec.value}</div>
                           </div>
                           <button
                             type="button"
                             onClick={() => removeSpecification(index)}
                             className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                             title="Remove specification"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       ))
                     )}
                   </div>
                 </div>
               </div>

               {/* Tags */}
               <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                   <Tag className="w-5 h-5 text-teal-600" />
                   Product Tags
                 </h3>
                 
                 {/* Add Tag */}
                 <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                   <h4 className="font-medium text-gray-900 mb-3">Add Tag</h4>
                   <div className="flex gap-3">
                     <input
                       type="text"
                       value={newTag}
                       onChange={(e) => setNewTag(e.target.value)}
                       placeholder="Enter tag (e.g. heavy-duty, outdoor, galvanized)"
                       className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                     />
                     <button
                       type="button"
                       onClick={addTag}
                       className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                     >
                       <Plus className="w-4 h-4" />
                       Add Tag
                     </button>
                   </div>
                 </div>

                 {/* Current Tags */}
                 <div>
                   <h4 className="font-medium text-gray-900 mb-3">Current Tags ({formData.tags.length})</h4>
                   <div className="flex flex-wrap gap-2">
                     {formData.tags.length === 0 ? (
                       <div className="text-center py-8 text-gray-500 w-full">
                         <Tag className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                         <p>No tags added yet</p>
                         <p className="text-sm">Add product tags for better organization</p>
                       </div>
                     ) : (
                       formData.tags.map((tag, index) => (
                         <div key={index} className="flex items-center gap-1 bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm">
                           <span>{tag}</span>
                           <button
                             type="button"
                             onClick={() => removeTag(index)}
                             className="ml-1 p-0.5 hover:bg-teal-200 rounded-full transition-colors"
                             title="Remove tag"
                           >
                             <X className="w-3 h-3" />
                           </button>
                         </div>
                       ))
                     )}
                   </div>
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
                   disabled={isSubmitting || codeExists}
                   className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
                 >
                   {isSubmitting ? (
                     <>
                       <Loader className="w-4 h-4 animate-spin" />
                       {editingProduct ? 'Updating...' : 'Adding...'}
                     </>
                   ) : (
                     <>
                       <Save className="w-4 h-4" />
                       {editingProduct ? 'Update Product' : 'Add Product'}
                     </>
                   )}
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}

       {/* Products Table */}
       <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
         {filteredProducts.length === 0 ? (
           <div className="p-8 sm:p-12 text-center">
             <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
             <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
             <p className="text-gray-600">Try adjusting your search criteria or add a new product.</p>
           </div>
         ) : (
           <div className="overflow-x-auto">
             <table className="w-full">
               <thead className="bg-gray-50">
                 <tr>
                   <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Product
                   </th>
                   <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Category & Material
                   </th>
                   <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Dimensions
                   </th>
                   <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Pricing & Stock
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
                 {filteredProducts.map((product) => (
                   <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                     <td className="px-6 py-4">
                       <div className="flex items-center">
                         
                         <div>
                           <div className="font-medium text-gray-900">{product.itemCode}</div>
                           <div className="text-sm text-gray-600">{product.productName}</div>
                           <div className="text-xs text-gray-500 max-w-xs truncate">
                             {product.description}
                           </div>
                         </div>
                       </div>
                     </td>

                     <td className="px-6 py-4">
                       <div>
                         <div className="text-sm font-medium text-gray-900">{product.category}</div>
                         <div className="text-sm text-gray-600">{product.material}</div>
                         {product.finish && (
                           <div className="text-xs text-gray-500">{product.finish}</div>
                         )}
                       </div>
                     </td>

                     <td className="px-6 py-4">
                       <div className="text-sm text-gray-600">
                         {product.dimensions?.length && (
                           <div>L: {product.dimensions.length}{product.dimensions.unit}</div>
                         )}
                         {product.dimensions?.diameter && (
                           <div>⌀: {product.dimensions.diameter}{product.dimensions.unit}</div>
                         )}
                         {product.dimensions?.width && product.dimensions?.height && (
                           <div>W×H: {product.dimensions.width}×{product.dimensions.height}{product.dimensions.unit}</div>
                         )}
                         {product.weight && (
                           <div className="text-xs text-gray-500">Weight: {product.weight}kg</div>
                         )}
                       </div>
                     </td>

                     <td className="px-6 py-4">
                       <div>
                         <div className="font-medium text-gray-900">
                           {formatPrice(product.pricing?.unitPrice, product.pricing?.currency)} 
                           <span className="text-sm font-normal text-gray-500">
                             /{product.pricing?.pricePerUnit}
                           </span>
                         </div>
                         <div className="text-sm text-gray-600">
                           Stock: {product.stock?.quantity || 0}
                         </div>
                         {product.stock?.location && (
                           <div className="text-xs text-gray-500">{product.stock.location}</div>
                         )}
                       </div>
                     </td>

                     <td className="px-6 py-4">
                       <div className="space-y-1">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                           product.isActive 
                             ? 'bg-green-100 text-green-800' 
                             : 'bg-gray-100 text-gray-800'
                         }`}>
                           {product.isActive ? 'Active' : 'Inactive'}
                         </span>

                         {/* ADD ACRS CERTIFICATION BADGE */}
    {product.isACRSCertified && (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Shield className="w-3 h-3 mr-1" />
        ACRS Certified
      </span>
    )}
                         {product.tags && product.tags.length > 0 && (
                           <div className="flex flex-wrap gap-1">
                             {product.tags.slice(0, 2).map((tag, index) => (
                               <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                 {tag}
                               </span>
                             ))}
                             {product.tags.length > 2 && (
                               <span className="text-xs text-gray-500">+{product.tags.length - 2}</span>
                             )}
                           </div>
                         )}
                       </div>
                     </td>

                     <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                         <button
                           onClick={() => handleEditProduct(product)}
                           className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                           title="Edit Product"
                         >
                           <Edit className="w-4 h-4" />
                         </button>
                         <button
                           onClick={() => handleDeleteProduct(product)}
                           className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                           title="Delete Product"
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

export default ProductManagement;