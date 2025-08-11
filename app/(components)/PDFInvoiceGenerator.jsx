'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, Printer, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import PurchaseOrderGenerator from './PurchaseOrderGenerator';

const PDFInvoiceModal = ({ purchaseOrder, onClose }) => {
  const [uploadStatus, setUploadStatus] = useState('uploading');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [customerCompanyData, setCustomerCompanyData] = useState(null);
  const [pdfGenerator] = useState(() => new PurchaseOrderGenerator());

  // Helper functions to safely access nested data
  const getProductInfo = () => {
    if (!purchaseOrder) return {};
    
    // Handle both selectedProduct and product structures
    const product = purchaseOrder.selectedProduct || purchaseOrder.product || purchaseOrder;
    
    return {
      name: product.productName || product.barType || product.itemCode || 'Product',
      itemCode: product.itemCode || '',
      category: product.category || '',
      material: product.material || '',
      dimensions: product.dimensions || product.length || 'Standard',
      description: product.description || ''
    };
  };

  const getQuantityInfo = () => {
  if (!purchaseOrder) return { quantity: 0, unit: 'units' };
  
  // Get unit from the product data, not hardcoded
  const product = purchaseOrder.selectedProduct || purchaseOrder.product || purchaseOrder.items?.[0] || {};
  
  return {
    quantity: purchaseOrder.quantity || purchaseOrder.orderFormData?.quantity || product.quantity || 0,
    unit: product.pricePerUnit || product.unit || purchaseOrder.unit || 'units' // Use pricePerUnit from product
  };
};

  const getTotalAmount = () => {
    if (!purchaseOrder) return 0;
    
    // Try different possible total amount locations
    return purchaseOrder.totals?.total || 
           purchaseOrder.totalAmount || 
           purchaseOrder.orderFormData?.totalAmount ||
           purchaseOrder.calculateTotals?.total ||
           0;
  };

  const getCustomerInfo = () => {
    if (!purchaseOrder) return {};
    
    // Handle different customer info structures
    const customerInfo = purchaseOrder.customerInfo || 
                        purchaseOrder.orderFormData?.customerInfo || 
                        {};
    
    return {
      companyName: customerInfo.companyName || '',
      contactPerson: customerInfo.contactPerson || '',
      email: customerInfo.email || '',
      phone: customerInfo.phone || ''
    };
  };

  const getDeliveryAddress = () => {
    if (!purchaseOrder) return {};
    
    // Handle different address structures
    const customerInfo = purchaseOrder.customerInfo || 
                        purchaseOrder.orderFormData?.customerInfo || 
                        {};
    
    const address = customerInfo.address || 
                   purchaseOrder.deliveryAddress || 
                   {};
    
    // Handle both object and string address formats
    if (typeof address === 'string') {
      return { fullAddress: address };
    }
    
    return {
      street: address.street || '',
      city: address.city || '',
      state: address.state || '',
      postcode: address.postcode || '',
      country: address.country || 'Australia',
      fullAddress: address.fullAddress || 
                  `${address.street || ''}, ${address.city || ''} ${address.state || ''} ${address.postcode || ''}`.trim()
    };
  };

  const getOrderDetails = () => {
    if (!purchaseOrder) return {};
    
    return {
      poNumber: purchaseOrder.poNumber || 
               purchaseOrder.id || 
               `PO-${Date.now()}`,
      orderDate: purchaseOrder.orderDate || 
                purchaseOrder.orderFormData?.orderDate || 
                new Date().toISOString().split('T')[0],
      reference: purchaseOrder.reference || 
                purchaseOrder.orderFormData?.reference || '',
      notes: purchaseOrder.notes || 
             purchaseOrder.orderFormData?.notes || ''
    };
  };

  const formatCurrency = (amount) => {
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2
    }).format(numAmount);
  };

  // Fetch customer company data
  useEffect(() => {
    fetchCustomerCompanyData();
  }, []);

  // Auto-upload after company data is fetched
  useEffect(() => {
    if (customerCompanyData !== null) {
      uploadToFirebase();
    }
  }, [customerCompanyData]);

  const fetchCustomerCompanyData = async () => {
    try {
      const companyData = await pdfGenerator.fetchCustomerCompanyData(purchaseOrder);
      setCustomerCompanyData(companyData);
    } catch (error) {
      console.error('Error fetching customer company data:', error);
      setCustomerCompanyData({});
    }
  };

  const uploadToFirebase = async () => {
    try {
      setUploadStatus('uploading');
      setUploadProgress(0);

      const downloadURL = await pdfGenerator.uploadToFirebase(
        purchaseOrder,
        customerCompanyData,
        setUploadProgress
      );

      setPdfUrl(downloadURL);
      setUploadStatus('success');
      
    } catch (error) {
      console.error('Error uploading PDF:', error);
      setUploadStatus('error');
    }
  };

  const handlePrint = () => {
    pdfGenerator.generatePDFForPrint(purchaseOrder, customerCompanyData);
  };

  const handleDownload = () => {
    const orderDetails = getOrderDetails();
    pdfGenerator.downloadFromFirebase(pdfUrl, orderDetails.poNumber);
  };

  const handleRetryUpload = () => {
    uploadToFirebase();
  };

  if (!purchaseOrder) return null;

  // Get all the data using helper functions
  const productInfo = getProductInfo();
  const quantityInfo = getQuantityInfo();
  const totalAmount = getTotalAmount();
  const customerInfo = getCustomerInfo();
  const deliveryAddress = getDeliveryAddress();
  const orderDetails = getOrderDetails();

  // Show loading while fetching customer data
  if (customerCompanyData === null) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl max-w-md w-full p-6 border border-white/30 shadow-2xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader className="w-8 h-8 text-white animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-teal-800 mb-2">Preparing Invoice</h2>
            <p className="text-teal-700/70">Loading customer information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl max-w-md w-full p-6 border border-white/30 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            {uploadStatus === 'uploading' ? (
              <Loader className="w-8 h-8 text-white animate-spin" />
            ) : uploadStatus === 'success' ? (
              <CheckCircle className="w-8 h-8 text-white" />
            ) : uploadStatus === 'error' ? (
              <AlertCircle className="w-8 h-8 text-white" />
            ) : (
              <FileText className="w-8 h-8 text-white" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-teal-800 mb-2">
            {uploadStatus === 'uploading' ? 'Creating Order' :
             uploadStatus === 'success' ? 'Order Created Successfully!' :
             uploadStatus === 'error' ? 'Upload Failed' :
             'Purchase Order Created!'}
          </h2>
          <p className="text-teal-700/70">
            PO Number: <span className="font-medium">{orderDetails.poNumber}</span>
          </p>
          
         
          
          {uploadStatus === 'uploading' && (
            <div className="mt-4">
              <div className="w-full bg-teal-200/30 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-teal-600/70 mt-2">{uploadProgress}% complete</p>
            </div>
          )}
          
          {uploadStatus === 'error' && (
            <div className="mt-4 p-3 bg-red-50/50 rounded-lg border border-red-200/50">
              <p className="text-sm text-red-700">❌ Failed to upload PDF</p>
              <p className="text-xs text-red-600/70 mt-1">Please try the manual upload or contact support</p>
            </div>
          )}
        </div>

        <div className="space-y-4 mb-6">
          {/* Product Information */}
          <div className="bg-gradient-to-r from-teal-50/50 to-emerald-50/50 rounded-lg p-4 border border-teal-200/30">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-teal-700/70">Product:</span>
              <span className="font-medium text-teal-800 text-right flex-1 ml-2">
                {productInfo.name}
                {productInfo.itemCode && ` (${productInfo.itemCode})`}
              </span>
            </div>
            
            {productInfo.category && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-teal-700/70">Category:</span>
                <span className="font-medium text-teal-800">{productInfo.category}</span>
              </div>
            )}
            
            {productInfo.material && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-teal-700/70">Material:</span>
                <span className="font-medium text-teal-800">{productInfo.material}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-teal-700/70">Quantity:</span>
              <span className="font-medium text-teal-800">
                {quantityInfo.quantity} {quantityInfo.unit}
              </span>
            </div>
            
            <div className="flex justify-between items-center border-t border-teal-200/50 pt-2">
              <span className="text-sm text-teal-700/70">Total Amount:</span>
              <span className="font-bold text-teal-600">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Customer Information */}
          {customerInfo.companyName && (
            <div className="bg-white/50 rounded-lg p-4 border border-white/30">
              <div className="text-sm text-teal-700/70 mb-2">Customer:</div>
              <div className="text-sm text-teal-800">
                <div className="font-medium">{customerInfo.companyName}</div>
                {customerInfo.contactPerson && (
                  <div>{customerInfo.contactPerson}</div>
                )}
                {customerInfo.email && (
                  <div className="text-teal-600">{customerInfo.email}</div>
                )}
                {customerInfo.phone && (
                  <div>{customerInfo.phone}</div>
                )}
              </div>
            </div>
          )}

          {/* Delivery Address */}
          {(deliveryAddress.fullAddress || deliveryAddress.street) && (
            <div className="bg-white/50 rounded-lg p-4 border border-white/30">
              <div className="text-sm text-teal-700/70 mb-2">Delivery Address:</div>
              <div className="text-sm text-teal-800">
                {deliveryAddress.fullAddress || (
                  <>
                    {deliveryAddress.street && <div>{deliveryAddress.street}</div>}
                    {(deliveryAddress.city || deliveryAddress.state || deliveryAddress.postcode) && (
                      <div>
                        {deliveryAddress.city} {deliveryAddress.state} {deliveryAddress.postcode}
                      </div>
                    )}
                    {deliveryAddress.country && deliveryAddress.country !== 'Australia' && (
                      <div>{deliveryAddress.country}</div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Order Details */}
          {(orderDetails.reference || orderDetails.notes) && (
            <div className="bg-white/50 rounded-lg p-4 border border-white/30">
              <div className="text-sm text-teal-700/70 mb-2">Order Details:</div>
              <div className="text-sm text-teal-800 space-y-1">
                {orderDetails.reference && (
                  <div><span className="text-teal-700/70">Reference:</span> {orderDetails.reference}</div>
                )}
                {orderDetails.notes && (
                  <div><span className="text-teal-700/70">Notes:</span> {orderDetails.notes}</div>
                )}
                <div><span className="text-teal-700/70">Order Date:</span> {orderDetails.orderDate}</div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Print PDF Button */}
          <button
            onClick={handlePrint}
            disabled={uploadStatus === 'uploading'}
            className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            Print Purchase Order
          </button>

          {/* Download Button (only show if upload succeeded) */}
          {uploadStatus === 'success' && pdfUrl && (
            <button
              onClick={handleDownload}
              className="w-full px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg hover:from-teal-700 hover:to-emerald-700 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Purchase Order
            </button>
          )}

          {/* Retry Upload (only show if upload failed) */}
          {uploadStatus === 'error' && (
            <button
              onClick={handleRetryUpload}
              className="w-full px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Retry Upload
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-teal-200 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-teal-700/60">
            {uploadStatus === 'uploading' 
              ? 'Automatically uploading to cloud storage...'
              : uploadStatus === 'success' 
              ? 'PDF safely stored in cloud storage for future access'
              : uploadStatus === 'error'
              ? 'Upload failed - you can retry or contact support'
              : 'PDF will be automatically uploaded to cloud storage'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default PDFInvoiceModal;