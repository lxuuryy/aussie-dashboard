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

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
    isACRSCertified: false
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
      isACRSCertified: false
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
      isACRSCertified: product.isACRSCertified !== undefined ? product.isACRSCertified : false
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
        isACRSCertified: formData.isACRSCertified,
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
              <Button variant="outline" onClick={fetchProducts}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleNewProduct}>
                <Plus className="w-4 h-4 mr-2" />
                New Product
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Products</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{products.length}</p>
                  </div>
                  <Package className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Active Products</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">
                      {products.filter(p => p.isActive).length}
                    </p>
                  </div>
                  <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Categories</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">
                      {new Set(products.map(p => p.category)).size}
                    </p>
                  </div>
                  <Tag className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">ACRS Certified</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">
                      {products.filter(p => p.isACRSCertified).length}
                    </p>
                  </div>
                  <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search products by code, name, category, material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Showing {filteredProducts.length} of {products.length} products
            </p>
          </CardContent>
        </Card>

        {/* Form Collapsible */}
        <Collapsible open={showForm} onOpenChange={setShowForm}>
          <CollapsibleContent>
            <Card className="mb-6">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-blue-50 border-b border-teal-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Package className="w-6 h-6 text-teal-600" />
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  {editingProduct ? 'Update product information and specifications' : 'Fill in all required fields to add a new product to your catalog'}
                </p>
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-teal-600" />
                        Basic Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Item Code */}
                        <div>
                          <Label htmlFor="itemCode">Item Code *</Label>
                          <div className="relative">
                            <Input
                              id="itemCode"
                              type="text"
                              value={formData.itemCode}
                              onChange={(e) => {
                                handleInputChange('itemCode', e.target.value);
                                if (codeExists) {
                                  setCodeExists(false);
                                }
                              }}
                              
                              className={errors.itemCode || codeExists ? 'border-red-500' : ''}
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
                          <Label htmlFor="productName">Product Name *</Label>
                          <Input
                            id="productName"
                            type="text"
                            value={formData.productName}
                            onChange={(e) => handleInputChange('productName', e.target.value)}
                            className={errors.productName ? 'border-red-500' : ''}
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
                          <Label htmlFor="category">Category *</Label>
                          <Select 
                            value={formData.category} 
                            onValueChange={(value) => handleInputChange('category', value)}
                          >
                            <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.category && (
                            <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {errors.category}
                            </p>
                          )}
                        </div>

                        {/* Material */}
                        <div>
                          <Label htmlFor="material">Material *</Label>
                          <Select 
                            value={formData.material} 
                            onValueChange={(value) => handleInputChange('material', value)}
                          >
                            <SelectTrigger className={errors.material ? 'border-red-500' : ''}>
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                              {materials.map(mat => (
                                <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.material && (
                            <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {errors.material}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <Label htmlFor="description">Description *</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          className={errors.description ? 'border-red-500' : ''}
                          placeholder="e.g. 32mm x 1330mm assembled with FBENDCAP32"
                          rows={3}
                        />
                        {errors.description && (
                          <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {errors.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dimensions & Physical Properties */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Ruler className="w-5 h-5 text-teal-600" />
                        Dimensions & Physical Properties
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Length */}
                        <div>
                          <Label htmlFor="length">Length</Label>
                          <Input
                            id="length"
                            type="number"
                            step="0.01"
                            value={formData.dimensions.length}
                            onChange={(e) => handleInputChange('dimensions.length', e.target.value)}
                            placeholder="1330"
                          />
                        </div>

                        {/* Width */}
                        <div>
                          <Label htmlFor="width">Width</Label>
                          <Input
                            id="width"
                            type="number"
                            step="0.01"
                            value={formData.dimensions.width}
                            onChange={(e) => handleInputChange('dimensions.width', e.target.value)}
                            placeholder="50"
                          />
                        </div>

                        {/* Height */}
                        <div>
                          <Label htmlFor="height">Height</Label>
                          <Input
                            id="height"
                            type="number"
                            step="0.01"
                            value={formData.dimensions.height}
                            onChange={(e) => handleInputChange('dimensions.height', e.target.value)}
                            placeholder="25"
                          />
                        </div>

                        {/* Diameter */}
                        <div>
                          <Label htmlFor="diameter">Diameter</Label>
                          <Input
                            id="diameter"
                            type="number"
                            step="0.01"
                            value={formData.dimensions.diameter}
                            onChange={(e) => handleInputChange('dimensions.diameter', e.target.value)}
                            placeholder="32"
                          />
                        </div>

                        {/* Thickness */}
                        <div>
                          <Label htmlFor="thickness">Thickness</Label>
                          <Input
                            id="thickness"
                            type="number"
                            step="0.01"
                            value={formData.dimensions.thickness}
                            onChange={(e) => handleInputChange('dimensions.thickness', e.target.value)}
                            placeholder="5"
                          />
                        </div>

                        {/* Unit */}
                        <div>
                          <Label htmlFor="unit">Unit</Label>
                          <Select 
                           value={formData.dimensions.unit} 
                           onValueChange={(value) => handleInputChange('dimensions.unit', value)}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="mm">Millimeters (mm)</SelectItem>
                             <SelectItem value="cm">Centimeters (cm)</SelectItem>
                             <SelectItem value="m">Meters (m)</SelectItem>
                             <SelectItem value="in">Inches (in)</SelectItem>
                             <SelectItem value="ft">Feet (ft)</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       {/* Weight */}
                       <div>
                         <Label htmlFor="weight">Weight (kg)</Label>
                         <Input
                           id="weight"
                           type="number"
                           step="0.01"
                           value={formData.weight}
                           onChange={(e) => handleInputChange('weight', e.target.value)}
                           placeholder="2.5"
                         />
                       </div>

                       {/* Finish */}
                       <div>
                         <Label htmlFor="finish">Finish</Label>
                         <Select 
                           value={formData.finish} 
                           onValueChange={(value) => handleInputChange('finish', value)}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select finish" />
                           </SelectTrigger>
                           <SelectContent>
                             {finishes.map(finish => (
                               <SelectItem key={finish} value={finish}>{finish}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>

                       {/* Status */}
                       <div>
                         <Label htmlFor="status">Status</Label>
                         <Select 
                           value={formData.isActive.toString()} 
                           onValueChange={(value) => handleInputChange('isActive', value === 'true')}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="true">Active</SelectItem>
                             <SelectItem value="false">Inactive</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       {/* ACRS Certified */}
                       <div>
                         <Label htmlFor="acrs">ACRS Certified</Label>
                         <Select 
                           value={formData.isACRSCertified.toString()} 
                           onValueChange={(value) => handleInputChange('isACRSCertified', value === 'true')}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="false">No</SelectItem>
                             <SelectItem value="true">Yes</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                     </div>
                   </CardContent>
                 </Card>

                 {/* Pricing Information */}
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                       <DollarSign className="w-5 h-5 text-teal-600" />
                       Pricing Information
                     </CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       {/* Unit Price */}
                       <div>
                         <Label htmlFor="unitPrice">Unit Price *</Label>
                         <Input
                           id="unitPrice"
                           type="number"
                           step="0.01"
                           value={formData.pricing.unitPrice}
                           onChange={(e) => handleInputChange('pricing.unitPrice', e.target.value)}
                           className={errors['pricing.unitPrice'] ? 'border-red-500' : ''}
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
                         <Label htmlFor="currency">Currency</Label>
                         <Select 
                           value={formData.pricing.currency} 
                           onValueChange={(value) => handleInputChange('pricing.currency', value)}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="AUD">AUD</SelectItem>
                             <SelectItem value="USD">USD</SelectItem>
                             <SelectItem value="MYR">MYR</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>

                       {/* Price Per Unit */}
                       <div>
                         <Label htmlFor="pricePerUnit">Price Per</Label>
                         <Select 
                           value={formData.pricing.pricePerUnit} 
                           onValueChange={(value) => handleInputChange('pricing.pricePerUnit', value)}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="each">Each</SelectItem>
                             <SelectItem value="meter">Per Meter</SelectItem>
                             <SelectItem value="kg">Per Kg</SelectItem>
                             <SelectItem value="tonne">Per Tonne</SelectItem>
                             <SelectItem value="sheet">Per Sheet</SelectItem>
                             <SelectItem value="sqm">Per Square Meter</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                     </div>
                   </CardContent>
                 </Card>

                 {/* Stock Information */}
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                       <Package className="w-5 h-5 text-teal-600" />
                       Stock Information
                     </CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       {/* Current Quantity */}
                       <div>
                         <Label htmlFor="quantity">Current Quantity</Label>
                         <Input
                           id="quantity"
                           type="number"
                           value={formData.stock.quantity}
                           onChange={(e) => handleInputChange('stock.quantity', e.target.value)}
                           placeholder="9000"
                         />
                       </div>

                       {/* Minimum Stock */}
                       <div>
                         <Label htmlFor="minStock">Minimum Stock Level</Label>
                         <Input
                           id="minStock"
                           type="number"
                           value={formData.stock.minStock}
                           onChange={(e) => handleInputChange('stock.minStock', e.target.value)}
                           placeholder="100"
                         />
                       </div>

                       {/* Storage Location */}
                       <div>
                         <Label htmlFor="location">Storage Location</Label>
                         <Input
                           id="location"
                           type="text"
                           value={formData.stock.location}
                           onChange={(e) => handleInputChange('stock.location', e.target.value)}
                           placeholder="Warehouse A - Section B2"
                         />
                       </div>
                     </div>
                   </CardContent>
                 </Card>

                 {/* Specifications */}
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                       <Wrench className="w-5 h-5 text-teal-600" />
                       Technical Specifications
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                     {/* Add Specification */}
                     <Card>
                       <CardContent className="p-4">
                         <h4 className="font-medium text-gray-900 mb-3">Add Specification</h4>
                         <div className="flex flex-col sm:flex-row gap-3">
                           <Input
                             type="text"
                             value={newSpec.key}
                             onChange={(e) => setNewSpec({...newSpec, key: e.target.value})}
                             placeholder="Property name (e.g. Tensile Strength)"
                             className="flex-1"
                           />
                           <Input
                             type="text"
                             value={newSpec.value}
                             onChange={(e) => setNewSpec({...newSpec, value: e.target.value})}
                             placeholder="Value (e.g. 400 MPa)"
                             className="flex-1"
                           />
                           <Button
                             type="button"
                             onClick={addSpecification}
                             className="whitespace-nowrap"
                           >
                             <Plus className="w-4 h-4 mr-2" />
                             Add Spec
                           </Button>
                         </div>
                       </CardContent>
                     </Card>

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
                             <Card key={index}>
                               <CardContent className="p-3">
                                 <div className="flex items-center justify-between">
                                   <div className="flex-1">
                                     <div className="font-medium text-gray-900">{spec.key}</div>
                                     <div className="text-sm text-gray-600">{spec.value}</div>
                                   </div>
                                   <Button
                                     type="button"
                                     variant="ghost"
                                     size="sm"
                                     onClick={() => removeSpecification(index)}
                                     className="text-red-600 hover:text-red-700 hover:bg-red-100"
                                   >
                                     <Trash2 className="w-4 h-4" />
                                   </Button>
                                 </div>
                               </CardContent>
                             </Card>
                           ))
                         )}
                       </div>
                     </div>
                   </CardContent>
                 </Card>

                 {/* Tags */}
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                       <Tag className="w-5 h-5 text-teal-600" />
                       Product Tags
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                     {/* Add Tag */}
                     <Card>
                       <CardContent className="p-4">
                         <h4 className="font-medium text-gray-900 mb-3">Add Tag</h4>
                         <div className="flex gap-3">
                           <Input
                             type="text"
                             value={newTag}
                             onChange={(e) => setNewTag(e.target.value)}
                             placeholder="Enter tag (e.g. heavy-duty, outdoor, galvanized)"
                             className="flex-1"
                           />
                           <Button
                             type="button"
                             onClick={addTag}
                             className="whitespace-nowrap"
                           >
                             <Plus className="w-4 h-4 mr-2" />
                             Add Tag
                           </Button>
                         </div>
                       </CardContent>
                     </Card>

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
                             <Badge key={index} variant="secondary" className="flex items-center gap-1">
                               <span>{tag}</span>
                               <Button
                                 type="button"
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => removeTag(index)}
                                 className="h-auto p-0.5 hover:bg-destructive hover:text-destructive-foreground"
                               >
                                 <X className="w-3 h-3" />
                               </Button>
                             </Badge>
                           ))
                         )}
                       </div>
                     </div>
                   </CardContent>
                 </Card>

                 {/* Submit Error */}
                 {errors.submit && (
                   <Alert variant="destructive">
                     <XCircle className="w-4 h-4" />
                     <AlertDescription>{errors.submit}</AlertDescription>
                   </Alert>
                 )}

                 {/* Form Actions */}
                 <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-gray-200">
                   <Button
                     type="button"
                     variant="outline"
                     onClick={() => {
                       setShowForm(false);
                       resetForm();
                     }}
                   >
                     <X className="w-4 h-4 mr-2" />
                     Cancel
                   </Button>
                   <Button
                     type="submit"
                     disabled={isSubmitting || codeExists}
                     className="min-w-[140px]"
                   >
                     {isSubmitting ? (
                       <>
                         <Loader className="w-4 h-4 mr-2 animate-spin" />
                         {editingProduct ? 'Updating...' : 'Adding...'}
                       </>
                     ) : (
                       <>
                         <Save className="w-4 h-4 mr-2" />
                         {editingProduct ? 'Update Product' : 'Add Product'}
                       </>
                     )}
                   </Button>
                 </div>
               </form>
             </CardContent>
           </Card>
         </CollapsibleContent>
       </Collapsible>

       {/* Products Table */}
       <Card>
         {filteredProducts.length === 0 ? (
           <CardContent className="p-8 sm:p-12 text-center">
             <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
             <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
             <p className="text-gray-600">Try adjusting your search criteria or add a new product.</p>
           </CardContent>
         ) : (
           <div className="overflow-x-auto">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Product</TableHead>
                   <TableHead>Category & Material</TableHead>
                   <TableHead>Dimensions</TableHead>
                   <TableHead>Pricing & Stock</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="text-right">Actions</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredProducts.map((product) => (
                   <TableRow key={product.id} className="hover:bg-gray-50">
                     <TableCell>
                       <div>
                         <div className="font-medium text-gray-900">{product.itemCode}</div>
                         <div className="text-sm text-gray-600">{product.productName}</div>
                         <div className="text-xs text-gray-500 max-w-xs truncate">
                           {product.description}
                         </div>
                       </div>
                     </TableCell>

                     <TableCell>
                       <div>
                         <div className="text-sm font-medium text-gray-900">{product.category}</div>
                         <div className="text-sm text-gray-600">{product.material}</div>
                         {product.finish && (
                           <div className="text-xs text-gray-500">{product.finish}</div>
                         )}
                       </div>
                     </TableCell>

                     <TableCell>
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
                     </TableCell>

                     <TableCell>
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
                     </TableCell>

                     <TableCell>
                       <div className="space-y-1">
                         <Badge variant={product.isActive ? 'default' : 'secondary'}>
                           {product.isActive ? 'Active' : 'Inactive'}
                         </Badge>

                         {product.isACRSCertified && (
                           <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                             <Shield className="w-3 h-3 mr-1" />
                             ACRS Certified
                           </Badge>
                         )}

                         {product.tags && product.tags.length > 0 && (
                           <div className="flex flex-wrap gap-1">
                             {product.tags.slice(0, 2).map((tag, index) => (
                               <Badge key={index} variant="outline" className="text-xs">
                                 {tag}
                               </Badge>
                             ))}
                             {product.tags.length > 2 && (
                               <span className="text-xs text-gray-500">+{product.tags.length - 2}</span>
                             )}
                           </div>
                         )}
                       </div>
                     </TableCell>

                     <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-2">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleEditProduct(product)}
                         >
                           <Edit className="w-4 h-4" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleDeleteProduct(product)}
                           className="text-red-600 hover:text-red-700 hover:bg-red-100"
                         >
                           <Trash2 className="w-4 h-4" />
                         </Button>
                       </div>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </div>
         )}
       </Card>
     </div>
   </div>
 );
};

export default ProductManagement;