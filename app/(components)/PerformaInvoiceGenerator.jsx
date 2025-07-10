'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Download, Printer, CheckCircle, AlertCircle, Loader, Edit3, Save, X, Plus, Trash2, Shield } from 'lucide-react';
import { storage, db } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const OrderEditor = () => {
  const params = useParams();
  const orderId = params?.orderId;

  const [originalOrder, setOriginalOrder] = useState(null);
  const [editedOrder, setEditedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(true);

  // Load order data
  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

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

      setOriginalOrder(orderData);
      setEditedOrder(JSON.parse(JSON.stringify(orderData))); // Deep copy for editing

    } catch (error) {
      console.error('Error fetching order:', error);
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const updateCustomerInfo = (field, value) => {
    setEditedOrder(prev => ({
      ...prev,
      customerInfo: {
        ...prev.customerInfo,
        [field]: value
      }
    }));
  };

  const updateCustomerAddress = (field, value) => {
    setEditedOrder(prev => ({
      ...prev,
      customerInfo: {
        ...prev.customerInfo,
        address: {
          ...prev.customerInfo?.address,
          [field]: value
        }
      }
    }));
  };

  const updateDeliveryAddress = (field, value) => {
    setEditedOrder(prev => ({
      ...prev,
      deliveryAddress: {
        ...prev.deliveryAddress,
        [field]: value
      }
    }));
  };

  const updateOrderField = (field, value) => {
    setEditedOrder(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateItem = (index, field, value) => {
    setEditedOrder(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addNewItem = () => {
    const newItem = {
      itemCode: '',
      productName: '',
      barType: '',
      description: '',
      quantity: 0,
      unitPrice: 0,
      totalWeight: 0,
      material: 'AS/NZS 4671:2019',
      category: 'Steel Products',
      currency: 'AUD',
      pricePerUnit: 'each',
      finish: 'Raw/Mill Finish',
      isACRSCertified: false,
      dimensions: {
        diameter: 0,
        length: 0,
        unit: 'mm'
      }
    };
    
    setEditedOrder(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const removeItem = (index) => {
    setEditedOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotals = () => {
    const items = editedOrder?.items || [];
    const subtotal = items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
    
    const gst = subtotal * 0.1;
    const totalAmount = subtotal + gst;
    
    setEditedOrder(prev => ({
      ...prev,
      subtotal,
      gst,
      totalAmount
    }));
  };

  useEffect(() => {
    if (editedOrder?.items) {
      calculateTotals();
    }
  }, [editedOrder?.items]);

  const saveOrder = async () => {
    try {
      setSaving(true);
      const orderRef = doc(db, 'orders', orderId);
      
      await updateDoc(orderRef, {
        ...editedOrder,
        updatedAt: new Date()
      });
      
      setOriginalOrder(editedOrder);
      setSaving(false);
      alert('Order updated successfully!');
    } catch (error) {
      console.error('Error saving order:', error);
      setSaving(false);
      alert('Failed to save order');
    }
  };

  const generateProformaInvoice = async () => {
    try {
      setUploadStatus('uploading');
      setUploadProgress(20);

      const htmlBlob = await generateInvoiceBlob();
      setUploadProgress(40);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const invoiceNumber = editedOrder.proformaInvoice || generateInvoiceNumber();
      const filename = `proforma-invoices/${editedOrder.poNumber}_proforma_${invoiceNumber}_${timestamp}.html`;
      
      setUploadProgress(60);

      const storageRef = ref(storage, filename);
      const snapshot = await uploadBytes(storageRef, htmlBlob, {
        contentType: 'text/html',
        customMetadata: {
          'poNumber': editedOrder.poNumber,
          'customerCompany': editedOrder.customerInfo?.companyName || '',
          'invoiceType': 'proforma_invoice',
          'invoiceNumber': invoiceNumber,
          'uploadDate': new Date().toISOString()
        }
      });
      
      setUploadProgress(80);

      const downloadURL = await getDownloadURL(snapshot.ref);
      setInvoiceUrl(downloadURL);
      
      setUploadProgress(90);

      // Update the order document with proforma invoice URL
      const orderRef = doc(db, 'orders', editedOrder.id);
      await updateDoc(orderRef, {
        proformaInvoiceUrl: downloadURL,
        proformaInvoicePath: filename,
        proformaInvoice: invoiceNumber,
        proformaInvoiceUploadedAt: new Date(),
        updatedAt: new Date()
      });

      setUploadProgress(100);
      setUploadStatus('success');
      setIsEditing(false);
      
    } catch (error) {
      console.error('Error uploading proforma invoice:', error);
      setUploadStatus('error');
      setError('Failed to generate proforma invoice');
    }
  };

  // Generate proforma invoice number
  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `PFI${year}${randomNum}`;
  };

  // Format dates
  const formatDate = (date) => {
    if (!date) return 'TBD';
    
    try {
      if (date instanceof Date) {
        return date.toLocaleDateString('en-AU', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric'
        });
      }
      return 'TBD';
    } catch (error) {
      return 'TBD';
    }
  };

  const generateInvoiceBlob = () => {
    return new Promise((resolve) => {
      const invoiceNumber = editedOrder.proformaInvoice || generateInvoiceNumber();
      const currentDate = new Date();
      const dueDate = editedOrder.estimatedDelivery || new Date(currentDate.getTime() + (30 * 24 * 60 * 60 * 1000));

      // Generate product table rows
      const generateProductTableRows = () => {
        if (!editedOrder.items || editedOrder.items.length === 0) {
          return `
            <tr>
              <td class="item-code">N/A</td>
              <td class="description-cell">Steel Product</td>
              <td class="price-cell">$0.00</td>
              <td class="qty-cell">0</td>
              <td class="amount-cell">$0.00</td>
            </tr>`;
        }

        let rows = '';
        let totalQuantity = 0;
        let totalAmount = 0;

        editedOrder.items.forEach((item, index) => {
          const quantity = item.quantity || item.totalWeight || 0;
          const unitPrice = item.unitPrice || item.pricePerTonne || 0;
          const itemTotal = quantity * unitPrice;
          
          totalQuantity += quantity;
          totalAmount += itemTotal;

          rows += `
            <tr>
              <td class="item-code">${item.itemCode || `ITEM${index + 1}`}</td>
              <td class="description-cell">${item.productName || item.barType || item.description || 'Steel Product'}</td>
              <td class="price-cell">$${unitPrice.toFixed(2)}</td>
              <td class="qty-cell">${quantity.toLocaleString()}</td>
              <td class="amount-cell">$${itemTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
            </tr>`;
        });

        // Add sundry total row
        rows += `
          <tr class="total-row">
            <td class="item-code"></td>
            <td class="description-cell"><strong>Sundry Total</strong></td>
            <td class="price-cell"></td>
            <td class="qty-cell"><strong>${totalQuantity.toLocaleString()}</strong></td>
            <td class="amount-cell"><strong>$${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</strong></td>
          </tr>`;

        return rows;
      };

      const calculateDeposit = () => {
        const total = editedOrder.totalAmount || 0;
        return total * 0.2;
      };

      const getMainProductDescription = () => {
        if (!editedOrder.items || editedOrder.items.length === 0) {
          return 'Steel Products';
        }

        const hasACRS = editedOrder.items.some(item => item.isACRSCertified);
        
        if (hasACRS) {
          return 'AS NZS 4671 G500N Upset Metric Starter Bars Reinforcing Bar ACRS';
        }
        
        return editedOrder.items[0]?.material || 'Steel Products';
      };

      const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Proforma Invoice - ${invoiceNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 1px solid #ddd;
        }
        
        .company-section {
            flex: 1;
        }
        
        .company-logo {
            width: 200px;
            height: auto;
            margin-bottom: 10px;
        }
        
        .contact-info {
            text-align: right;
            font-size: 12px;
            line-height: 1.5;
        }
        
        .contact-info h3 {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .document-header {
            background-color: #f8f9fa;
            padding: 15px;
            margin-bottom: 20px;
            border: 1px solid #ddd;
        }
        
        .document-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            font-size: 12px;
        }
        
        .invoice-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
            font-size: 12px;
        }
        
        .invoice-details .label {
            font-weight: bold;
            margin-bottom: 3px;
        }
        
        .product-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            border: 2px solid #000;
            font-size: 11px;
        }
        
        .product-table th {
            background-color: #4a9b8e !important;
            color: white !important;
            padding: 8px 5px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #000;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        
        .product-table td {
            padding: 6px 5px;
            border: 1px solid #000;
            text-align: center;
        }
        
        .product-table .item-code {
            text-align: center;
            font-weight: bold;
            width: 80px;
        }
        
        .product-table .description-cell {
            text-align: left;
            padding-left: 8px;
        }
        
        .product-table .price-cell {
            text-align: right;
            width: 80px;
        }
        
        .product-table .qty-cell {
            text-align: center;
            width: 60px;
        }
        
        .product-table .amount-cell {
            text-align: right;
            width: 100px;
        }
        
        .product-table .total-row {
            background-color: #f8f9fa !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        
        .summary-section {
            margin: 20px 0;
        }
        
        .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        
        .summary-row.total {
            font-weight: bold;
            font-size: 14px;
            border-top: 2px solid #333;
            border-bottom: 2px solid #333;
            padding: 10px 0;
        }
        
        .summary-row.deposit {
            background-color: #ffe6e6 !important;
            padding: 10px;
            margin-top: 10px;
            font-weight: bold;
            color: #d63384 !important;
            border: 2px solid #d63384 !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        
        .payment-section {
            margin: 25px 0;
            font-size: 12px;
        }
        
        .payment-section h4 {
            font-size: 13px;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .bank-details {
            background-color: #f8f9fa;
            padding: 15px;
            border: 1px solid #ddd;
            margin: 15px 0;
        }
        
        .terms-section {
            margin: 30px 0;
            font-size: 11px;
            padding: 15px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
        }
        
        .signature-section {
            margin-top: 40px;
            page-break-inside: avoid;
        }
        
        .signature-line {
            border-bottom: 1px dotted #333;
            margin: 30px 0 0px 0;
            margin-bottom: 10px;
            height: 10px;
        }

        .signature-name {
            font-family: 'Great Vibes', 'Alex Brush', 'Allura', 'Dancing Script', 'Brush Script MT', cursive;
            color: #000000;
            font-size: 36px;
            font-weight: normal;
            margin: 10px 0 5px 0;
            text-align: left;
            font-style: italic;
            letter-spacing: 2px;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            body { 
                padding: 10px; 
                font-size: 11px;
            }
            
            .no-print { 
                display: none; 
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
         <div class="company-section">
            <img src="https://firebasestorage.googleapis.com/v0/b/insaneambition-66b76.appspot.com/o/PNG%20BACKGROUND%20WHITTE%20TRANSPARENT%201.png?alt=media&token=ef93bcfa-f0b1-40fe-a65c-147d8a100f59" alt="Aussie Steel Direct" class="company-logo" />
        </div>
        
        <div class="contact-info">
            <h3>Aussie Steel Direct Pty Ltd</h3>
            <div>
                <strong>ABN:</strong> 95 675 742 720<br>
                sales@aussiesteeldirect.com.au<br>
                +61 4 4952 5928
            </div>
        </div>
    </div>

    <!-- Document Header -->
    <div class="document-header">
        <div class="document-info">
            <div>
                <strong>Australian Business Number:</strong> 95 675 742 720<br>
                <strong>Company Address:</strong> U 6008/370 Queen Street, Melbourne VIC 3000 Australia<br>
                <strong>Pro Forma Invoice:</strong> ${invoiceNumber}
            </div>
            <div>
                <strong>PSA Order Ref No:</strong> ${editedOrder.poNumber || 'N/A'}
            </div>
        </div>

        <!-- Invoice Details -->
        <div class="invoice-details">
            <div>
                <div class="label">Customer:</div>
                <div>${editedOrder.customerInfo?.companyName || 'Customer Company'}</div>
                
                <div class="label">Customer ABN:</div>
                <div>${editedOrder.customerCompanyData?.abn || editedOrder.customerInfo?.abn || 'N/A'}</div>
                
                <div class="label">Customer PO REF:</div>
                <div>${editedOrder.poNumber || 'N/A'}</div>
                
                <div class="label">Due Date:</div>
                <div>${formatDate(dueDate)}</div>
                
                <div class="label">Invoicing Basis:</div>
                <div>Actual Quantity of Bars</div>
            </div>
            
            <div>
                <div class="label">Delivery Terms:</div>
                <div>Delivered Duty Paid</div>
                
                <div class="label">Payment Terms:</div>
                <div>20% downpayment - balance upon arrival / before delivery</div>
                
                <div class="label">Delivery Address:</div>
                <div>
                  ${editedOrder.deliveryAddress ? 
                    `${editedOrder.deliveryAddress.street}, ${editedOrder.deliveryAddress.city} ${editedOrder.deliveryAddress.state} ${editedOrder.deliveryAddress.postcode}` : 
                    editedOrder.customerInfo?.address ? 
                    `${editedOrder.customerInfo.address.street}, ${editedOrder.customerInfo.address.city} ${editedOrder.customerInfo.address.state} ${editedOrder.customerInfo.address.postcode}` : 
                    'TBA'}
                </div>
                
                <div class="label">Product:</div>
                <div>${getMainProductDescription()}</div>
                
                <div class="label">Country of Origin:</div>
                <div>Malaysia</div>
            </div>
        </div>
    </div>

    <!-- Product Table -->
    <table class="product-table">
        <thead>
            <tr>
                <th>Item</th>
                <th>Description of Goods</th>
                <th>Price<br></th>
                <th>Qty<br>(pieces)</th>
                <th>Amount<br>(AUD)</th>
            </tr>
        </thead>
        <tbody>
            ${generateProductTableRows()}
        </tbody>
    </table>

    <!-- Financial Summary -->
    <div class="summary-section">
        <div class="summary-row">
            <span><strong>Sales Amount :</strong></span>
            <span><strong>$${(editedOrder.subtotal || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</strong></span>
        </div>
        <div class="summary-row">
            <span><strong>GST (10%) :</strong></span>
            <span><strong>$${(editedOrder.gst || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</strong></span>
        </div>
        <div class="summary-row total">
            <span>Total Contract (incl. GST) :</span>
            <span>$${(editedOrder.totalAmount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="summary-row deposit">
            <span>Pro Forma Invoice 20%</span>
            <span>$${calculateDeposit().toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
        </div>
    </div>

    <!-- Payment Information -->
    <div class="payment-section">
        <h4>PAYMENT: 20% DEPOSIT, AND BALANCE TO BE PAID ON CARGO ARRIVAL / PRIOR DELIVERY</h4>
        <p><strong>BALANCE OF PAYMENT MAY BE MADE BY DIRECT DEPOSIT UPON MATURITY</strong></p>
        
        <div class="bank-details">
            <strong>Bank :</strong> Commonwealth Bank &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Acc Name :</strong> Aussie Steel Direct Pty Ltd<br>
            <strong>BSB :</strong> 063-019<br>
            <strong>ACC :</strong> 1273 6650
        </div>
    </div>

    <!-- Page Break for Terms -->
    <div style="page-break-before: always;">
        <div class="header">
            <div class="company-section">
                <img src="https://firebasestorage.googleapis.com/v0/b/insaneambition-66b76.appspot.com/o/PNG%20BACKGROUND%20WHITTE%20TRANSPARENT%201.png?alt=media&token=ef93bcfa-f0b1-40fe-a65c-147d8a100f59" alt="Aussie Steel Direct" class="company-logo" />
            </div>
            
            <div class="contact-info">
                <h3>Aussie Steel Direct Pty Ltd</h3>
                <div>
                    95 675 742 720<br>
                    sales@aussiesteeldirect.com.au<br>
                    +61 4 4952 5928
                </div>
            </div>
        </div>

        <div class="document-info">
            <div>
                <strong>Australian Business Number:</strong> 95 675 742 720<br>
                <strong>Company Address:</strong> U 6008/370 Queen Street, Melbourne VIC 3000 Australia<br>
                <strong>Pro Forma Invoice:</strong> ${invoiceNumber}
            </div>
            <div>
                <strong>PSA Order Ref No:</strong> ${editedOrder.poNumber || 'N/A'}
            </div>
        </div>

        <!-- Terms and Conditions -->
        <div class="terms-section">
            <p><strong>All sales are subject to Aussie Steel Direct's General Terms and Conditions of Sale 2025.</strong></p>
            <br>
            <p><strong>Duties / Taxes :</strong> Any changes in government or export taxes into Aussie Steel Direct's accounts.</p>
            <br>
            <p><strong>Other terms of this Contract shall be as per INCOTERMS 2020</strong></p>
        </div>

        <!-- Signature Section -->
        <div class="signature-section">
            <p><strong>Signed for and on behalf of</strong></p>
            <div class="signature-name">Wilson Wong</div>
            <div class="signature-line"></div>
            <p><strong>Aussie Steel Direct Pty Ltd</strong></p>
            <p><strong>Director</strong></p>
            <br>
            <p><strong>Date:</strong> ${formatDate(currentDate)}</p>
        </div>
    </div>
</body>
</html>`;

      const blob = new Blob([invoiceHTML], { type: 'text/html' });
      resolve(blob);
    });
  };

  const printInvoice = async () => {
    try {
      const htmlBlob = await generateInvoiceBlob();
      const htmlText = await htmlBlob.text();
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlText);
      printWindow.document.close();
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      };

      setTimeout(() => {
        if (printWindow.document.readyState === 'complete') {
          printWindow.print();
        }
      }, 2000);

    } catch (error) {
      console.error('Error printing invoice:', error);
    }
  };

  const downloadInvoice = () => {
    if (invoiceUrl) {
      const link = document.createElement('a');
      link.href = invoiceUrl;
      link.download = `ProformaInvoice_${editedOrder.poNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

  if (error && !editedOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (!editedOrder) return null;

  if (!isEditing) {
    // Show invoice generation success
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl max-w-md w-full p-6 border border-white/30 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-blue-800 mb-2">Proforma Invoice Generated!</h2>
            <p className="text-blue-700/70">
              Invoice for PO: <span className="font-medium">{editedOrder.poNumber}</span>
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={printInvoice}
              className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Proforma Invoice
            </button>

            {invoiceUrl && (
              <button
                onClick={downloadInvoice}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Invoice
              </button>
            )}

            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 border border-green-200 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-2xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-blue-600" />
                Edit Order Details
              </h1>
              <p className="text-gray-600">Review and modify order before generating proforma invoice</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={saveOrder}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
              <button
                onClick={generateProformaInvoice}
                disabled={uploadStatus === 'uploading'}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                Generate Invoice
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">PO Number</p>
              <p className="font-medium">{editedOrder.poNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-medium">{editedOrder.customerInfo?.companyName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="font-medium text-green-600">${(editedOrder.totalAmount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Information */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={editedOrder.customerInfo?.companyName || ''}
                  onChange={(e) => updateCustomerInfo('companyName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ABN</label>
                <input
                  type="text"
                  value={editedOrder.customerInfo?.abn || ''}
                  onChange={(e) => updateCustomerInfo('abn', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={editedOrder.customerInfo?.contactPerson || ''}
                  onChange={(e) => updateCustomerInfo('contactPerson', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editedOrder.customerInfo?.email || ''}
                  onChange={(e) => updateCustomerInfo('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editedOrder.customerInfo?.phone || ''}
                  onChange={(e) => updateCustomerInfo('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
                  <input
                    type="text"
                    value={editedOrder.customerInfo?.address?.street || ''}
                    onChange={(e) => updateCustomerAddress('street', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editedOrder.customerInfo?.address?.city || ''}
                    onChange={(e) => updateCustomerAddress('city', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={editedOrder.customerInfo?.address?.state || ''}
                    onChange={(e) => updateCustomerAddress('state', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                  <input
                    type="text"
                    value={editedOrder.customerInfo?.address?.postcode || ''}
                    onChange={(e) => updateCustomerAddress('postcode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
                <input
                  type="text"
                  value={editedOrder.poNumber || ''}
                  onChange={(e) => updateOrderField('poNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales Contract</label>
                <input
                  type="text"
                  value={editedOrder.salesContract || ''}
                  onChange={(e) => updateOrderField('salesContract', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={editedOrder.paymentTerms || ''}
                  onChange={(e) => updateOrderField('paymentTerms', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Terms</label>
                <input
                  type="text"
                  value={editedOrder.deliveryTerms || ''}
                  onChange={(e) => updateOrderField('deliveryTerms', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Delivery Date</label>
                <input
                  type="date"
                  value={editedOrder.estimatedDelivery ? editedOrder.estimatedDelivery.toISOString().split('T')[0] : ''}
                  onChange={(e) => updateOrderField('estimatedDelivery', new Date(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Tolerance</label>
                <input
                  type="text"
                  value={editedOrder.quantityTolerance || ''}
                  onChange={(e) => updateOrderField('quantityTolerance', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoicing Basis</label>
                <select
                  value={editedOrder.invoicingBasis || ''}
                  onChange={(e) => updateOrderField('invoicingBasis', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select basis</option>
                  <option value="Theoretical Weight">Theoretical Weight</option>
                  <option value="Actual Weight">Actual Weight</option>
                  <option value="Actual Quantity of Bars">Actual Quantity of Bars</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-xl mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
              <input
                type="text"
                value={editedOrder.deliveryAddress?.street || ''}
                onChange={(e) => updateDeliveryAddress('street', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={editedOrder.deliveryAddress?.city || ''}
                onChange={(e) => updateDeliveryAddress('city', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={editedOrder.deliveryAddress?.state || ''}
                onChange={(e) => updateDeliveryAddress('state', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
              <input
                type="text"
                value={editedOrder.deliveryAddress?.postcode || ''}
                onChange={(e) => updateDeliveryAddress('postcode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-xl mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
            <button
              onClick={addNewItem}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {editedOrder.items?.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">Item {index + 1}</h3>
                  <div className="flex items-center gap-2">
                    {item.isACRSCertified && <Shield className="w-4 h-4 text-blue-600" />}
                    <button
                      onClick={() => removeItem(index)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
                    <input
                      type="text"
                      value={item.itemCode || ''}
                      onChange={(e) => updateItem(index, 'itemCode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                    <input
                      type="text"
                      value={item.productName || ''}
                      onChange={(e) => updateItem(index, 'productName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Material</label>
                    <input
                      type="text"
                      value={item.material || ''}
                      onChange={(e) => updateItem(index, 'material', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total ($)</label>
                    <input
                      type="text"
                      value={`${((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                    />
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={item.isACRSCertified || false}
                        onChange={(e) => updateItem(index, 'isACRSCertified', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">ACRS Certified</span>
                    </label>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={item.description || ''}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">Subtotal:</span>
              <span className="font-medium">${(editedOrder.subtotal || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">GST (10%):</span>
              <span className="font-medium">${(editedOrder.gst || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-blue-700 border-t pt-2">
              <span>Total Amount:</span>
              <span>${(editedOrder.totalAmount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center mt-2 text-green-700 font-medium">
              <span>20% Deposit:</span>
              <span>${((editedOrder.totalAmount || 0) * 0.2).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Generate Invoice Status */}
        {uploadStatus === 'uploading' && (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-xl mt-6">
            <div className="text-center">
              <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-700">Generating proforma invoice...</p>
              <div className="w-full bg-blue-200 rounded-full h-2 mt-4">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-blue-600 mt-2">{uploadProgress}% complete</p>
            </div>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-xl mt-6">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
              <p className="text-red-700">Failed to generate proforma invoice</p>
              <button
                onClick={generateProformaInvoice}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderEditor;