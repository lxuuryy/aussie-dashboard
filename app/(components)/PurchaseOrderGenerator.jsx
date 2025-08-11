'use client';

import { storage, db } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';

class PDFGenerator {
  constructor() {
    this.customerCompanyData = null;
    this.orderData = null;
  }

  // Helper functions to safely access data (same as in PDFInvoiceModal)
  getProductInfo(orderData) {
    if (!orderData) return {};
    
    // Handle both selectedProduct and product structures
    const product = orderData.selectedProduct || orderData.product || orderData.items?.[0] || orderData;
    
    return {
      name: product.productName || product.barType || product.itemCode || 'Product',
      itemCode: product.itemCode || '',
      category: product.category || '',
      material: product.material || '',
      dimensions: product.dimensions.unit || product.length || 'Standard',
      description: product.description || '',
    };
  }

  getQuantityInfo(orderData) {
  if (!orderData) return { quantity: 0, unit: 'units' };
  
  // Get the product to determine the correct unit
  const product = orderData.selectedProduct || orderData.product || orderData.items?.[0] || orderData;
  
  return {
    quantity: orderData.quantity || orderData.orderFormData?.quantity || product.quantity || 0,
    unit: product.pricePerUnit || product.unit || orderData.unit || 'units' // Use pricePerUnit from product data
  };
}

  getPricingInfo(orderData) {
    if (!orderData) return { unitPrice: 0, currency: 'AUD' };
    
    const product = orderData.selectedProduct || orderData.product || orderData.items?.[0] || orderData;
    
    return {
      unitPrice: product.pricePerTonne || product.unitPrice || product.pricing?.unitPrice || 0,
      currency: product.currency || product.pricing?.currency || 'AUD',
      pricePerUnit: product.pricePerUnit || product.pricing?.pricePerUnit || 'per tonne'
    };
  }

  getTotalsInfo(orderData) {
    if (!orderData) return { subtotal: 0, gst: 0, total: 0 };
    
    // Try different possible total locations
    const totals = orderData.totals || orderData.calculateTotals || {};
    const subtotal = totals.subtotal || orderData.subtotal || 0;
    const gst = totals.gst || orderData.gst || 0;
    const total = totals.total || orderData.totalAmount || 0;
    
    return { subtotal, gst, total };
  }

  getCustomerInfo(orderData) {
    if (!orderData) return {};
    
    // Handle different customer info structures
    const customerInfo = orderData.customerInfo || 
                        orderData.orderFormData?.customerInfo || 
                        {};
    
    return {
      companyName: customerInfo.companyName || '',
      contactPerson: customerInfo.contactPerson || '',
      email: customerInfo.email || '',
      phone: customerInfo.phone || '',
      abn: customerInfo.abn || ''
    };
  }

  getDeliveryAddress(orderData) {
    if (!orderData) return {};
    
    // Handle different address structures
    const customerInfo = orderData.customerInfo || 
                        orderData.orderFormData?.customerInfo || 
                        {};
    
    const address = customerInfo.address || 
                   orderData.deliveryAddress || 
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
      country: address.country || 'Australia'
    };
  }

  getOrderDetails(orderData) {
    if (!orderData) return {};
    
    return {
      poNumber: orderData.poNumber || 
               orderData.id || 
               `PO-${Date.now()}`,
      orderDate: orderData.orderDate || 
                orderData.orderFormData?.orderDate || 
                new Date().toISOString().split('T')[0],
      reference: orderData.reference || 
                orderData.orderFormData?.reference || '',
      notes: orderData.notes || 
             orderData.orderFormData?.notes || ''
    };
  }

  getAuthorizedEmails(orderData) {
    return orderData.authorizedEmails || 
           orderData.orderFormData?.authorizedEmails || 
           [];
  }

  async fetchCustomerCompanyData(purchaseOrder) {
    try {
      const customerInfo = this.getCustomerInfo(purchaseOrder);
      
      if (!customerInfo.email) {
        return {};
      }

      const companiesQuery = query(
        collection(db, 'companies'),
        where('userEmail', '==', customerInfo.email)
      );
      
      const companiesSnapshot = await getDocs(companiesQuery);
      
      if (!companiesSnapshot.empty) {
        const companyDoc = companiesSnapshot.docs[0];
        const companyData = { id: companyDoc.id, ...companyDoc.data() };
        this.customerCompanyData = companyData;
        return companyData;
      } else {
        this.customerCompanyData = {};
        return {};
      }
    } catch (error) {
      console.error('Error fetching customer company data:', error);
      this.customerCompanyData = {};
      return {};
    }
  }

   formatOrderDate(dateInput) {
    try {
      let date;
      
      // Handle different date formats
      if (!dateInput) {
        date = new Date();
      } else if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        // Handle Firebase Timestamp strings like "July 8, 2025 at 10:00:00 AM UTC+10"
        if (dateInput.includes(' at ')) {
          // Extract just the date part before " at "
          const datePart = dateInput.split(' at ')[0];
          date = new Date(datePart);
        } else {
          // Try parsing as-is
          date = new Date(dateInput);
        }
      } else if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        // Handle Firebase Timestamp objects
        date = dateInput.toDate();
      } else {
        date = new Date(dateInput);
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        // Fallback to current date if parsing fails
        date = new Date();
      }

      return date.toLocaleDateString('en-AU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting order date:', error, 'Input:', dateInput);
      // Return current date as fallback
      return new Date().toLocaleDateString('en-AU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    }
  }

   formatOrderDate(dateInput) {
    try {
      let date;
      
      // Handle different date formats
      if (!dateInput) {
        date = new Date();
      } else if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        // Handle Firebase Timestamp strings like "July 8, 2025 at 10:00:00 AM UTC+10"
        if (dateInput.includes(' at ')) {
          // Extract just the date part before " at "
          const datePart = dateInput.split(' at ')[0];
          date = new Date(datePart);
        } else {
          // Try parsing as-is
          date = new Date(dateInput);
        }
      } else if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        // Handle Firebase Timestamp objects
        date = dateInput.toDate();
      } else {
        date = new Date(dateInput);
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        // Fallback to current date if parsing fails
        date = new Date();
      }

      return date.toLocaleDateString('en-AU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting order date:', error, 'Input:', dateInput);
      // Return current date as fallback
      return new Date().toLocaleDateString('en-AU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    }
  }

  // Fetch order data from Firestore to get authorized emails
  async fetchOrderData(purchaseOrder) {
    try {
      if (!purchaseOrder?.orderId && !purchaseOrder?.id) {
        console.log('No orderId provided, using purchaseOrder data directly');
        this.orderData = purchaseOrder;
        return purchaseOrder;
      }

      const orderId = purchaseOrder.orderId || purchaseOrder.id;
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (orderSnap.exists()) {
        const orderData = { id: orderSnap.id, ...orderSnap.data() };
        this.orderData = orderData;
        
        // Merge the order data with purchaseOrder data
        const mergedData = {
          ...purchaseOrder,
          ...orderData,
          // Ensure we keep the authorized emails from the database
          authorizedEmails: orderData.authorizedEmails || purchaseOrder.authorizedEmails || []
        };
        
        return mergedData;
      } else {
        console.log('Order document not found, using purchaseOrder data');
        this.orderData = purchaseOrder;
        return purchaseOrder;
      }
    } catch (error) {
      console.error('Error fetching order data:', error);
      this.orderData = purchaseOrder;
      return purchaseOrder;
    }
  }

  // Helper function to format authorized emails for display
  formatAuthorizedEmails(authorizedEmails) {
    if (!authorizedEmails || authorizedEmails.length === 0) {
      return '';
    }

    return authorizedEmails.join(', ');
  }

  // Helper function to format authorized emails with enhanced display for the recipients section
  formatAuthorizedEmailsWithDisplay(authorizedEmails) {
    if (!authorizedEmails || authorizedEmails.length === 0) {
      return '';
    }

    return authorizedEmails.map((email, index) => {
      // Extract name from email if available, otherwise use email prefix
      const emailPrefix = email.split('@')[0];
      const displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      
      return `<div class="recipient-item">
        <div class="recipient-name">${displayName}</div>
        <div class="recipient-email">${email}</div>
      </div>`;
    }).join('');
  }

  formatCurrency(amount) {
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    return numAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 });
  }

  async generateHTMLContent(purchaseOrder, customerCompanyData) {
    // Fetch the latest order data to get authorized emails
    const orderData = await this.fetchOrderData(purchaseOrder);
    
    // Use helper functions to get data safely
    const productInfo = this.getProductInfo(orderData);
    const quantityInfo = this.getQuantityInfo(orderData);
    const pricingInfo = this.getPricingInfo(orderData);
    const totalsInfo = this.getTotalsInfo(orderData);
    const customerInfo = this.getCustomerInfo(orderData);
    const deliveryAddress = this.getDeliveryAddress(orderData);
    const orderDetails = this.getOrderDetails(orderData);
    const authorizedEmails = this.getAuthorizedEmails(orderData);
    
    const authorizedEmailsString = this.formatAuthorizedEmails(authorizedEmails);
    const authorizedEmailsWithDisplay = this.formatAuthorizedEmailsWithDisplay(authorizedEmails);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Purchase Order - ${orderDetails.poNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: white;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #0d9488;
        }
        
        .company-info {
            flex: 1;
        }
        
        .customer-info {
            flex: 1;
            text-align: right;
            border-left: 2px solid #e2e8f0;
            padding-left: 30px;
        }
        
        .company-name, .customer-name {
            margin-bottom: 10px;
        }

        .company-logo {
            max-width: 380px;
            max-height: 220px;
            width: auto;
            height: auto;
            object-fit: contain;
            margin-bottom: 10px;
        }
        
        .customer-logo {
            max-width: 180px;
            max-height: 60px;
            width: auto;
            height: auto;
            object-fit: contain;
            margin-bottom: 10px;
            margin-left: auto;
            display: block;
        }
        
        .company-name-text, .customer-name-text {
            font-size: 24px;
            font-weight: bold;
            color: #0d9488;
            margin-bottom: 5px;
            display: block;
        }
        
        .company-tagline, .customer-tagline {
            color: #666;
            font-size: 14px;
            margin-bottom: 15px;
        }
        
        .company-details, .customer-details {
            font-size: 12px;
            color: #666;
        }
        
        .customer-details {
            text-align: right;
        }
        
        .title-section {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .title {
            font-size: 32px;
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 10px;
        }
        
        .subtitle {
            color: #64748b;
            font-size: 16px;
        }
        
        .order-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 40px;
        }
        
        .details-section h3 {
            color: #0d9488;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 15px;
            padding-bottom: 5px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
            align-items: flex-start;
        }
        
        .detail-label {
            color: #64748b;
            font-weight: 500;
            min-width: 120px;
            flex-shrink: 0;
        }
        
        .detail-value {
            color: #0f172a;
            font-weight: 600;
            text-align: right;
            flex: 1;
            word-break: break-all;
            max-width: 200px;
        }
        
        .recipients-section {
            margin-top: 30px;
            padding: 20px;
            background: #f0fdfa;
            border-radius: 8px;
            border-left: 4px solid #0d9488;
        }
        
        .recipients-section h3 {
            color: #0d9488;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
        }
        
        .recipient-item {
            margin-bottom: 8px;
            padding: 8px 12px;
            background: white;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
        }
        
        .recipient-name {
            font-weight: 600;
            color: #0d9488;
            margin-bottom: 2px;
        }
        
        .recipient-email {
            color: #64748b;
            font-size: 13px;
        }
        
        .emails-summary {
            margin-top: 10px;
            padding: 8px 12px;
            background: #e6fffa;
            border-radius: 4px;
            border: 1px dashed #0d9488;
        }
        
        .emails-summary-label {
            font-size: 12px;
            color: #0d9488;
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        .emails-summary-value {
            font-size: 11px;
            color: #374151;
            word-break: break-all;
            line-height: 1.3;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .items-table th {
            background: #f8fafc;
            color: #374151;
            font-weight: 600;
            padding: 15px 12px;
            text-align: left;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .items-table th:last-child,
        .items-table td:last-child {
            text-align: right;
        }
        
        .items-table td {
            padding: 15px 12px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 14px;
        }
        
        .items-table tr:last-child td {
            border-bottom: none;
        }
        
        .item-description {
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 4px;
        }
        
        .item-specs {
            font-size: 12px;
            color: #64748b;
        }
        
        .totals-section {
            margin-left: auto;
            width: 300px;
        }
        
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            font-size: 14px;
        }
        
        .total-row.subtotal {
            border-bottom: 1px solid #e2e8f0;
        }
        
        .total-row.gst {
            color: #64748b;
        }
        
        .total-row.final {
            border-top: 2px solid #0d9488;
            padding-top: 15px;
            margin-top: 10px;
            font-size: 18px;
            font-weight: bold;
            color: #0d9488;
        }
        
        .delivery-section {
            margin-top: 40px;
            padding: 25px;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #0d9488;
        }
        
        .delivery-section h3 {
            color: #0d9488;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
        }
        
        .delivery-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        
        .address-block {
            font-size: 14px;
            line-height: 1.5;
        }
        
        .address-label {
            font-weight: 600;
            color: #374151;
            margin-bottom: 5px;
        }
        
        .notes-section {
            margin-top: 30px;
            padding: 20px;
            background: #fffbeb;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
        }
        
        .notes-section h3 {
            color: #d97706;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 12px;
            color: #64748b;
        }
        
        .footer strong {
            color: #0d9488;
        }
        
        @media print {
            body { padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <div class="company-tagline">Premium Steel Solutions Australia Wide</div>
            <div class="company-details">
                ABN: 12 345 678 901<br>
                Phone: 1300 STEEL (1300 783 354)<br>
                Email: orders@aussiesteeldirect.com.au<br>
                Web: www.aussiesteeldirect.com.au
            </div>
        </div>

        <div class="customer-info">
            <div class="customer-name">
                ${customerCompanyData && customerCompanyData.logoUrl ? `
                <img src="${customerCompanyData.logoUrl}" alt="${customerCompanyData.companyName || 'Customer'} Logo" class="customer-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                ` : ''}
                <div class="customer-name-text" ${customerCompanyData && customerCompanyData.logoUrl ? 'style="display: none;"' : ''}>
                    ${customerCompanyData?.companyName || customerInfo.companyName || 'Customer Company'}
                </div>
            </div>
            <div class="customer-tagline">Purchase Order Recipient</div>
            <div class="customer-details">
                ${customerCompanyData?.abn || customerInfo.abn ? `ABN: ${customerCompanyData?.abn || customerInfo.abn}<br>` : ''}
                ${customerInfo.phone ? `Phone: ${customerInfo.phone}<br>` : ''}
                ${authorizedEmailsString ? `Email: ${authorizedEmailsString}<br>` : `Email: ${customerInfo.email}<br>`}
                ${customerCompanyData?.address?.city && customerCompanyData?.address?.state ? 
                  `${customerCompanyData.address.city}, ${customerCompanyData.address.state}` : 
                  `${deliveryAddress.city || ''}, ${deliveryAddress.state || ''}`
                }
            </div>
        </div>
    </div>

    <div class="title-section">
        <div class="title">PURCHASE ORDER</div>
        <div class="subtitle">Professional Steel Supply & Delivery</div>
    </div>

    <div class="order-details">
        <div class="details-section">
            <h3>Order Information</h3>
            <div class="detail-row">
                <span class="detail-label">Purchase Order Number</span>
                <span class="detail-value">${orderDetails.poNumber}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Purchase Order Date</span>
                <span class="detail-value">${this.formatOrderDate(orderDetails.orderDate)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Delivery Date</span>
                <span class="detail-value">TBD</span>
            </div>
            ${orderDetails.reference ? `
            <div class="detail-row">
                <span class="detail-label">Reference</span>
                <span class="detail-value">${orderDetails.reference}</span>
            </div>
            ` : ''}
            
        </div>

        <div class="details-section">
            <h3>Customer Details</h3>
            <div class="detail-row">
                <span class="detail-label">Company</span>
                <span class="detail-value">${customerCompanyData?.companyName || customerInfo.companyName}</span>
            </div>
            ${(customerCompanyData?.abn || customerInfo.abn) ? `
            <div class="detail-row">
                <span class="detail-label">ABN</span>
                <span class="detail-value">${customerCompanyData?.abn || customerInfo.abn}</span>
            </div>
            ` : ''}
            <div class="detail-row">
                <span class="detail-label">Contact Person</span>
                <span class="detail-value">${customerCompanyData?.contactPerson || customerInfo.contactPerson}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Contact Email(s)</span>
                <span class="detail-value">${authorizedEmailsString || customerInfo.email}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Phone</span>
                <span class="detail-value">${customerCompanyData?.phone || customerInfo.phone}</span>
            </div>
        </div>
    </div>

    

    <table class="items-table">
        <thead>
            <tr>
                <th>Item Code</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>GST</th>
                <th>Amount ${pricingInfo.currency}</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>
                    <div class="item-description">${productInfo.itemCode || 'N/A'}</div>
                </td>
                <td>
                    <div class="item-description">${productInfo.name}</div>
                    <div class="item-specs">
                        ${productInfo.category ? `Category: ${productInfo.category}<br>` : ''}
                        ${productInfo.material ? `Material: ${productInfo.material}<br>` : ''}
                        ${productInfo.dimensions ? `Dimensions: ${productInfo.dimensions}` : ''}
                    </div>
                </td>
                <td>${quantityInfo.quantity} ${quantityInfo.unit}</td>
                <td>$${this.formatCurrency(pricingInfo.unitPrice)}</td>
                <td>10%</td>
                <td>$${this.formatCurrency(totalsInfo.total)}</td>
            </tr>
        </tbody>
    </table>

    <div class="totals-section">
        <div class="total-row subtotal">
            <span>Subtotal</span>
            <span>$${this.formatCurrency(totalsInfo.subtotal)}</span>
        </div>
        <div class="total-row gst">
            <span>TOTAL GST 10%</span>
            <span>$${this.formatCurrency(totalsInfo.gst)}</span>
        </div>
        <div class="total-row final">
            <span>TOTAL ${pricingInfo.currency}</span>
            <span>$${this.formatCurrency(totalsInfo.total)}</span>
        </div>
    </div>

    <div class="delivery-section">
        <h3>DELIVERY DETAILS</h3>
        <div class="delivery-details">
            <div>
                <div class="address-label">Delivery Address</div>
                <div class="address-block">
                    ${deliveryAddress.street || ''}<br>
                    ${deliveryAddress.city || ''}<br>
                    ${deliveryAddress.state || ''}<br>
                    ${deliveryAddress.postcode || ''}<br>
                    ${deliveryAddress.country || 'Australia'}
                </div>
            </div>
            <div>
                <div class="address-label">Contact</div>
                <div class="address-block">
                    Wilson<br>
                    <strong>Telephone</strong><br>
                    +61 449 525 928
                </div>
            </div>
        </div>
    </div>

    ${orderDetails.notes ? `
    <div class="notes-section">
        <h3>Additional Notes & Delivery Instructions</h3>
        <p>${orderDetails.notes}</p>
    </div>
    ` : ''}

    <div class="footer">
        <strong>Aussie Steel Direct</strong> - Your trusted partner for premium steel solutions<br>
        This purchase order is valid for 30 days from the date of issue. Terms and conditions apply.
    </div>
</body>
</html>`;
  }

  async generatePDFBlob(purchaseOrder, customerCompanyData) {
    const invoiceHTML = await this.generateHTMLContent(purchaseOrder, customerCompanyData);
    return new Blob([invoiceHTML], { type: 'text/html' });
  }

  async generatePDFForPrint(purchaseOrder, customerCompanyData) {
    const invoiceHTML = await this.generateHTMLContent(purchaseOrder, customerCompanyData);
    
    // Create a new window for the PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    
    // Trigger print dialog
    printWindow.onload = () => {
      printWindow.print();
    };
  }

  async uploadToFirebase(purchaseOrder, customerCompanyData, onProgress) {
    try {
      onProgress(20);

      const htmlBlob = await this.generatePDFBlob(purchaseOrder, customerCompanyData);
      onProgress(40);

      const orderDetails = this.getOrderDetails(purchaseOrder);
      const customerInfo = this.getCustomerInfo(purchaseOrder);
      const totalsInfo = this.getTotalsInfo(purchaseOrder);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `purchase-orders/${orderDetails.poNumber}_${timestamp}.html`;
      
      onProgress(60);

      // Fetch order data to get authorized emails for metadata
      const orderData = await this.fetchOrderData(purchaseOrder);
      const authorizedEmails = this.getAuthorizedEmails(orderData);

      const storageRef = ref(storage, filename);
      const snapshot = await uploadBytes(storageRef, htmlBlob, {
        contentType: 'text/html',
        customMetadata: {
          'poNumber': orderDetails.poNumber,
          'customerCompany': customerInfo.companyName,
          'totalAmount': totalsInfo.total.toString(),
          'uploadDate': new Date().toISOString(),
          'hasCustomerLogo': (customerCompanyData && customerCompanyData.logoUrl) ? 'true' : 'false',
          'recipientCount': authorizedEmails.length.toString(),
          'authorizedEmails': authorizedEmails.join(', ')
        }
      });
      
      onProgress(80);

      const downloadURL = await getDownloadURL(snapshot.ref);
      
      onProgress(90);

      // Update the order document if orderId exists
      const orderId = purchaseOrder.orderId || purchaseOrder.id;
      if (orderId) {
        try {
          const orderRef = doc(db, 'orders', orderId);
          await updateDoc(orderRef, {
            pdfUrl: downloadURL,
            pdfPath: filename,
            pdfUploadedAt: new Date(),
            updatedAt: new Date(),
            customerCompanyData: customerCompanyData || null
          });
        } catch (updateError) {
          console.error('Error updating order document:', updateError);
        }
      }

      onProgress(100);
      return downloadURL;
      
    } catch (error){
        console.error('Error uploading PDF:', error);
     throw error;
   }
 }

 downloadFromFirebase(pdfUrl, poNumber) {
   if (pdfUrl) {
     const link = document.createElement('a');
     link.href = pdfUrl;
     link.download = `PO_${poNumber}.html`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
   }
 }
}

export default PDFGenerator;