'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, Printer, CheckCircle, AlertCircle, Loader, FileSignature, Shield } from 'lucide-react';
import { storage, db } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

const SalesContractGenerator = ({ order, onClose }) => {
  const [uploadStatus, setUploadStatus] = useState('uploading');
  const [contractUrl, setContractUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Helper function to parse your custom date format or Firestore Timestamps
  const parseCustomDate = (dateValue) => {
    if (!dateValue) return null;
    
    try {
      // If it's a Firestore Timestamp, convert it to Date
      if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
        return dateValue.toDate();
      }
      
      // If it's already a Date object, return it
      if (dateValue instanceof Date) {
        return dateValue;
      }
      
      // If it's a string, try to parse your custom format
      if (typeof dateValue === 'string') {
        // Handle your format: "June 27, 2025 at 10:00:00 AM UTC+10"
        const cleanedDate = dateValue
          .replace(' at ', ' ')
          .replace(' UTC+10', '')
          .replace(' AM', ' AM')
          .replace(' PM', ' PM');
        
        const parsed = new Date(cleanedDate);
        return isNaN(parsed.getTime()) ? null : parsed;
      }
      
      // Last resort: try to create a Date from whatever we got
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? null : parsed;
      
    } catch (error) {
      console.error('Error parsing date:', dateValue, error);
      return null;
    }
  };

  // Auto-upload when component mounts
  useEffect(() => {
    if (order) {
      uploadToFirebase();
    }
  }, [order]);

  // Helper function to format dates
  const formatDate = (date) => {
    if (!date) return 'TBD';
    
    try {
      // Handle any date format
      const dateObj = parseCustomDate(date);
      if (!dateObj) return 'TBD';
      
      return dateObj.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', date, error);
      return 'TBD';
    }
  };

  const formatLongDate = (date) => {
    if (!date) return 'TBD';
    
    try {
      // Handle any date format
      const dateObj = parseCustomDate(date);
      if (!dateObj) return 'TBD';
      
      return dateObj.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', date, error);
      return 'TBD';
    }
  };

  // Generate product description with ACRS certification
  const generateProductDescription = (item) => {
    let description = '';
    
    if (item.productName) {
      description = item.productName;
    } else if (item.barType) {
      description = item.barType;
    } else if (item.itemCode) {
      description = item.itemCode;
    }
    
    // Add dimensions if available
    if (item.dimensions?.diameter && item.dimensions?.length) {
      description += ` ${item.dimensions.diameter}${item.dimensions.unit || 'mm'} x ${item.dimensions.length}${item.dimensions.unit || 'mm'}`;
    } else if (item.length) {
      description += ` x ${item.length}m`;
    }
    
    // Add material/standard if available
    if (item.material) {
      description += ` - ${item.material}`;
    }
    
    // Add ACRS certification if applicable
    if (item.isACRSCertified) {
      description += ' Grade 500N Deformed Reinforcing Bar ACRS Certified';
    }
    
    return description || 'Steel Product';
  };

  // Generate product table rows for all items
  const generateProductTableRows = () => {
    if (!order.items || order.items.length === 0) {
      return `
        <tr>
          <td class="description-cell">Steel Product</td>
          <td>0</td>
          <td>0</td>
          <td>0.00</td>
        </tr>`;
    }

    let rows = '';
    let totalQuantity = 0;
    let totalAmount = 0;

    order.items.forEach((item, index) => {
      const quantity = item.quantity || item.totalWeight || 0;
      const unitPrice = item.unitPrice || item.pricePerTonne || 0;
      const itemTotal = quantity * unitPrice;
      
      totalQuantity += quantity;
      totalAmount += itemTotal;

      const priceUnit = item.pricePerUnit === 'tonne' ? 'tonne' : 
                       item.pricePerUnit === 'each' ? 'each' : 
                       item.pricePerUnit || 'each';

      rows += `
        <tr>
          <td class="description-cell">${generateProductDescription(item)}</td>
          <td>${unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })} per ${priceUnit}</td>
          <td>${quantity}</td>
          <td>${itemTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
        </tr>`;
    });

    // Add total row
    rows += `
      <tr class="total-row">
        <td class="description-cell">Sundry Total</td>
        <td></td>
        <td>${totalQuantity}</td>
        <td>${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
      </tr>`;

    return rows;
  };

  // Generate main product info section
  const generateMainProductInfo = () => {
    if (!order.items || order.items.length === 0) {
      return 'Steel Products';
    }

    if (order.items.length === 1) {
      return generateProductDescription(order.items[0]);
    }

    // Multiple items - show summary
    const totalQuantity = order.items.reduce((sum, item) => sum + (item.quantity || item.totalWeight || 0), 0);
    return `${order.items.length} Steel Products (${totalQuantity} total units)`;
  };

  // Get total quantity across all items
  const getTotalQuantity = () => {
    if (!order.items || order.items.length === 0) return 0;
    return order.items.reduce((sum, item) => sum + (item.quantity || item.totalWeight || 0), 0);
  };

  // Check if any items are ACRS certified
  const hasACRSCertification = () => {
    if (!order.items || order.items.length === 0) return false;
    return order.items.some(item => item.isACRSCertified);
  };

  const generateContractBlob = () => {
    return new Promise((resolve) => {
      const contractHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Sales Contract - ${order.salesContract || `SC${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
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
            border-bottom: 2px solid #000;
        }
        
        .company-section {
            flex: 1;
        }
        
        .company-logo {
            max-width: 180px;
            max-height: 120px;
            width: auto;
            height: auto;
            object-fit: contain;
            margin-bottom: 10px;
            display: block;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #0d9488;
            margin-bottom: 5px;
            display: block;
        }
        
        .company-tagline {
            color: #666;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .contact-info {
            text-align: right;
        }
        
        .contact-info h3 {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .contact-details {
            font-size: 12px;
            line-height: 1.3;
        }
        
        .document-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 14px;
        }
        
        .document-info .left {
            text-align: left;
        }
        
        .document-info .right {
            text-align: right;
        }
        
        .customer-section {
            margin-bottom: 20px;
        }
        
        .section-title {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 14px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 5px;
            margin-bottom: 15px;
            font-size: 13px;
        }
        
        .info-label {
            font-weight: bold;
        }
        
        .supply-notice {
            margin: 20px 0;
            font-size: 14px;
        }
        
        .product-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            border: 2px solid #000;
        }
        
        .product-table th {
            background-color: #4a9b8e;
            color: white;
            padding: 8px;
            text-align: center;
            font-size: 12px;
            font-weight: bold;
            border: 1px solid #000;
        }
        
        .product-table td {
            padding: 8px;
            text-align: center;
            border: 1px solid #000;
            font-size: 12px;
        }
        
        .product-table .description-cell {
            text-align: left;
            font-weight: bold;
        }
        
        .product-table .total-row {
            font-weight: bold;
        }
        
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        
        .summary-table td {
            padding: 5px 8px;
            border: 1px solid #000;
            font-size: 12px;
        }
        
        .summary-table .label-cell {
            text-align: right;
            font-weight: bold;
            background-color: #f5f5f5;
        }
        
        .summary-table .amount-cell {
            text-align: right;
            width: 100px;
        }
        
        .payment-terms {
            margin: 20px 0;
            font-size: 14px;
            font-weight: bold;
            text-align: center;
        }
        
        .bank-details {
            margin: 20px 0;
            font-size: 12px;
        }
        
        .terms-section {
            margin: 20px 0;
            font-size: 11px;
            line-height: 1.5;
        }
        
        .signature-section {
            margin-top: 40px;
            font-size: 12px;
        }
        
        .signature-line {
            border-bottom: 1px dotted #000;
            margin: 30px 0;
            height: 40px;
        }
        
        .company-signature {
            margin-top: 50px;
            font-size: 12px;
        }
        
        .acrs-badge {
            display: inline-block;
            background-color: #3b82f6;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            margin-left: 5px;
        }
        
        @media print {
            body { padding: 10px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-section">
            <img src="https://firebasestorage.googleapis.com/v0/b/insaneambition-66b76.appspot.com/o/PNG%20BACKGROUND%20WHITTE%20TRANSPARENT%201.png?alt=media&token=ef93bcfa-f0b1-40fe-a65c-147d8a100f59" alt="Aussie Steel Direct" class="company-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
        </div>
        
        <div class="contact-info">
            <h3>Aussie Steel Direct Pty Ltd</h3>
            <div class="contact-details">
                95 675 742 720<br>
                sales@aussiesteeldirect.com.au<br>
                +61 4 4952 5928
            </div>
        </div>
    </div>

    <div class="document-info">
        <div class="left">
            <strong>Australian Business Number:</strong> 95 675 742 720<br>
            <strong>Company Address:</strong> U 6008/370 Queen Street, Melbourne VIC 3000 Australia<br>
            <strong>Sales Contract:</strong> ${order.salesContract || `SC${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`}
        </div>
        <div class="right">
            <strong>${order.customerInfo?.companyName || 'Customer Company'} Order Ref No:</strong> ${order.poNumber}
        </div>
    </div>

    <div class="customer-section">
        <div class="section-title">Customer:</div>
        <div class="info-grid">
            <div class="info-label">Customer:</div>
            <div>${order.customerInfo?.companyName || 'Customer Company'}</div>
            
            <div class="info-label">Delivery Date:</div>
            <div>${formatDate(order.estimatedDelivery)}</div>
            
            <div class="info-label">Delivery Address:</div>
            <div>${order.deliveryAddress ? 
              `${order.deliveryAddress.street}, ${order.deliveryAddress.city} ${order.deliveryAddress.state} ${order.deliveryAddress.postcode}` : 
              order.customerInfo?.address ? 
              `${order.customerInfo.address.street}, ${order.customerInfo.address.city} ${order.customerInfo.address.state} ${order.customerInfo.address.postcode}` : 
              'TBA'}</div>
            
            <div class="info-label">Attention to:</div>
            <div>${order.customerInfo?.contactPerson || 'Customer Contact'}</div>
        </div>
    </div>

    <div class="supply-notice">
        We are pleased to advise that we will supply the following material:
    </div>

    <div class="info-grid">
        <div class="info-label">Product Description:</div>
        <div>${generateMainProductInfo()}${hasACRSCertification() ? '<span class="acrs-badge">ACRS CERTIFIED</span>' : ''}</div>
        
        <div class="info-label">Payment Terms:</div>
        <div>${order.contractTerms?.paymentTerms || order.paymentTerms || '30 Days from delivery to yard'}</div>
        
        <div class="info-label">Delivery Terms:</div>
        <div>${order.contractTerms?.deliveryTerms || order.deliveryTerms || 'Delivery Duty paid - unloading by purchaser'}</div>
        
        <div class="info-label">Total Quantity:</div>
        <div>${getTotalQuantity()} ${order.items?.[0]?.pricePerUnit === 'tonne' ? 'tonnes' : 'units'}</div>
        
        <div class="info-label">Quantity Tolerance:</div>
        <div>${order.contractTerms?.quantityTolerance || order.quantityTolerance || '+/- 10%'}</div>
        
        <div class="info-label">Invoicing Basis:</div>
        <div>${order.contractTerms?.invoicingBasis || order.invoicingBasis || 'Theoretical Weight'}</div>
        
        <div class="info-label">Total Amount:</div>
        <div>AUD ${order.totalAmount?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'} GST inclusive</div>
        
        <div class="info-label">Bank details:</div>
        <div>Commonwealth Bank<br>
        Aussie Steel Direct Pty Ltd<br>
        BSB: 063-019<br>
        Account: 1273 6650</div>
        
        <div class="info-label">Packing:</div>
        <div>${order.contractTerms?.packing || order.packing || "Mill's Standard for Export"}</div>
        
        <div class="info-label">Shipment Date:</div>
        <div>${order.estimatedDelivery ? 
          `Delivery by ${formatLongDate(order.estimatedDelivery)}` : 
          order.shipmentDetails || 'TBD'}</div>
        
        <div class="info-label">Documentation:</div>
        <div>${order.contractTerms?.documentation || order.documentation || 'Commercial Invoice<br>Certificate of Origin<br>Mill Test Certificates<br>ACRS Certification'}</div>
    </div>

    <div style="margin: 30px 0; font-size: 14px;">
        <strong>Please return a signed copy of our Sales Contract as your acceptance of the above.</strong>
    </div>

    <div class="signature-section">
        <div style="margin-bottom: 10px;"><strong>Signed for and on behalf of</strong></div>
        <div class="signature-line"></div>
        <div style="margin-top: 10px; border-bottom: 1px dotted #000; padding-bottom: 5px;">
            ${order.customerInfo?.companyName || 'Customer Company'} ABN ${order.customerCompanyData?.abn || order.customerInfo?.abn || '_____________'}<br>
            Date: _______________
        </div>
    </div>

    <!-- Page Break for Product Details -->
    <div style="page-break-before: always; margin-top: 40px;">
        <div class="header">
            <div class="company-section">
                <img src="https://firebasestorage.googleapis.com/v0/b/insaneambition-66b76.appspot.com/o/PNG%20BACKGROUND%20WHITTE%20TRANSPARENT%201.png?alt=media&token=ef93bcfa-f0b1-40fe-a65c-147d8a100f59" alt="Aussie Steel Direct" class="company-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
            </div>
            
            <div class="contact-info">
                <h3>Aussie Steel Direct Pty Ltd</h3>
                <div class="contact-details">
                    95 675 742 720<br>
                    sales@aussiesteeldirect.com.au<br>
                    +61 4 4952 5928
                </div>
            </div>
        </div>

        <div class="document-info">
            <div class="left">
                <strong>Australian Business Number:</strong> 95 675 742 720<br>
                <strong>Company Address:</strong> U 6008/370 Queen Street, Melbourne VIC 3000 Australia<br>
                <strong>Sales Contract:</strong> ${order.salesContract || `SC${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`}
            </div>
            <div class="right">
                <strong>${order.customerInfo?.companyName || 'Customer Company'} Order Ref No:</strong> ${order.poNumber}
            </div>
        </div>

        <h3 style="margin: 20px 0; font-size: 14px; font-weight: bold;">Product Sizes and Quantities:</h3>
        <p style="font-size: 12px; margin-bottom: 15px;">
            ${hasACRSCertification() ? 
              'Deformed Bars in Length are produced to AS/NZS 4671 : 2019 Grade 500N and are ACRS certified.' :
              'Steel products manufactured to Australian Standards.'
            }
        </p>

        <table class="product-table">
            <thead>
                <tr>
                    <th>Description of Goods${hasACRSCertification() ? '<br>AS/NZS 4671 : 2019 Grade 500 N Reinforcing Bar ACRS' : ''}</th>
                    <th>Price<br>(AUD)</th>
                    <th>Qty</th>
                    <th>Amount<br>(AUD)</th>
                </tr>
            </thead>
            <tbody>
                ${generateProductTableRows()}
            </tbody>
        </table>

        <table class="summary-table" style="width: 300px; margin-left: auto;">
            <tr>
                <td class="label-cell">Sales Amount :</td>
                <td class="amount-cell">${order.subtotal?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'}</td>
            </tr>
            <tr>
                <td class="label-cell">GST (10%) :</td>
                <td class="amount-cell">${order.gst?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'}</td>
            </tr>
            <tr>
                <td class="label-cell">Total (incl. GST) :</td>
                <td class="amount-cell">${order.totalAmount?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'}</td>
            </tr>
        </table>

        <div class="payment-terms">
            ${order.contractTerms?.paymentTerms || order.paymentTerms || 'STRICTLY 30 DAYS FROM ARRIVAL TO YARD'}
        </div>

        <div class="payment-terms">
            BALANCE OF PAYMENT MAY BE MADE BY DIRECT DEPOSIT UPON MATURITY
        </div>

        <div class="bank-details">
            <strong>Bank</strong> &nbsp;&nbsp;&nbsp; : &nbsp;&nbsp; Commonwealth Bank &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Acc Name</strong> : &nbsp;&nbsp; Aussie Steel Direct Pty Ltd<br>
            <strong>BSB</strong> &nbsp;&nbsp;&nbsp;&nbsp; : &nbsp;&nbsp; 063-019<br>
            <strong>ACC</strong> &nbsp;&nbsp;&nbsp;&nbsp; : &nbsp;&nbsp; 1273 6650
        </div>

        <div class="terms-section">
            <p><strong>All sales are subject to Aussie Steel Direct's General Terms and Conditions of Sale 2025.</strong></p>
            <br>
            <p><strong>Duties / Taxes :</strong> Any changes in government or export taxes into Aussie Steel Direct's accounts.</p>
            <br>
            <p><strong>Other terms of this Contract shall be as per INCOTERMS 2020.</strong></p>
        </div>

        <div class="signature-section">
            <div style="margin-bottom: 10px;"><strong>Signed for and on behalf of</strong></div>
            <div class="signature-line"></div>
            <div style="margin-top: 10px; border-bottom: 1px dotted #000; padding-bottom: 5px;">
                Aussie Steel Direct Pty Ltd ABN 95 675 742 720<br>
                Date: ${formatDate(new Date())}
            </div>
        </div>
    </div>
</body>
</html>`;

      const blob = new Blob([contractHTML], { type: 'text/html' });
      resolve(blob);
    });
  };

  const generateContract = () => {
    const contractHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Sales Contract - ${order.salesContract || `SC${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
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
            border-bottom: 2px solid #000;
        }
        
        .company-section {
            flex: 1;
        }
        
        .company-logo {
            max-width: 180px;
            max-height: 120px;
            width: auto;
            height: auto;
            object-fit: contain;
            margin-bottom: 10px;
            display: block;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #0d9488;
            margin-bottom: 5px;
            display: block;
        }
        
        .company-tagline {
            color: #666;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .contact-info {
            text-align: right;
        }
        
        .contact-info h3 {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .contact-details {
            font-size: 12px;
            line-height: 1.3;
        }
        
        .document-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 14px;
        }
        
        .document-info .left {
            text-align: left;
        }
        
        .document-info .right {
            text-align: right;
        }
        
        .customer-section {
            margin-bottom: 20px;
        }
        
        .section-title {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 14px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 5px;
            margin-bottom: 15px;
            font-size: 13px;
        }
        
        .info-label {
            font-weight: bold;
        }
        
        .supply-notice {
            margin: 20px 0;
            font-size: 14px;
        }
        
        .product-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            border: 2px solid #000;
        }
        
        .product-table th {
            background-color: #4a9b8e;
            color: white;
            padding: 8px;
            text-align: center;
            font-size: 12px;
            font-weight: bold;
            border: 1px solid #000;
        }
        
        .product-table td {
            padding: 8px;
            text-align: center;
            border: 1px solid #000;
            font-size: 12px;
        }
        
        .product-table .description-cell {
            text-align: left;
            font-weight: bold;
        }
        
        .product-table .total-row {
            font-weight: bold;
        }
        
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        
        .summary-table td {
            padding: 5px 8px;
            border: 1px solid #000;
            font-size: 12px;
        }
        
        .summary-table .label-cell {
            text-align: right;
            font-weight: bold;
            background-color: #f5f5f5;
        }
        
        .summary-table .amount-cell {
            text-align: right;
            width: 100px;
        }
        
        .payment-terms {
            margin: 20px 0;
            font-size: 14px;
            font-weight: bold;
            text-align: center;
        }
        
        .bank-details {
            margin: 20px 0;
           font-size: 12px;
       }
       
       .terms-section {
           margin: 20px 0;
           font-size: 11px;
           line-height: 1.5;
       }
       
       .signature-section {
           margin-top: 40px;
           font-size: 12px;
       }
       
       .signature-line {
           border-bottom: 1px dotted #000;
           margin: 30px 0;
           height: 40px;
       }
       
       .company-signature {
           margin-top: 50px;
           font-size: 12px;
       }
       
       .acrs-badge {
           display: inline-block;
           background-color: #3b82f6;
           color: white;
           padding: 2px 6px;
           border-radius: 4px;
           font-size: 10px;
           font-weight: bold;
           margin-left: 5px;
       }
       
       @media print {
           body { padding: 10px; }
           .no-print { display: none; }
       }
   </style>
</head>
<body>
   <!-- PAGE 1: Contract Details -->
   <div class="header">
       <div class="company-section">
           <img src="https://firebasestorage.googleapis.com/v0/b/insaneambition-66b76.appspot.com/o/PNG%20BACKGROUND%20WHITTE%20TRANSPARENT%201.png?alt=media&token=ef93bcfa-f0b1-40fe-a65c-147d8a100f59" alt="Aussie Steel Direct" class="company-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
       </div>
       <div class="contact-info">
           <h3>Aussie Steel Direct Pty Ltd</h3>
           <div class="contact-details">95 675 742 720<br>sales@aussiesteeldirect.com.au<br>+61 4 4952 5928</div>
       </div>
   </div>
   
   <div class="document-info">
       <div class="left">
           <strong>Australian Business Number:</strong> 95 675 742 720<br>
           <strong>Company Address:</strong> U 6008/370 Queen Street, Melbourne VIC 3000 Australia<br>
           <strong>Sales Contract:</strong> ${order.salesContract || `SC${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`}
       </div>
       <div class="right">
           <strong>${order.customerInfo?.companyName || 'Customer Company'} Order Ref No:</strong> ${order.poNumber}
       </div>
   </div>

   <div class="customer-section">
       <div class="section-title">Customer:</div>
       <div class="info-grid">
           <div class="info-label">Customer:</div>
           <div>${order.customerInfo?.companyName || 'Customer Company'}</div>
           <div class="info-label">Delivery Date:</div>
           <div>${formatDate(order.estimatedDelivery)}</div>
           <div class="info-label">Delivery Address:</div>
           <div>${order.deliveryAddress ? `${order.deliveryAddress.street}, ${order.deliveryAddress.city} ${order.deliveryAddress.state} ${order.deliveryAddress.postcode}` : order.customerInfo?.address ? `${order.customerInfo.address.street}, ${order.customerInfo.address.city} ${order.customerInfo.address.state} ${order.customerInfo.address.postcode}` : 'TBA'}</div>
           <div class="info-label">Attention to:</div>
           <div>${order.customerInfo?.contactPerson || 'Customer Contact'}</div>
       </div>
   </div>

   <div class="supply-notice">We are pleased to advise that we will supply the following material:</div>

   <div class="info-grid">
       <div class="info-label">Product Description:</div>
       <div>${generateMainProductInfo()}${hasACRSCertification() ? '<span class="acrs-badge">ACRS CERTIFIED</span>' : ''}</div>
       <div class="info-label">Payment Terms:</div>
       <div>${order.contractTerms?.paymentTerms || order.paymentTerms || '30 Days from delivery to yard'}</div>
       <div class="info-label">Delivery Terms:</div>
       <div>${order.contractTerms?.deliveryTerms || order.deliveryTerms || 'Delivery Duty paid - unloading by purchaser'}</div>
       <div class="info-label">Total Quantity:</div>
       <div>${getTotalQuantity()} ${order.items?.[0]?.pricePerUnit === 'tonne' ? 'tonnes' : 'units'}</div>
       <div class="info-label">Quantity Tolerance:</div>
       <div>${order.contractTerms?.quantityTolerance || order.quantityTolerance || '+/- 10%'}</div>
       <div class="info-label">Invoicing Basis:</div>
       <div>${order.contractTerms?.invoicingBasis || order.invoicingBasis || 'Theoretical Weight'}</div>
       <div class="info-label">Total Amount:</div>
       <div>AUD ${order.totalAmount?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'} GST inclusive</div>
       <div class="info-label">Bank details:</div>
       <div>Commonwealth Bank<br>Aussie Steel Direct Pty Ltd<br>BSB: 063-019<br>Account: 1273 6650</div>
       <div class="info-label">Packing:</div>
       <div>${order.contractTerms?.packing || order.packing || "Mill's Standard for Export"}</div>
       <div class="info-label">Shipment Date:</div>
       <div>${order.estimatedDelivery ? `Delivery by ${formatLongDate(order.estimatedDelivery)}` : order.shipmentDetails || 'TBD'}</div>
       <div class="info-label">Documentation:</div>
       <div>${order.contractTerms?.documentation || order.documentation || 'Commercial Invoice<br>Certificate of Origin<br>Mill Test Certificates<br>ACRS Certification'}</div>
   </div>

   <div style="margin: 30px 0; font-size: 14px;"><strong>Please return a signed copy of our Sales Contract as your acceptance of the above.</strong></div>

   <div class="signature-section">
       <div style="margin-bottom: 10px;"><strong>Signed for and on behalf of</strong></div>
       <div class="signature-line"></div>
       <div style="margin-top: 10px; border-bottom: 1px dotted #000; padding-bottom: 5px;">
           ${order.customerInfo?.companyName || 'Customer Company'} ABN ${order.customerCompanyData?.abn || order.customerInfo?.abn || '_____________'}<br>
           Date: _______________
       </div>
   </div>

   <!-- PAGE 2: Product Details and Pricing -->
   <div style="page-break-before: always; margin-top: 40px;">
       <div class="header">
           <div class="company-section">
               <img src="https://firebasestorage.googleapis.com/v0/b/insaneambition-66b76.appspot.com/o/PNG%20BACKGROUND%20WHITTE%20TRANSPARENT%201.png?alt=media&token=ef93bcfa-f0b1-40fe-a65c-147d8a100f59" alt="Aussie Steel Direct" class="company-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
           </div>
           
           <div class="contact-info">
               <h3>Aussie Steel Direct Pty Ltd</h3>
               <div class="contact-details">
                   95 675 742 720<br>
                   sales@aussiesteeldirect.com.au<br>
                   +61 4 4952 5928
               </div>
           </div>
       </div>

       <div class="document-info">
           <div class="left">
               <strong>Australian Business Number:</strong> 95 675 742 720<br>
               <strong>Company Address:</strong> U 6008/370 Queen Street, Melbourne VIC 3000 Australia<br>
               <strong>Sales Contract:</strong> ${order.salesContract || `SC${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`}
           </div>
           <div class="right">
               <strong>${order.customerInfo?.companyName || 'Customer Company'} Order Ref No:</strong> ${order.poNumber}
           </div>
       </div>

       <h3 style="margin: 20px 0; font-size: 14px; font-weight: bold;">Product Sizes and Quantities:</h3>
       <p style="font-size: 12px; margin-bottom: 15px;">
           ${hasACRSCertification() ? 
             'Deformed Bars in Length are produced to AS/NZS 4671 : 2019 Grade 500N and are ACRS certified.' :
             'Steel products manufactured to Australian Standards.'
           }
       </p>

       <table class="product-table">
           <thead>
               <tr>
                   <th>Description of Goods${hasACRSCertification() ? '<br>AS/NZS 4671 : 2019 Grade 500 N Reinforcing Bar ACRS' : ''}</th>
                   <th>Price<br>(AUD)</th>
                   <th>Qty</th>
                   <th>Amount<br>(AUD)</th>
               </tr>
           </thead>
           <tbody>
               ${generateProductTableRows()}
           </tbody>
       </table>

       <table class="summary-table" style="width: 300px; margin-left: auto;">
           <tr>
               <td class="label-cell">Sales Amount :</td>
               <td class="amount-cell">${order.subtotal?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'}</td>
           </tr>
           <tr>
               <td class="label-cell">GST (10%) :</td>
               <td class="amount-cell">${order.gst?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'}</td>
           </tr>
           <tr>
               <td class="label-cell">Total (incl. GST) :</td>
               <td class="amount-cell">${order.totalAmount?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'}</td>
           </tr>
       </table>

       <div class="payment-terms">
           ${order.contractTerms?.paymentTerms || order.paymentTerms || 'STRICTLY 30 DAYS FROM ARRIVAL TO YARD'}
       </div>

       <div class="payment-terms">
           BALANCE OF PAYMENT MAY BE MADE BY DIRECT DEPOSIT UPON MATURITY
       </div>

       <div class="bank-details">
           <strong>Bank</strong> &nbsp;&nbsp;&nbsp; : &nbsp;&nbsp; Commonwealth Bank &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Acc Name</strong> : &nbsp;&nbsp; Aussie Steel Direct Pty Ltd<br>
           <strong>BSB</strong> &nbsp;&nbsp;&nbsp;&nbsp; : &nbsp;&nbsp; 063-019<br>
           <strong>ACC</strong> &nbsp;&nbsp;&nbsp;&nbsp; : &nbsp;&nbsp; 1273 6650
       </div>

       <div class="terms-section">
           <p><strong>All sales are subject to Aussie Steel Direct's General Terms and Conditions of Sale 2025.</strong></p>
           <br>
           <p><strong>Duties / Taxes :</strong> Any changes in government or export taxes into Aussie Steel Direct's accounts.</p>
           <br>
           <p><strong>Other terms of this Contract shall be as per INCOTERMS 2020.</strong></p>
       </div>

       <div class="signature-section">
           <div style="margin-bottom: 10px;"><strong>Signed for and on behalf of</strong></div>
           <div class="signature-line"></div>
           <div style="margin-top: 10px; border-bottom: 1px dotted #000; padding-bottom: 5px;">
               Aussie Steel Direct Pty Ltd ABN 95 675 742 720<br>
               Date: ${formatDate(new Date())}
           </div>
       </div>
   </div>
</body>
</html>`;

   const printWindow = window.open('', '_blank');
   printWindow.document.write(contractHTML);
   printWindow.document.close();
   
   printWindow.onload = () => {
     printWindow.print();
   };
 };

 const uploadToFirebase = async () => {
   try {
     console.log('Starting contract upload for order:', order.poNumber);
     setUploadStatus('uploading');
     setUploadProgress(20);

     console.log('Generating contract blob...');
     const htmlBlob = await generateContractBlob();
     console.log('Contract blob generated, size:', htmlBlob.size);
     setUploadProgress(40);

     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
     const filename = `sales-contracts/${order.poNumber}_contract_${timestamp}.html`;
     console.log('Uploading to filename:', filename);
     
     setUploadProgress(60);

     const storageRef = ref(storage, filename);
     console.log('Storage ref created, uploading...');
     const snapshot = await uploadBytes(storageRef, htmlBlob, {
       contentType: 'text/html',
       customMetadata: {
         'poNumber': order.poNumber,
         'customerCompany': order.customerInfo?.companyName || '',
         'contractType': 'sales_contract',
         'uploadDate': new Date().toISOString()
       }
     });
     console.log('Upload completed, getting download URL...');
     
     setUploadProgress(80);

     const downloadURL = await getDownloadURL(snapshot.ref);
     console.log('Download URL obtained:', downloadURL);
     setContractUrl(downloadURL);
     
     setUploadProgress(90);

     // Update the order document with contract URL
     if (order.id) {
       try {
         console.log('Updating order document with contract URL...');
         const orderRef = doc(db, 'orders', order.id);
         await updateDoc(orderRef, {
           contractUrl: downloadURL,
           contractPath: filename,
           contractUploadedAt: new Date(),
           salesContract: order.salesContract,
           updatedAt: new Date()
         });
         console.log('Order document updated successfully');
       } catch (updateError) {
         console.error('Error updating order document:', updateError);
       }
     }

     setUploadProgress(100);
     setUploadStatus('success');
     console.log('Contract upload process completed successfully');
     
   } catch (error) {
     console.error('Error uploading contract:', error);
     setUploadStatus('error');
   }
 };

 const downloadContract = () => {
   if (contractUrl) {
     const link = document.createElement('a');
     link.href = contractUrl;
     link.download = `SalesContract_${order.poNumber}.html`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
   }
 };

 if (!order) return null;

 return (
   <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
     <div className="bg-white/95 backdrop-blur-xl rounded-2xl max-w-md w-full p-6 border border-white/30 shadow-2xl">
       <div className="text-center mb-6">
         <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
           {uploadStatus === 'uploading' ? (
             <Loader className="w-8 h-8 text-white animate-spin" />
           ) : uploadStatus === 'success' ? (
             <CheckCircle className="w-8 h-8 text-white" />
           ) : uploadStatus === 'error' ? (
             <AlertCircle className="w-8 h-8 text-white" />
           ) : (
             <FileSignature className="w-8 h-8 text-white" />
           )}
         </div>
         <h2 className="text-xl font-semibold text-blue-800 mb-2">
           {uploadStatus === 'uploading' ? 'Creating Sales Contract' :
            uploadStatus === 'success' ? 'Sales Contract Ready!' :
            uploadStatus === 'error' ? 'Upload Failed' :
            'Sales Contract Generated!'}
         </h2>
         <p className="text-blue-700/70">
           Contract for PO: <span className="font-medium">{order.poNumber}</span>
         </p>
         
         {uploadStatus === 'uploading' && (
           <div className="mt-4">
             <div className="w-full bg-blue-200/30 rounded-full h-2">
               <div 
                 className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                 style={{ width: `${uploadProgress}%` }}
               ></div>
             </div>
             <p className="text-sm text-blue-600/70 mt-2">{uploadProgress}% complete</p>
           </div>
         )}
         
         {uploadStatus === 'error' && (
           <div className="mt-4 p-3 bg-red-50/50 rounded-lg border border-red-200/50">
             <p className="text-sm text-red-700">❌ Failed to upload contract</p>
             <p className="text-xs text-red-600/70 mt-1">Please try again or contact support</p>
           </div>
         )}
       </div>

       <div className="space-y-4 mb-6">
         <div className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 rounded-lg p-4 border border-blue-200/30">
           <div className="flex justify-between items-center mb-2">
             <span className="text-sm text-blue-700/70">Customer:</span>
             <span className="font-medium text-blue-800">
               {order.customerInfo?.companyName || 'Customer Company'}
             </span>
           </div>
           <div className="flex justify-between items-center mb-2">
             <span className="text-sm text-blue-700/70">Products:</span>
             <span className="font-medium text-blue-800 flex items-center gap-1">
               {order.items?.length || 1} item{(order.items?.length || 1) !== 1 ? 's' : ''}
               {hasACRSCertification() && <Shield className="w-3 h-3 text-blue-600" />}
             </span>
           </div>
           <div className="flex justify-between items-center mb-2">
             <span className="text-sm text-blue-700/70">Total Quantity:</span>
             <span className="font-medium text-blue-800">{getTotalQuantity()} units</span>
           </div>
           <div className="flex justify-between items-center">
             <span className="text-sm text-blue-700/70">Contract Value:</span>
             <span className="font-bold text-blue-600">
               ${order.totalAmount?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'}
             </span>
           </div>
         </div>

         <div className="bg-white/50 rounded-lg p-4 border border-white/30">
           <div className="text-sm text-blue-700/70 mb-2">Sales Contract:</div>
           <div className="text-sm text-blue-800 font-mono">
             {order.salesContract || 'SC25032'}
           </div>
           <div className="text-xs text-blue-600/70 mt-1">
             This contract requires customer signature for acceptance
           </div>
         </div>
       </div>

       <div className="space-y-3">
         {/* Print Contract Button */}
         <button
           onClick={generateContract}
           disabled={uploadStatus === 'uploading'}
           className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
         >
           <Printer className="w-4 h-4" />
           Print Sales Contract
         </button>

         {/* Download Button (only show if upload succeeded) */}
         {uploadStatus === 'success' && contractUrl && (
           <button
             onClick={downloadContract}
             className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all duration-200 flex items-center justify-center gap-2"
           >
             <Download className="w-4 h-4" />
             Download Contract
           </button>
         )}

         {/* Retry Upload (only show if upload failed) */}
         {uploadStatus === 'error' && (
           <button
             onClick={uploadToFirebase}
             className="w-full px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all duration-200 flex items-center justify-center gap-2"
           >
             <AlertCircle className="w-4 h-4" />
             Retry Upload
           </button>
         )}

         {/* Close button */}
         <button
           onClick={onClose}
           className="w-full px-4 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
         >
           Close
         </button>
       </div>

       <div className="mt-4 text-center">
         <p className="text-xs text-blue-700/60">
           {uploadStatus === 'uploading' 
             ? 'Automatically uploading sales contract to cloud storage...'
             : uploadStatus === 'success' 
             ? 'Sales contract safely stored and ready for customer signature'
             : uploadStatus === 'error'
             ? 'Upload failed - you can retry or contact support'
             : 'Sales contract will be automatically uploaded to cloud storage'
           }
         </p>
       </div>
     </div>
   </div>
 );
};

export default SalesContractGenerator;