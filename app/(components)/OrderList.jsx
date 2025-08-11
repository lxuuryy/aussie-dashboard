// OrderList.jsx - Updated without redundant data fetching
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronDown,
  ChevronUp,
  Truck, 
  MapPin, 
  FileText,
  Ship,
  FileSignature,
  Download,
  AlertCircle,
  FileCheck,
  User,
  ArrowRight,
  File,
  FilePlus,
  Waves,
  Building,
  Mail,
  Phone,
  Loader,
  View
} from 'lucide-react';
import { db } from '@/firebase';
import { onSnapshot, doc } from 'firebase/firestore';
import { useUser } from '@clerk/nextjs';
import SalesContractSignature from './SalesContractSignature';
import ViewTracker from './ViewTracker';


const OrderList = ({ orders = [], formatCurrency, formatDate, onOrdersUpdate, selectedCategory, availableCategories,availableMaterials,
  selectedMaterial,
  onCategoryFilter,
  onMaterialFilter }) => {
  const [loading, setLoading] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedOrderForSignature, setSelectedOrderForSignature] = useState(null);
  const [contractStatuses, setContractStatuses] = useState({});
  const router = useRouter();
  const { user } = useUser();

  // Get user email helper function
  const getUserEmail = () => {
    return user?.emailAddresses?.[0]?.emailAddress || user?.primaryEmailAddress?.emailAddress || user?.email || null;
  };

  React.useEffect(() => {
    console.log('orders updated:', orders);
    // Initialize contract statuses for new orders
  }), [orders];

  // Listen for contract status changes for all orders
  useEffect(() => {
    const unsubscribes = [];

    orders.forEach(order => {
      if (order.id) {
        const unsubscribe = onSnapshot(
          doc(db, 'orders', order.id),
          (doc) => {
            if (doc.exists()) {
              const data = doc.data();
              console.log(`Order ${order.id} updated:`, data);
              setContractStatuses(prev => ({
                ...prev,
                [order.id]: {
                  hasContract: !!data.contractUrl,
                  contractSigned: !!data.signature?.contractSigned,
                  signatureDate: data.signature?.signatureDate,
                  signerName: data.signature?.signerName,
                  contractStatus: data.contractStatus || 'pending',
                  originalContractUrl: data.contractUrl,
                  signedContractUrl: data.signedContractUrl,
                  signatureImageUrl: data.signature?.imageUrl,
                  

                }
              }));
            }
          },
          (error) => {
            console.error(`Error listening to order ${order.id}:`, error);
          }
        );
        
        unsubscribes.push(unsubscribe);
      }
    });

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [orders]);

   const handleViewTracker = (order) => {
    router.push(`/dashboard/ship-tracker/${order.id}`);
  };

  const handleViewPDF = (pdfUrl, orderNumber, isSignedContract = false) => {
    if (!pdfUrl) return;
    
    try {
      // Create a new window with download interface
      const newWindow = window.open('', '_blank');
      
      if (newWindow) {
        const documentType = isSignedContract ? 'Signed Contract' : 'Invoice PDF';
        const downloadFileName = isSignedContract ? 
          `Signed-Contract-${orderNumber || 'order'}.html` : 
          `Invoice-${orderNumber || 'order'}.pdf`;
        
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${documentType} - ${orderNumber || 'Order'}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
                min-height: 100vh;
                display: flex;
                flex-direction: column;
              }
              
              .header {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                padding: 1rem 2rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 1rem;
              }
              
              .header h1 {
                color: white;
                font-size: 1.25rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 0.5rem;
              }
              
              .actions {
                display: flex;
                gap: 0.5rem;
                flex-wrap: wrap;
              }
              
              .btn {
                padding: 0.75rem 1.25rem;
                border: none;
                border-radius: 0.5rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.875rem;
                white-space: nowrap;
              }
              
              .btn-close {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
              }
              
              .btn-close:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
              }
              
              .content {
                flex: 1;
                padding: 1rem;
                background: white;
                margin: 1rem;
                border-radius: 0.75rem;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                overflow: hidden;
              }
              
              .pdf-container {
                width: 100%;
                height: calc(100vh - 8rem);
                border: none;
                border-radius: 0.5rem;
              }
              
              .loading {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 200px;
                color: #6b7280;
                flex-direction: column;
                gap: 1rem;
              }
              
              .spinner {
                width: 2.5rem;
                height: 2.5rem;
                border: 3px solid #e5e7eb;
                border-top-color: #0d9488;
                border-radius: 50%;
                animation: spin 1s linear infinite;
              }
              
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
              
              @media print {
                .header { display: none; }
                .content { margin: 0; box-shadow: none; }
                body { background: white; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${isSignedContract ? '📜' : '📄'} ${documentType} - ${orderNumber || 'Order'}</h1>
              <div class="actions">
                <button class="btn btn-close" onclick="window.close()" title="Close this tab">
                  ✕ Close
                </button>
              </div>
            </div>
            
            <div class="content">
              <div class="loading" id="loading">
                <div class="spinner"></div>
                <div>Loading your ${documentType.toLowerCase()}...</div>
              </div>
              
              <iframe 
                src="${pdfUrl}${isSignedContract ? '' : '#zoom=100&toolbar=1&navpanes=0&scrollbar=1'}" 
                class="pdf-container" 
                id="pdfFrame"
                onload="hideLoading()"
                onerror="showError()"
                style="display: none;"
                title="${documentType} Document"
              ></iframe>
            </div>
            
            <script>
              function hideLoading() {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('pdfFrame').style.display = 'block';
              }
              
              function showError() {
                const loading = document.getElementById('loading');
                loading.innerHTML = '<div style="text-align: center; color: #ef4444;"><strong>Error loading document</strong><br><br><button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer;">Retry</button></div>';
              }
              
              setTimeout(() => {
                if (document.getElementById('pdfFrame')) {
                  document.getElementById('pdfFrame').style.display = 'block';
                  setTimeout(hideLoading, 1000);
                }
              }, 500);
              
              window.focus();
            </script>
          </body>
          </html>
        `);
        
        newWindow.document.close();
        console.log(`${documentType} viewer opened in new tab for order:`, orderNumber);
        
      } else {
        alert('Please allow popups to view the document, or check your browser settings.');
      }
      
    } catch (error) {
      console.error(`Failed to open ${documentType} viewer:`, error);
      window.open(pdfUrl, '_blank');
    }
  };

  const handleSignContract = (order) => {
    setSelectedOrderForSignature(order);
    setShowSignatureModal(true);
  };

  const handleSignatureComplete = () => {
    console.log('Contract signed successfully');
    // Notify parent component to refetch orders if callback is provided
    if (onOrdersUpdate) {
      onOrdersUpdate();
    }
  };

  const closeSignatureModal = () => {
    setShowSignatureModal(false);
    setSelectedOrderForSignature(null);
  };

  // Toggle order details expansion
  const toggleOrderDetails = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  // Get orders to display based on showAllOrders state
  const ordersToDisplay = showAllOrders ? orders : orders.slice(0, 1);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in-transit':
        return <Truck className="w-5 h-5 text-blue-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'signed':
        return <FileCheck className="w-5 h-5 text-green-500" />;
      default:
        return <Package className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in-transit':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'signed':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getContractStatusBadge = (orderId) => {
    const status = contractStatuses[orderId];
    if (!status) return null;

    if (!status.hasContract) {
      return (
        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs border border-gray-200">
          Contract Pending
        </span>
      );
    }

    if (status.contractSigned) {
      return (
        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs border border-green-200 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Contract Signed
        </span>
      );
    }

    return (
      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs border border-orange-200 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Awaiting Signature
      </span>
    );
  };

  // No orders state
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 border border-teal-200/30 rounded-xl bg-white/20 backdrop-blur-sm">
        <Package className="w-16 h-16 text-teal-400/60 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-teal-800 mb-2">No orders found</h3>
        <p className="text-teal-700/70">You don't have any orders yet. Create your first order below!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

       {/* Filter Controls */}
    {(availableCategories?.length > 0 || availableMaterials?.length > 0) && (
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
        <h4 className="font-medium text-teal-800 mb-3">Filter Orders by Products</h4>
        <div className="flex flex-wrap gap-3">
          {availableCategories.length > 0 && (
            <select 
              value={selectedCategory || ''} 
              onChange={(e) => onCategoryFilter?.(e.target.value)}
              className="px-3 py-2 bg-white/50 border border-teal-200/50 rounded-lg text-sm"
            >
              <option value="">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
          
          {availableMaterials.length > 0 && (
            <select 
              value={selectedMaterial || ''} 
              onChange={(e) => onMaterialFilter?.(e.target.value)}
              className="px-3 py-2 bg-white/50 border border-teal-200/50 rounded-lg text-sm"
            >
              <option value="">All Materials</option>
              {availableMaterials.map(mat => (
                <option key={mat} value={mat}>{mat}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    )}
      {/* Display orders */}
      {ordersToDisplay.map((order) => {
        const contractStatus = contractStatuses[order.id];
        const isExpanded = expandedOrder === order.id;

        return (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/40 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg hover:shadow-xl hover:border-teal-300/50 transition-all duration-200 overflow-hidden"
          >
            {/* Order Header - Always Visible */}
            <div className="p-6 md:p-8">
              <div className="flex flex-col space-y-6">
                
                {/* Header section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/20">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h3 className="text-lg sm:text-xl font-medium text-teal-800 break-all">
                      {order.poNumber || order.id}
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      {getContractStatusBadge(order.id)}
                    </div>
                  </div>
                  
                </div>
                
                {/* Main content area */}
                <div className="flex flex-col xl:flex-row xl:items-start gap-6">
                  {/* Order details grid */}
                  <div className="flex-1 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
                      <div className="border-l-2 border-teal-300/50 pl-4">
                        <p className="text-teal-700/60 mb-1">Order Date</p>
                        <p className="font-medium text-teal-800 break-words">{formatDate(order.orderDate)}</p>
                      </div>
<div className="border-l-2 border-teal-300/50 pl-4">
  <p className="text-teal-700/60 mb-1">Products</p>
  <div className="space-y-2">
    {order.items.map((item, index) => (
      <div
        key={index}
        className="bg-teal-100/50 text-teal-700 px-3 py-2 rounded-lg text-xs border border-teal-200/50 break-words"
      >
        <div className="font-medium mb-1">
          {item.productName || item.barType}
          {item.itemCode && (
            <span className="text-teal-600/70 ml-1">({item.itemCode})</span>
          )}
        </div>
        <div className="text-teal-600/80">
          Qty: {item.quantity?.toLocaleString() || 0}
        </div>
      </div>
    ))}
  </div>
</div>
                      <div className="border-l-2 border-teal-300/50 pl-4">
                        <p className="text-teal-700/60 mb-1">Total Amount</p>
                        <p className="font-medium text-teal-600 break-words">{formatCurrency(order.totalAmount)}</p>
                      </div>
                      <div className="border-l-2 border-teal-300/50 pl-4">
                        <p className="text-teal-700/60 mb-1">Material</p>
                        <p  className="font-medium text-teal-800 break-words">{order.items?.[0]?.material  || 'Pending'}</p>
                      </div>
                    </div>

                    {/* Delivery address */}
                    <div className="border-t border-white/20 pt-4 w-full">
                      <p className="text-teal-700/60 text-sm mb-2">Delivery Address</p>
                      <p className="text-sm flex items-start gap-2 text-teal-800">
                        <MapPin className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                        <span className="break-words">
                          {typeof order.deliveryAddress === 'string' 
                            ? order.deliveryAddress 
                            : order.deliveryAddress?.fullAddress 
                            ? order.deliveryAddress.fullAddress
                            : order.deliveryAddress?.street 
                            ? `${order.deliveryAddress.street}, ${order.deliveryAddress.city} ${order.deliveryAddress.state} ${order.deliveryAddress.postcode}`
                            : 'No address provided'
                          }
                        </span>
                      </p>
                      <div>
                      
                         </div>
                         
                    </div>
                    
                  </div>
                  
                  {/* Action buttons */}
                  <div className="xl:min-w-[220px] border-t xl:border-t-0 xl:border-l border-white/20 pt-6 xl:pt-0 xl:pl-6">
                    <div className="flex flex-col gap-2">
                      {/* Toggle Details Button */}
                      <button
                        onClick={() => toggleOrderDetails(order.id)}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 shadow-lg border border-teal-500/30"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4 flex-shrink-0" />
                            <span>Hide Details</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 flex-shrink-0" />
                            <span>View Details</span>
                          </>
                        )}
                      </button>
                      
                      {order.pdfUrl && (
                        <button
                          onClick={() => handleViewPDF(order.pdfUrl, order.poNumber || order.id, false)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg border border-emerald-500/30"
                          title="View Purchase Order"
                        >
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          <span>View Purchase Order</span>
                        </button>
                      )}

                       {order.proformaInvoiceUrl && (
      <button
        onClick={() => handleViewPDF(order.proformaInvoiceUrl, order.poNumber || order.id, false)}
        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 shadow-lg border border-amber-500/30"
        title="View Proforma Invoice"
      >
        <FileText className="w-4 h-4 flex-shrink-0" />
        <span>View Proforma Invoice</span>
      </button>
    )}


                      {/* Contract Actions */}
                      {contractStatus?.hasContract && !contractStatus?.contractSigned && (
                        <button
                          onClick={() => router.push(`/dashboard/my-orders/${order.id}`)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-lg border border-purple-500/30"
                          title="Sign the sales contract"
                        >
                          <FileSignature className="w-4 h-4 flex-shrink-0" />
                          <span>Sign Contract</span>
                        </button>
                      )}

                      {/* Show Signed Contract if available */}
                      {contractStatus?.contractSigned && contractStatus?.signedContractUrl && (
                        <button
                          onClick={() => handleViewPDF(contractStatus.signedContractUrl, order.poNumber || order.id, true)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg border border-green-500/30"
                          title="View signed contract"
                        >
                          <FileCheck className="w-4 h-4 flex-shrink-0" />
                          <span>View Signed Contract</span>
                        </button>
                      )}

                      {/* Show Original Contract if available and not signed yet */}
                      
                    </div>
                  </div>
                </div>
               

              </div>
              <ViewTracker
                order={order}
                />
            </div>

            {/* Expandable Order Details */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-6 md:px-8 pb-6 border-t border-teal-200/40 bg-gradient-to-b from-white/20 to-white/10">
                    <div className="pt-6 space-y-6">

                  

                        

                      {/* Order Summary Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/30 backdrop-blur-sm rounded-lg p-4 border border-teal-200/40 shadow-sm hover:shadow-md transition-shadow">
                          <p className="text-sm text-teal-700/70 mb-1 font-medium">Order Date</p>
                          <p className="font-semibold text-teal-800">{formatDate(order.orderDate)}</p>
                        </div>
                        
                        {order.estimatedDelivery && (
                          <div className="bg-white/30 backdrop-blur-sm rounded-lg p-4 border border-teal-200/40 shadow-sm hover:shadow-md transition-shadow">
                            <p className="text-sm text-teal-700/70 mb-1 font-medium">Estimated Delivery</p>
                            <p className="font-semibold text-teal-800">{formatDate(order.estimatedDelivery)}</p>
                          </div>
                        )}
                        
                        <div className="bg-white/30 backdrop-blur-sm rounded-lg p-4 border border-teal-200/40 shadow-sm hover:shadow-md transition-shadow">
                          <p className="text-sm text-teal-700/70 mb-1 font-medium">Total Amount</p>
                          <p className="font-bold text-teal-800 text-lg">{formatCurrency(order.totalAmount)}</p>
                        </div>
                      </div>

                      {/* Order Items */}
                      

                      {/* Authorized Users Section */}
                      {order.authorizedEmails && order.authorizedEmails.length > 0 && (
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-5 border border-teal-200/50 shadow-lg">
                          <h4 className="font-semibold text-teal-800 mb-4 flex items-center gap-2 border-b border-teal-200/40 pb-3">
                            <Mail className="w-5 h-5 text-teal-600" />
                            Authorized Users ({order.authorizedEmails.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {order.authorizedEmails.map((email, emailIndex) => (
                              <div key={emailIndex} className="bg-white/40 backdrop-blur-sm rounded-lg p-4 border border-teal-200/50 shadow-sm flex items-center gap-3">
                                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                                  <Mail className="w-4 h-4 text-teal-600" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-teal-800 font-medium break-all">{email}</p>
                                  {email === getUserEmail() && (
                                    <span className="text-xs text-blue-600 font-medium">You</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Customer Information */}
                      {order.customerInfo && (
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-5 border border-teal-200/50 shadow-lg">
                          <h4 className="font-semibold text-teal-800 mb-4 flex items-center gap-2 border-b border-teal-200/40 pb-3">
                            <User className="w-5 h-5 text-teal-600" />
                            Customer Information
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/40 backdrop-blur-sm rounded-lg p-4 border border-teal-200/50 shadow-sm">
<div className="flex items-center gap-2 mb-2">
                               <Building className="w-4 h-4 text-teal-600" />
                               <p className="text-sm text-teal-700/70 font-medium">Company</p>
                             </div>
                             <p className="text-teal-800 font-semibold">{order.customerInfo.companyName || 'N/A'}</p>
                           </div>
                           
                           <div className="bg-white/40 backdrop-blur-sm rounded-lg p-4 border border-teal-200/50 shadow-sm">
                             <div className="flex items-center gap-2 mb-2">
                               <User className="w-4 h-4 text-teal-600" />
                               <p className="text-sm text-teal-700/70 font-medium">Contact Person</p>
                             </div>
                             <p className="text-teal-800 font-semibold">{order.customerInfo.contactPerson || 'N/A'}</p>
                           </div>
                           
                           <div className="bg-white/40 backdrop-blur-sm rounded-lg p-4 border border-teal-200/50 shadow-sm">
                             <div className="flex items-center gap-2 mb-2">
                               <Mail className="w-4 h-4 text-teal-600" />
                               <p className="text-sm text-teal-700/70 font-medium">Email</p>
                             </div>
                             <p className="text-teal-800 font-semibold break-all">{order.customerInfo.email || 'N/A'}</p>
                           </div>
                           
                           <div className="bg-white/40 backdrop-blur-sm rounded-lg p-4 border border-teal-200/50 shadow-sm">
                             <div className="flex items-center gap-2 mb-2">
                               <Phone className="w-4 h-4 text-teal-600" />
                               <p className="text-sm text-teal-700/70 font-medium">Phone</p>
                             </div>
                             <p className="text-teal-800 font-semibold">{order.customerInfo.phone || 'N/A'}</p>
                           </div>
                         </div>
                       </div>
                     )}

                     {/* Delivery Address */}
                     {order.deliveryAddress && (
                       <div className="bg-white/20 backdrop-blur-sm rounded-xl p-5 border border-teal-200/50 shadow-lg">
                         <h4 className="font-semibold text-teal-800 mb-4 flex items-center gap-2 border-b border-teal-200/40 pb-3">
                           <MapPin className="w-5 h-5 text-teal-600" />
                           Delivery Address
                         </h4>
                         <div className="bg-white/40 backdrop-blur-sm rounded-lg p-4 border border-teal-200/50 shadow-sm">
                           <p className="text-teal-800 font-medium leading-relaxed">
                             {typeof order.deliveryAddress === 'string' 
                               ? order.deliveryAddress 
                               : order.deliveryAddress?.fullAddress 
                               ? order.deliveryAddress.fullAddress
                               : order.deliveryAddress?.street 
                               ? `${order.deliveryAddress.street}, ${order.deliveryAddress.city} ${order.deliveryAddress.state} ${order.deliveryAddress.postcode}`
                               : 'No address provided'
                             }
                           </p>
                         </div>
                       </div>
                     )}

                     {/* Additional Information */}
                     {(order.reference || order.notes) && (
                       <div className="bg-white/20 backdrop-blur-sm rounded-xl p-5 border border-teal-200/50 shadow-lg">
                         <h4 className="font-semibold text-teal-800 mb-4 flex items-center gap-2 border-b border-teal-200/40 pb-3">
                           <FileText className="w-5 h-5 text-teal-600" />
                           Additional Information
                         </h4>
                         <div className="space-y-4">
                           {order.reference && (
                             <div className="bg-white/40 backdrop-blur-sm rounded-lg p-4 border border-teal-200/50 shadow-sm">
                               <p className="text-sm text-teal-700/70 font-medium mb-2">Reference</p>
                               <p className="text-teal-800 font-semibold">{order.reference}</p>
                             </div>
                           )}
                           {order.notes && (
                             <div className="bg-white/40 backdrop-blur-sm rounded-lg p-4 border border-teal-200/50 shadow-sm">
                               <p className="text-sm text-teal-700/70 font-medium mb-2">Notes</p>
                               <p className="text-teal-800 font-medium leading-relaxed">{order.notes}</p>
                             </div>
                           )}
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
         </motion.div>
       );
     })}
     
     {/* Show All Orders Button */}
     {orders.length > 1 && (
       <div className="flex justify-center">
         <button
           onClick={() => setShowAllOrders(!showAllOrders)}
           className="px-6 py-3 bg-white/40 backdrop-blur-sm border border-white/30 rounded-xl hover:bg-white/50 hover:border-teal-300/50 transition-all duration-200 flex items-center gap-2 text-teal-800 font-medium shadow-lg"
         >
           {showAllOrders ? (
             <>
               <ChevronUp className="w-5 h-5 flex-shrink-0" />
               <span>Show Less Orders</span>
             </>
           ) : (
             <>
               <ChevronDown className="w-5 h-5 flex-shrink-0" />
               <span>Show All Orders ({orders.length - 1} more)</span>
             </>
           )}
         </button>
       </div>
     )}

     {/* Sales Contract Signature Modal */}
     {showSignatureModal && selectedOrderForSignature && (
       <SalesContractSignature 
         order={selectedOrderForSignature}
         onClose={closeSignatureModal}
         onSignatureComplete={handleSignatureComplete}
       />
     )}
   </div>
 );
};

export default OrderList;