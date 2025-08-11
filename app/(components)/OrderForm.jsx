// components/orderForm/OrderForm.jsx
'use client';

import React, {useEffect, useState} from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Building, 
  Mail, 
  Phone, 
  FileText, 
  CreditCard, 
  Package,
  MapPin,
  AlertCircle,
  CheckCircle,
  Truck,
  Calendar,
  BarChart3
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';

const OrderForm = ({
  selectedProduct,
  orderFormData,
  isSubmitting = false,
  onClose,
  onFormDataChange,
  onSubmit,
  calculateTotals,
  formatCurrency
}) => {
  if (!selectedProduct) return null;

  const [isACRSCertified, setIsACRSCertified] = useState(false);
  const [loadingACRS, setLoadingACRS] = useState(true);

  useEffect(() => {
    const fetchACRSStatus = async () => {
      if (!selectedProduct.code && !selectedProduct.productCode) {
        setLoadingACRS(false);
        return;
      }

      try {
        setLoadingACRS(true);
        
        // Query products collection by code or productCode
        const productsRef = collection(db, 'products');
        const productCode = selectedProduct.code || selectedProduct.productCode;
        const q = query(productsRef, where('code', '==', productCode));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const productDoc = querySnapshot.docs[0];
          const productData = productDoc.data();
          console.log('Fetched product data:', productData);
          console.log('product code', productCode);
          
          // Check if grade contains ACRS or if there's an explicit ACRS field
          const gradeContainsACRS = productData.grade && productData.grade.toLowerCase().includes('acrs');
          setIsACRSCertified(productData.isACRSCertified || gradeContainsACRS || false);
        } else {
          // Check if grade in selectedProduct contains ACRS
          const gradeContainsACRS = selectedProduct.grade && selectedProduct.grade.toLowerCase().includes('acrs');
          setIsACRSCertified(gradeContainsACRS || false);
        }
      } catch (error) {
        console.error('Error fetching ACRS certification status:', error);
        // Fallback to checking grade in selectedProduct
        const gradeContainsACRS = selectedProduct.grade && selectedProduct.grade.toLowerCase().includes('acrs');
        setIsACRSCertified(gradeContainsACRS || false);
      } finally {
        setLoadingACRS(false);
      }
    };

    fetchACRSStatus();
  }, [selectedProduct.code, selectedProduct.productCode, selectedProduct.grade]);

  const totals = calculateTotals();

  // Enhanced form validation
  const validateForm = () => {
    const errors = [];
    
    // Check required fields
    if (!orderFormData.customerInfo.companyName.trim()) {
      errors.push('Company name is required');
    }
    
    if (!orderFormData.customerInfo.contactPerson.trim()) {
      errors.push('Contact person is required');
    }
    
    if (!orderFormData.customerInfo.email.trim()) {
      errors.push('Email is required');
    }
    
    // Address validation
    if (!orderFormData.customerInfo.address.street.trim()) {
      errors.push('Street address is required');
    }
    
    if (!orderFormData.customerInfo.address.city.trim()) {
      errors.push('City is required');
    }
    
    if (!orderFormData.customerInfo.address.state.trim()) {
      errors.push('State is required');
    }
    
    if (!orderFormData.customerInfo.address.postcode.trim()) {
      errors.push('Postcode is required');
    }

    // Quantity validation
    if (!orderFormData.quantity || orderFormData.quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    // Check minimum order quantity if specified on product
    if (selectedProduct.minimumOrderQuantity && orderFormData.quantity < selectedProduct.minimumOrderQuantity) {
      errors.push(`Minimum order quantity is ${selectedProduct.minimumOrderQuantity} ${selectedProduct.unit || 'units'}`);
    }
    
    return errors;
  };

  // Enhanced submit handler with validation
  // Enhanced submit handler with validation and data cleaning
const handleSubmit = (e) => {
  e.preventDefault();
  
  // Clean the data before submission to remove undefined values
  const cleanedData = {
    // Product information
    selectedProduct: {
      code: selectedProduct.code || selectedProduct.productCode || '',
      productCode: selectedProduct.productCode || selectedProduct.code || '',
      category: selectedProduct.category || '',
      type: selectedProduct.type || '',
      grade: selectedProduct.grade || '',
      pricePerTonne: selectedProduct.pricePerTonne || 0,
      unit: selectedProduct.unit || 'Tonne',
      diameter: selectedProduct.diameter || null,
      length: selectedProduct.length || null,
      longWire: selectedProduct.longWire || null,
      crossWire: selectedProduct.crossWire || null,
      massPerMeter: selectedProduct.massPerMeter || null,
      weight: selectedProduct.weight || null,
      minimumOrderQuantity: selectedProduct.minimumOrderQuantity || null,
      applications: selectedProduct.applications || [],
      standardSizes: selectedProduct.standardSizes || [],
      moqNote: selectedProduct.moqNote || '',
      deliveryTerms: selectedProduct.deliveryTerms || '',
      offer: selectedProduct.offer || ''
    },
    
    // Order details
    quantity: orderFormData.quantity || 1,
    orderDate: orderFormData.orderDate || new Date().toISOString().split('T')[0],
    requiredBy: orderFormData.requiredBy || '',
    reference: orderFormData.reference || '',
    notes: orderFormData.notes || '',
    
    // Customer information
    customerInfo: {
      companyName: orderFormData.customerInfo?.companyName?.trim() || '',
      contactPerson: orderFormData.customerInfo?.contactPerson?.trim() || '',
      email: orderFormData.customerInfo?.email?.trim() || '',
      phone: orderFormData.customerInfo?.phone?.trim() || '',
      address: {
        street: orderFormData.customerInfo?.address?.street?.trim() || '',
        city: orderFormData.customerInfo?.address?.city?.trim() || '',
        state: orderFormData.customerInfo?.address?.state || '',
        postcode: orderFormData.customerInfo?.address?.postcode?.trim() || '',
        country: orderFormData.customerInfo?.address?.country || 'Australia'
      }
    },
    
    // Totals
    totals: {
      subtotal: totals.subtotal || 0,
      gst: totals.gst || 0,
      total: totals.total || 0
    }
  };
  
  // Remove any remaining undefined values recursively
  const cleanObject = (obj) => {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        // Skip undefined values
        continue;
      } else if (value === null) {
        // Keep null values as they're valid in Firestore
        cleaned[key] = null;
      } else if (Array.isArray(value)) {
        // Clean arrays
        cleaned[key] = value.filter(item => item !== undefined);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively clean nested objects
        cleaned[key] = cleanObject(value);
      } else {
        // Keep other values
        cleaned[key] = value;
      }
    }
    return cleaned;
  };
  
  const finalCleanedData = cleanObject(cleanedData);
  
  console.log('Cleaned order data:', finalCleanedData);
  
  // Pass cleaned data to submit handler
  onSubmit(e, finalCleanedData);
};

  // Helper function to get product display name
  const getProductDisplayName = () => {
    if (selectedProduct.type === 'deformed_reinforcing_bar') {
      return `${selectedProduct.code} - Deformed Reinforcing Bar (${selectedProduct.diameter}mm)`;
    }
    if (selectedProduct.type === 'square_reinforcing_mesh') {
      return `${selectedProduct.code} - Square Reinforcing Mesh`;
    }
    if (selectedProduct.type === 'rectangular_reinforcing_mesh') {
      return `${selectedProduct.code} - Rectangular Reinforcing Mesh`;
    }
    if (selectedProduct.type === 'trench_mesh') {
      return `${selectedProduct.code} - Trench Mesh`;
    }
    return selectedProduct.code || selectedProduct.productCode || 'Unknown Product';
  };

  // Helper function to get product specifications
  const getProductSpecs = () => {
    const specs = [];
    
    if (selectedProduct.diameter) {
      specs.push(`Diameter: ${selectedProduct.diameter}mm`);
    }
    if (selectedProduct.length) {
      specs.push(`Length: ${selectedProduct.length/1000}m`);
    }
    if (selectedProduct.longWire) {
      specs.push(`Long Wire: ${selectedProduct.longWire}`);
    }
    if (selectedProduct.crossWire) {
      specs.push(`Cross Wire: ${selectedProduct.crossWire}`);
    }
    if (selectedProduct.massPerMeter) {
      specs.push(`Mass: ${selectedProduct.massPerMeter}kg/m`);
    }
    if (selectedProduct.weight) {
      specs.push(`Weight: ${selectedProduct.weight}kg/sheet`);
    }
    
    return specs;
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-teal-200/40 shadow-2xl overflow-hidden z-[99]"
    >
      <div className="p-8">
        {/* Form Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-teal-100/50">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-3 hover:bg-teal-50/50 rounded-xl transition-colors border border-teal-200/40 hover:border-teal-300/60 shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 text-teal-600" />
            </button>
            <div className="border-l-4 border-teal-500 pl-4">
              <h3 className="text-2xl font-semibold text-teal-800">Create Order</h3>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-600" />
                <p className="text-teal-600/80 font-medium">
                  {getProductDisplayName()}
                </p>
              </div>
            </div>
          </div>
          <div className="border-2 border-teal-200/40 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-end gap-3">
              <p className="text-lg text-teal-700 font-semibold">Purchase Order</p>
              {!loadingACRS && isACRSCertified && (
                <img 
                  src="/acrs_logo.png"
                  alt="ACRS Certified"
                  className="h-20 w-auto object-contain border border-blue-200 rounded bg-white p-2"
                  title="This product is ACRS certified"
                />
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Product Summary */}
          <div className="bg-gradient-to-r from-teal-50/80 to-emerald-50/80 border-2 border-teal-200/30 rounded-xl p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="border-r-2 border-teal-200/40 pr-6">
                <p className="text-sm text-teal-600/70 font-medium mb-1">Product Code</p>
                <p className="font-bold text-teal-800 text-lg">
                  {selectedProduct.code || selectedProduct.productCode}
                </p>
              </div>
              <div className="border-r-2 border-teal-200/40 pr-6">
                <p className="text-sm text-teal-600/70 font-medium mb-1">Type</p>
                <p className="font-bold text-teal-800 text-lg">
                  {selectedProduct.category === 'mesh' ? 'Reinforcing Mesh' : 'Reinforcing Bar'}
                </p>
              </div>
              <div className="border-r-2 border-teal-200/40 pr-6">
                <p className="text-sm text-teal-600/70 font-medium mb-1">Grade</p>
                <p className="font-bold text-teal-800 text-lg">{selectedProduct.grade}</p>
              </div>
              <div>
                <p className="text-sm text-teal-600/70 font-medium mb-1">Unit Price</p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-teal-800 text-lg">
                    {formatCurrency(selectedProduct.pricePerTonne)}
                    <span className="text-sm text-teal-600 ml-1">per tonne</span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Product Specifications */}
            {getProductSpecs().length > 0 && (
              <div className="mt-4 pt-4 border-t border-teal-200/40">
                <p className="text-sm text-teal-600/70 font-medium mb-2">Specifications</p>
                <div className="flex flex-wrap gap-2">
                  {getProductSpecs().map((spec, index) => (
                    <span key={index} className="px-3 py-1 bg-teal-100/50 text-teal-700 rounded-full text-sm font-medium border border-teal-200/40">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MOQ Notice */}
          {selectedProduct.minimumOrderQuantity && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-800 mb-2">Minimum Order Quantity</h4>
                  <p className="text-amber-700 text-sm">
                    {selectedProduct.moqNote || `Minimum order: ${selectedProduct.minimumOrderQuantity} tonnes`}
                  </p>
                  {selectedProduct.deliveryTerms && (
                    <p className="text-amber-600 text-xs mt-2">
                      <strong>Delivery:</strong> {selectedProduct.deliveryTerms}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Applications */}
          {selectedProduct.applications && selectedProduct.applications.length > 0 && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
              <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Typical Applications
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedProduct.applications.map((application, index) => (
                  <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
                    {application}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Order Details */}
            <OrderDetailsSection 
              orderFormData={orderFormData}
              onFormDataChange={onFormDataChange}
              selectedProduct={selectedProduct}
            />

            {/* Right Column - Customer Information */}
            <CustomerInfoSection 
              orderFormData={orderFormData}
              onFormDataChange={onFormDataChange}
            />
          </div>

          {/* Order Summary */}
          <OrderSummary 
            totals={totals}
            selectedProduct={selectedProduct}
            quantity={orderFormData.quantity}
            formatCurrency={formatCurrency}
            getProductDisplayName={getProductDisplayName}
          />

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t-2 border-teal-100/50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-8 py-4 border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm text-teal-700 rounded-xl hover:bg-white/80 hover:border-teal-300/60 transition-all duration-200 font-semibold shadow-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-8 py-4 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl hover:from-teal-700 hover:to-emerald-700 transition-all duration-200 flex items-center justify-center gap-3 font-semibold shadow-lg border-2 border-teal-500/40 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {isSubmitting ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

// Enhanced Order Details Section Component
const OrderDetailsSection = ({ orderFormData, onFormDataChange, selectedProduct }) => {
  // Helper to get unit display
  const getUnitDisplay = () => {
    if (selectedProduct.category === 'mesh') {
      return selectedProduct.unit || 'Sheet';
    }
    if (selectedProduct.category === 'rebar') {
      return 'Tonne';
    }
    return 'Tonne';
  };

  // Helper to get step value for quantity input
  const getQuantityStep = () => {
    if (selectedProduct.category === 'mesh') {
      return 1; // Sheets are whole numbers
    }
    return 0.1; // Tonnes can be decimal
  };

  return (
    <div className="space-y-6 border-2 border-teal-200/30 rounded-xl p-6 bg-white/40 backdrop-blur-sm shadow-lg">
      <div>
        <h4 className="text-xl font-semibold text-teal-800 mb-6 flex items-center gap-3 border-b-2 border-teal-100/50 pb-4">
          <div className="p-2 bg-teal-100/50 rounded-lg border border-teal-200/50">
            <Package className="w-5 h-5 text-teal-600" />
          </div>
          Order Details
        </h4>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-teal-700 mb-3">
              Quantity ({getUnitDisplay()})
              {selectedProduct.minimumOrderQuantity && (
                <span className="text-amber-600 text-xs ml-2">
                  Minimum: {selectedProduct.minimumOrderQuantity} tonnes
                </span>
              )}
            </label>
            <input
              type="number"
              min={selectedProduct.minimumOrderQuantity || getQuantityStep()}
              step={getQuantityStep()}
              value={orderFormData.quantity || 1}
              onChange={(e) => {
                const newQuantity = parseFloat(e.target.value) || 0;
                onFormDataChange('quantity', newQuantity);
              }}
              className={`w-full px-4 py-4 rounded-xl border-2 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium ${
                selectedProduct.minimumOrderQuantity && orderFormData.quantity < selectedProduct.minimumOrderQuantity
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-teal-200/40'
              }`}
              placeholder={selectedProduct.minimumOrderQuantity?.toString() || "1"}
              required
            />
            
            {/* Minimum Order Quantity Warning */}
            {selectedProduct.minimumOrderQuantity && orderFormData.quantity < selectedProduct.minimumOrderQuantity && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm mt-2">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Minimum Order Quantity Notice</span>
                </div>
                <p className="text-amber-600 mt-1">
                  {selectedProduct.moqNote || `This product requires a minimum order of ${selectedProduct.minimumOrderQuantity} tonnes.`}
                </p>
              </div>
            )}

            {/* Standard Sizes Information */}
            {selectedProduct.standardSizes && selectedProduct.standardSizes.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm mt-2">
                <div className="flex items-center gap-2 text-blue-700">
                  <Package className="w-4 h-4" />
                  <span className="font-medium">Available Sizes</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedProduct.standardSizes.map((size, index) => (
                    <span key={index} className="text-blue-600 bg-blue-100 px-2 py-1 rounded text-xs">
                      {size}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-teal-700 mb-3">
                Order Date
              </label>
              <input
                type="date"
                value={orderFormData.orderDate}
                onChange={(e) => onFormDataChange('orderDate', e.target.value)}
                className="w-full px-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-teal-700 mb-3">
                Required By
              </label>
              <input
                type="date"
                value={orderFormData.requiredBy}
                onChange={(e) => onFormDataChange('requiredBy', e.target.value)}
                className="w-full px-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
              />
            </div>
          </div>

          <div className="border-t-2 border-teal-100/50 pt-6">
            <label className="block text-sm font-semibold text-teal-700 mb-3">
              Reference (Optional)
            </label>
            <input
              type="text"
              value={orderFormData.reference}
              onChange={(e) => onFormDataChange('reference', e.target.value)}
              placeholder="Project reference, PO number, etc."
              className="w-full px-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 placeholder-teal-500/60 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-teal-700 mb-3">
              Notes (Optional)
            </label>
            <textarea
              value={orderFormData.notes}
              onChange={(e) => onFormDataChange('notes', e.target.value)}
              rows="4"
              placeholder="Special delivery instructions, additional requirements..."
              className="w-full px-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 placeholder-teal-500/60 resize-none transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Customer Information Section Component (unchanged as it's generic)
const CustomerInfoSection = ({ orderFormData, onFormDataChange }) => (
  <div className="space-y-6 border-2 border-teal-200/30 rounded-xl p-6 bg-white/40 backdrop-blur-sm shadow-lg">
    <div>
      <h4 className="text-xl font-semibold text-teal-800 mb-6 flex items-center gap-3 border-b-2 border-teal-100/50 pb-4">
        <div className="p-2 bg-teal-100/50 rounded-lg border border-teal-200/50">
          <User className="w-5 h-5 text-teal-600" />
        </div>
        Customer Information
      </h4>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-teal-700 mb-3">
            Company Name
          </label>
          <div className="relative">
            <Building className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-teal-500/60" />
            <input
              type="text"
              value={orderFormData.customerInfo.companyName}
              onChange={(e) => onFormDataChange('customerInfo.companyName', e.target.value)}
              placeholder="Your company name"
              className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 placeholder-teal-500/60 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-teal-700 mb-3">
            Contact Person
          </label>
          <div className="relative">
            <User className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-teal-500/60" />
            <input
              type="text"
              value={orderFormData.customerInfo.contactPerson}
              onChange={(e) => onFormDataChange('customerInfo.contactPerson', e.target.value)}
              placeholder="Full name"
              className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 placeholder-teal-500/60 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t-2 border-teal-100/50 pt-6">
          <div>
            <label className="block text-sm font-semibold text-teal-700 mb-3">
              Email
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-teal-500/60" />
              <input
                type="email"
                value={orderFormData.customerInfo.email}
                onChange={(e) => onFormDataChange('customerInfo.email', e.target.value)}
                placeholder="email@company.com"
                className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 placeholder-teal-500/60 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-teal-700 mb-3">
              Phone
            </label>
            <div className="relative">
              <Phone className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-teal-500/60" />
              <input
                type="tel"
                value={orderFormData.customerInfo.phone}
                onChange={(e) => onFormDataChange('customerInfo.phone', e.target.value)}
                placeholder="+61 xxx xxx xxx"
                className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 placeholder-teal-500/60 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
                required
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Delivery Address */}
    <DeliveryAddressSection 
      address={orderFormData.customerInfo.address}
      onFormDataChange={onFormDataChange}
    />
  </div>
);

// Delivery Address Section Component (unchanged)
const DeliveryAddressSection = ({ address, onFormDataChange }) => (
  <div className="border-t-2 border-teal-100/50 pt-6">
    <h4 className="text-xl font-semibold text-teal-800 mb-6 flex items-center gap-3 border-b-2 border-teal-100/50 pb-4">
      <div className="p-2 bg-teal-100/50 rounded-lg border border-teal-200/50">
        <MapPin className="w-5 h-5 text-teal-600" />
      </div>
      Delivery Address
    </h4>
    
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-teal-700 mb-3">
          Street Address
        </label>
        <input
          type="text"
          value={address.street}
          onChange={(e) => onFormDataChange('customerInfo.address.street', e.target.value)}
          placeholder="123 Main Street"
          className="w-full px-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 placeholder-teal-500/60 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-teal-700 mb-3">
           City
         </label>
         <input
           type="text"
           value={address.city}
           onChange={(e) => onFormDataChange('customerInfo.address.city', e.target.value)}
           placeholder="Sydney"
           className="w-full px-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 placeholder-teal-500/60 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
           required
         />
       </div>
       <div>
         <label className="block text-sm font-semibold text-teal-700 mb-3">
           State
         </label>
         <select
           value={address.state}
           onChange={(e) => onFormDataChange('customerInfo.address.state', e.target.value)}
           className="w-full px-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
           required
         >
           <option value="">Select State</option>
           <option value="NSW">New South Wales</option>
           <option value="VIC">Victoria</option>
           <option value="QLD">Queensland</option>
           <option value="WA">Western Australia</option>
           <option value="SA">South Australia</option>
           <option value="TAS">Tasmania</option>
           <option value="ACT">Australian Capital Territory</option>
           <option value="NT">Northern Territory</option>
         </select>
       </div>
     </div>

     <div className="grid grid-cols-2 gap-4">
       <div>
         <label className="block text-sm font-semibold text-teal-700 mb-3">
           Postcode
         </label>
         <input
           type="text"
           value={address.postcode}
           onChange={(e) => onFormDataChange('customerInfo.address.postcode', e.target.value)}
           placeholder="2000"
           className="w-full px-4 py-4 rounded-xl border-2 border-teal-200/40 bg-white/60 backdrop-blur-sm focus:ring-4 focus:ring-teal-200/30 focus:border-teal-400 text-teal-800 placeholder-teal-500/60 transition-all duration-200 shadow-sm hover:border-teal-300/60 font-medium"
           required
         />
       </div>
       <div>
         <label className="block text-sm font-semibold text-teal-700 mb-3">
           Country
         </label>
         <input
           type="text"
           value={address.country}
           onChange={(e) => onFormDataChange('customerInfo.address.country', e.target.value)}
           className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50/60 text-teal-800 font-medium shadow-sm cursor-not-allowed"
           readOnly
         />
       </div>
     </div>
   </div>
 </div>
);

// Enhanced Order Summary Component
const OrderSummary = ({ totals, selectedProduct, quantity, formatCurrency, getProductDisplayName }) => (
 <div className="bg-gradient-to-r from-teal-100/80 to-emerald-100/80 backdrop-blur-sm rounded-xl p-8 border-2 border-teal-200/40 shadow-lg">
   <h4 className="text-xl font-semibold text-teal-800 mb-6 flex items-center gap-3 border-b-2 border-teal-200/50 pb-4">
     <div className="p-2 bg-teal-100/50 rounded-lg border border-teal-200/50">
       <CreditCard className="w-5 h-5 text-teal-600" />
     </div>
     Order Summary
   </h4>
   
   <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
     <div className="text-center border-2 border-teal-200/40 rounded-xl p-6 bg-white/40 backdrop-blur-sm shadow-sm">
       <p className="text-sm text-teal-600/70 font-semibold mb-2">Subtotal</p>
       <p className="text-2xl font-bold text-teal-800">
         {formatCurrency(totals.subtotal)}
       </p>
     </div>
     <div className="text-center border-2 border-teal-200/40 rounded-xl p-6 bg-white/40 backdrop-blur-sm shadow-sm">
       <p className="text-sm text-teal-600/70 font-semibold mb-2">GST (10%)</p>
       <p className="text-2xl font-bold text-teal-800">
         {formatCurrency(totals.gst)}
       </p>
     </div>
     <div className="text-center border-2 border-teal-400/50 rounded-xl p-6 bg-gradient-to-br from-teal-50/60 to-emerald-50/60 shadow-lg">
       <p className="text-sm text-teal-600/70 font-semibold mb-2">Total Amount</p>
       <p className="text-3xl font-bold text-teal-600">
         {formatCurrency(totals.total)}
       </p>
     </div>
   </div>

   {/* Product breakdown */}
   <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
     <h5 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
       <Package className="w-4 h-4" />
       Product Information
     </h5>
     <div className="text-sm text-blue-700 space-y-1">
       <div className="flex justify-between">
         <span>Product:</span>
         <span className="font-medium">{getProductDisplayName()}</span>
       </div>
       
       <div className="flex justify-between">
         <span>Category:</span>
         <span className="font-medium capitalize">{selectedProduct.category}</span>
       </div>
       
       <div className="flex justify-between">
         <span>Grade:</span>
         <span className="font-medium">{selectedProduct.grade}</span>
       </div>
       
       <div className="flex justify-between">
         <span>Quantity:</span>
         <span className="font-medium">
           {quantity} {selectedProduct.category === 'mesh' ? (selectedProduct.unit || 'Sheet') : 'Tonne'}
         </span>
       </div>
       
       <div className="flex justify-between">
         <span>Unit Price:</span>
         <span className="font-medium">{formatCurrency(selectedProduct.pricePerTonne)} per tonne</span>
       </div>

      
     </div>
   </div>

   <div className="text-center text-sm text-teal-600/80 border-t-2 border-teal-200/40 pt-4 font-medium">
     <p>
       Price: {formatCurrency(selectedProduct.pricePerTonne)} per tonne × {quantity} 
       {selectedProduct.category === 'mesh' ? ` ${selectedProduct.unit || 'sheets'}` : ' tonnes'}
     </p>
     
     {selectedProduct.deliveryTerms && (
       <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
         <p className="text-yellow-700 font-medium text-xs">
           <AlertCircle className="w-4 h-4 inline mr-1" />
           Delivery Terms
         </p>
         <p className="text-yellow-600 text-xs mt-1">
           {selectedProduct.deliveryTerms}
         </p>
       </div>
     )}
   </div>
 </div>
);

export default OrderForm;