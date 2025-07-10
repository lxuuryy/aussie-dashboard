'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Package, 
  AlertCircle, 
  CheckCircle, 
  Loader, 
  X,
  Save,
  Tag,
  DollarSign,
  Ruler,
  Shield,
  ExternalLink,
  ArrowRight,
  Database
} from 'lucide-react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/firebase';

const ProductLookupComponent = ({ 
  onProductSelect, 
  currentProductData = {}, 
  isOpen = false, 
  onClose 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // New product form state
  const [newProductForm, setNewProductForm] = useState({
    itemCode: '',
    productName: '',
    description: '',
    category: 'Steel Products',
    material: 'AS/NZS 4671:2019',
    dimensions: {
      length: '',
      width: '',
      height: '',
      diameter: '',
      thickness: '',
      unit: 'mm'
    },
    weight: '',
    finish: 'Raw/Mill Finish',
    pricing: {
      unitPrice: '',
      currency: 'AUD',
      pricePerUnit: 'each'
    },
    stock: {
      quantity: 0,
      minStock: 0,
      location: ''
    },
    specifications: [],
    tags: [],
    isActive: true,
    isACRSCertified: false
  });

  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [errors, setErrors] = useState({});

  // Categories and materials (same as ProductManagement)
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
    'Custom Fabrication',
    'Steel Products'
  ];

  const materials = [
    'AS/NZS 4671:2019',
    'AS/NZS 1163',
    'AS/NZS 3678',
    'ASTM A36',
    'ASTM A572',
    'EN 10025',
    'JIS G3101'
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

  // Pre-fill form when currentProductData changes
  useEffect(() => {
    if (currentProductData.itemCode) {
      setSearchTerm(currentProductData.itemCode);
      setNewProductForm(prev => ({
        ...prev,
        itemCode: currentProductData.itemCode || '',
        productName: currentProductData.productName || '',
        description: currentProductData.description || '',
        category: currentProductData.category || 'Steel Products',
        material: currentProductData.material || 'AS/NZS 4671:2019',
        dimensions: {
          length: currentProductData.dimensions?.length || '',
          width: currentProductData.dimensions?.width || '',
          height: currentProductData.dimensions?.height || '',
          diameter: currentProductData.dimensions?.diameter || '',
          thickness: currentProductData.dimensions?.thickness || '',
          unit: currentProductData.dimensions?.unit || 'mm'
        },
        weight: currentProductData.weight || '',
        finish: currentProductData.finish || 'Raw/Mill Finish',
        pricing: {
          unitPrice: currentProductData.unitPrice || '',
          currency: currentProductData.currency || 'AUD',
          pricePerUnit: currentProductData.pricePerUnit || 'each'
        },
        isACRSCertified: currentProductData.isACRSCertified || false
      }));
    }
  }, [currentProductData]);

  // Auto-search when component opens with search term
  useEffect(() => {
    if (isOpen && searchTerm) {
      handleSearch();
    }
  }, [isOpen]);

  // Search products in database
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const productsRef = collection(db, 'products');
      
      // Search by item code (exact and partial matches)
      const itemCodeQuery = query(
        productsRef, 
        where('itemCode', '>=', searchTerm.toUpperCase()),
        where('itemCode', '<=', searchTerm.toUpperCase() + '\uf8ff')
      );

      const itemCodeSnapshot = await getDocs(itemCodeQuery);
      let results = itemCodeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // If no exact matches, try partial name search
      if (results.length === 0) {
        const allProductsQuery = query(productsRef);
        const allProductsSnapshot = await getDocs(allProductsQuery);
        
        const allProducts = allProductsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Client-side filtering for partial matches
        results = allProducts.filter(product =>
          product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.itemCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching products:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle product selection
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    
    // Convert product data to order item format
    const orderItemData = {
      itemCode: product.itemCode,
      productName: product.productName,
      description: product.description,
      category: product.category,
      material: product.material,
      dimensions: product.dimensions,
      weight: product.weight,
      finish: product.finish,
      specifications: product.specifications || [],
      tags: product.tags || [],
      isACRSCertified: product.isACRSCertified,
      unitPrice: product.pricing?.unitPrice || '',
      pricePerUnit: product.pricing?.pricePerUnit || 'each',
      currency: product.pricing?.currency || 'AUD',
      quantity: 1
    };

    onProductSelect(orderItemData);
  };

  // Handle new product creation
  const handleCreateProduct = async () => {
    // Validate required fields
    const requiredFields = ['itemCode', 'productName', 'description', 'category', 'material'];
    const newErrors = {};

    requiredFields.forEach(field => {
      if (!newProductForm[field]?.trim()) {
        newErrors[field] = `${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required`;
      }
    });

    if (!newProductForm.pricing.unitPrice || parseFloat(newProductForm.pricing.unitPrice) <= 0) {
      newErrors['pricing.unitPrice'] = 'Valid unit price is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmittingProduct(true);
    try {
      // Prepare product data for database
      const productData = {
        itemCode: newProductForm.itemCode.trim().toUpperCase(),
        productName: newProductForm.productName.trim(),
        description: newProductForm.description.trim(),
        category: newProductForm.category,
        dimensions: {
          length: newProductForm.dimensions.length ? parseFloat(newProductForm.dimensions.length) : null,
          width: newProductForm.dimensions.width ? parseFloat(newProductForm.dimensions.width) : null,
          height: newProductForm.dimensions.height ? parseFloat(newProductForm.dimensions.height) : null,
          diameter: newProductForm.dimensions.diameter ? parseFloat(newProductForm.dimensions.diameter) : null,
          thickness: newProductForm.dimensions.thickness ? parseFloat(newProductForm.dimensions.thickness) : null,
          unit: newProductForm.dimensions.unit
        },
        material: newProductForm.material,
        finish: newProductForm.finish,
        weight: newProductForm.weight ? parseFloat(newProductForm.weight) : null,
        pricing: {
          unitPrice: parseFloat(newProductForm.pricing.unitPrice),
          currency: newProductForm.pricing.currency,
          pricePerUnit: newProductForm.pricing.pricePerUnit
        },
        stock: {
          quantity: parseInt(newProductForm.stock.quantity) || 0,
          minStock: parseInt(newProductForm.stock.minStock) || 0,
          location: newProductForm.stock.location.trim()
        },
        specifications: newProductForm.specifications,
        tags: newProductForm.tags,
        isActive: newProductForm.isActive,
        isACRSCertified: newProductForm.isACRSCertified,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add to products collection
      const docRef = await addDoc(collection(db, 'products'), productData);
      
      // Create the product object with ID for immediate use
      const newProduct = {
        id: docRef.id,
        ...productData
      };

      console.log('New product created:', newProduct.id);

      // Immediately select the newly created product
      handleSelectProduct(newProduct);
      
      // Close the form
      setShowAddForm(false);
      onClose();

    } catch (error) {
      console.error('Error creating product:', error);
      setErrors({ submit: 'Failed to create product. Please try again.' });
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const fields = field.split('.');
      setNewProductForm(prev => {
        const newData = { ...prev };
        let current = newData;
        for (let i = 0; i < fields.length - 1; i++) {
          current = current[fields[i]];
        }
        current[fields[fields.length - 1]] = value;
        return newData;
      });
    } else {
      setNewProductForm(prev => ({
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

  // Format price display
  const formatPrice = (price, currency = 'AUD') => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency
    }).format(price);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Product Lookup</h2>
                <p className="text-sm text-gray-600">Search existing products or create new ones</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {!showAddForm ? (
            <>
              {/* Search Section */}
              <div className="mb-6">
                <div className="flex gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search by item code, product name, or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchTerm.trim()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isSearching ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Search
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-3 mb-6">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Found {searchResults.length} matching product{searchResults.length !== 1 ? 's' : ''}
                    </h3>
                    <div className="grid gap-3 max-h-64 overflow-y-auto">
                      {searchResults.map((product) => (
                        <div
                          key={product.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                          onClick={() => handleSelectProduct(product)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono font-semibold text-blue-600">{product.itemCode}</span>
                                {product.isACRSCertified && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                    <Shield className="w-3 h-3 mr-1" />
                                    ACRS
                                  </span>
                                )}
                              </div>
                              <h4 className="font-medium text-gray-900 mb-1">{product.productName}</h4>
                              <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>{product.category}</span>
                                <span>{product.material}</span>
                                <span className="font-semibold text-green-600">
                                  {formatPrice(product.pricing?.unitPrice, product.pricing?.currency)}
                                  /{product.pricing?.pricePerUnit}
                                </span>
                              </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results Found */}
                {searchTerm && !isSearching && searchResults.length === 0 && (
                  <div className="text-center py-8 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-800 mb-2">Product Not Found</h3>
                    <p className="text-gray-600 mb-4">
                      No products found matching "{searchTerm}". Would you like to create a new product?
                    </p>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Product
                    </button>
                  </div>
                )}

                {/* Manual Add Option */}
                {!searchTerm && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-800 mb-2">Search for Products</h3>
                    <p className="text-gray-600 mb-4">
                      Enter an item code or product name to search, or create a new product
                    </p>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Product
                    </button>
                  </div>
                )}
                </div>
                </>
            ) : (
              
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-green-600" />
                    Create New Product
                  </h3>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Basic Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-600" />
                    Basic Information
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item Code *
                      </label>
                      <input
                        type="text"
                        value={newProductForm.itemCode}
                        onChange={(e) => handleInputChange('itemCode', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.itemCode ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g. FBSB321330"
                      />
                      {errors.itemCode && (
                        <p className="text-sm text-red-600 mt-1">{errors.itemCode}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={newProductForm.productName}
                        onChange={(e) => handleInputChange('productName', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.productName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g. Forge Bar Starter Bar"
                      />
                      {errors.productName && (
                        <p className="text-sm text-red-600 mt-1">{errors.productName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category *
                      </label>
                      <select
                        value={newProductForm.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.category ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Material *
                      </label>
                      <select
                        value={newProductForm.material}
                        onChange={(e) => handleInputChange('material', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.material ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        {materials.map(mat => (
                          <option key={mat} value={mat}>{mat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <textarea
                        value={newProductForm.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        rows={2}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.description ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g. 32mm x 1330mm assembled with FBENDCAP32"
                      />
                      {errors.description && (
                        <p className="text-sm text-red-600 mt-1">{errors.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dimensions */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-blue-600" />
                    Dimensions
                  </h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newProductForm.dimensions.length}
                        onChange={(e) => handleInputChange('dimensions.length', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="1330"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Diameter</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newProductForm.dimensions.diameter}
                        onChange={(e) => handleInputChange('dimensions.diameter', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="32"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                      <select
                        value={newProductForm.dimensions.unit}
                        onChange={(e) => handleInputChange('dimensions.unit', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                        <option value="m">m</option>
                        <option value="in">in</option>
                        <option value="ft">ft</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    Pricing
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Price *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newProductForm.pricing.unitPrice}
                        onChange={(e) => handleInputChange('pricing.unitPrice', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors['pricing.unitPrice'] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="14.92"
                      />
                      {errors['pricing.unitPrice'] && (
                        <p className="text-sm text-red-600 mt-1">{errors['pricing.unitPrice']}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={newProductForm.pricing.currency}
                        onChange={(e) => handleInputChange('pricing.currency', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="AUD">AUD</option>
                        <option value="USD">USD</option>
                        <option value="MYR">MYR</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price Per</label>
                      <select
                        value={newProductForm.pricing.pricePerUnit}
                        onChange={(e) => handleInputChange('pricing.pricePerUnit', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                {/* Submit Error */}
                {errors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      {errors.submit}
                    </p>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateProduct}
                    disabled={isSubmittingProduct}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmittingProduct ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Create Product
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
  
  );
};

export default ProductLookupComponent;