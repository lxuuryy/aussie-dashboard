'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  FileSignature, 
  Download, 
  Eye, 
  X, 
  Save, 
  RotateCcw, 
  CheckCircle,
  AlertCircle,
  Loader,
  PenTool,
  FileText,
  Printer,
  Shield,
  Tag,
  Package
} from 'lucide-react';
import { db, storage } from '@/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const SalesContractSignature = () => {
  const params = useParams();
  const { orderid } = params;
  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const router = useRouter();
  const [error, setError] = useState(null);

  // Check Firebase configuration
  useEffect(() => {
    console.log('Firebase configuration check:');
    console.log('- db:', !!db);
    console.log('- storage:', !!storage);
    console.log('- Order ID from params:', orderid);
    
    if (!db || !storage) {
      console.error('Firebase not properly configured!');
      setError('Firebase configuration error. Please check your setup.');
    }
  }, [orderid]);

  // Fetch order data from Firebase
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderid || !db) return;

      try {
        setLoadingOrder(true);
        console.log('Fetching order with ID:', orderid);
        
        const orderRef = doc(db, 'orders', orderid);
        const orderSnap = await getDoc(orderRef);
        
        if (orderSnap.exists()) {
          const orderData = { id: orderSnap.id, ...orderSnap.data() };
          console.log('Order data loaded:', orderData);
          setOrder(orderData);
          console.log('Order loaded successfully:', orderData);
        } else {
          console.error('Order not found with ID:', orderid);
          setError('Order not found. Please check the order ID.');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        setError(`Failed to load order: ${error.message}`);
      } finally {
        setLoadingOrder(false);
      }
    };

    fetchOrder();
  }, [orderid]);

  const [signatureData, setSignatureData] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [signatureDate, setSignatureDate] = useState(new Date().toISOString().split('T')[0]);
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [contractData, setContractData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSignaturePanel, setShowSignaturePanel] = useState(false);
  const [signatureImageUrl, setSignatureImageUrl] = useState('');
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Update contract data and signer name when order is loaded
  useEffect(() => {
    if (order) {
      setContractData(order);
      setSignerName(order?.customerInfo?.contactPerson || '');
      console.log('Contract data updated from order:', order);
    }
  }, [order]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    // Disable background scroll
    document.body.style.overflow = 'hidden';
    
    // Cleanup function to restore background scroll
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  React.useEffect(() => {
    if(contractData)
      console.log('Contract data loaded:', contractData);
  }, []); 

  // Helper function to get ABN from the data structure
  const getABN = () => {
    return contractData?.customerCompanyData?.abn || 
           contractData?.customerInfo?.abn || 
           contractData?.abn || 
           order?.customerCompanyData?.abn ||
           order?.customerInfo?.abn ||
           order?.abn ||
           'Not provided';
  };

  // Helper function to format authorized users emails
  const getAuthorizedUsersDisplay = () => {
    const authorizedUsers = contractData?.authorizedEmails || order?.authorizedEmails;
    
    if (!authorizedUsers || !Array.isArray(authorizedUsers) || authorizedUsers.length === 0) {
      return contractData?.customerInfo?.contactPerson || 'N/A';
    }

    console.log('Authorized users:', authorizedUsers);
    
    // If single email, return as is
    if (authorizedUsers.length === 1) {
      return authorizedUsers[0];
    }
    
    // If multiple emails, join with comma and line break
    return authorizedUsers.join(',\n');
  };

  // Helper function to get total quantity across all items
  const getTotalQuantity = () => {
    if (!contractData?.items || contractData.items.length === 0) return 0;
    return contractData.items.reduce((sum, item) => sum + (item.quantity || item.totalWeight || 0), 0);
  };

  // Helper function to check if any items are ACRS certified
  const hasACRSCertification = () => {
    if (!contractData?.items || contractData.items.length === 0) return false;
    return contractData.items.some(item => item.isACRSCertified);
  };

  // Helper function to generate product description
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
    
    return description || 'Steel Product';
  };

  // Helper function to get main product info
  const getMainProductInfo = () => {
    if (!contractData?.items || contractData.items.length === 0) {
      return 'Steel Products';
    }

    if (contractData.items.length === 1) {
      return generateProductDescription(contractData.items[0]);
    }

    // Multiple items - show summary
    const totalQuantity = getTotalQuantity();
    return `${contractData.items.length} Steel Products (${totalQuantity} total units)`;
  };

  // Helper function to generate product table rows for all items
  // Generate product table rows for all items (maintains green header design)
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

  // Helper function to get pricing data (for backward compatibility)
  const getPricingData = () => {
    if (!contractData?.items || contractData.items.length === 0) {
      return {
        pricePerTonne: 0,
        quantity: 0,
        subtotal: contractData?.subtotal || 0,
        gst: contractData?.gst || 0,
        totalAmount: contractData?.totalAmount || 0,
        barType: 'Steel Product',
        length: ''
      };
    }

    const firstItem = contractData.items[0];
    return {
      pricePerTonne: firstItem?.unitPrice || firstItem?.pricePerTonne || 0,
      quantity: getTotalQuantity(),
      subtotal: contractData?.subtotal || 0,
      gst: contractData?.gst || 0,
      totalAmount: contractData?.totalAmount || 0,
      barType: firstItem?.productName || firstItem?.barType || 'Steel Product',
      length: firstItem?.dimensions?.length || firstItem?.length || ''
    };
  };

  // Initialize canvas
  useEffect(() => {
    if (!showSignaturePanel) return;
    
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Set canvas size
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }, 100);
  }, [showSignaturePanel]);

  // Helper function to parse dates
  const parseCustomDate = (dateValue) => {
    if (!dateValue) return null;
    
    try {
      if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
        return dateValue.toDate();
      }
      
      if (dateValue instanceof Date) {
        return dateValue;
      }
      
      if (typeof dateValue === 'string') {
        const cleanedDate = dateValue
          .replace(' at ', ' ')
          .replace(' UTC+10', '')
          .replace(' AM', ' AM')
          .replace(' PM', ' PM');
        
        const parsed = new Date(cleanedDate);
        return isNaN(parsed.getTime()) ? null : parsed;
      }
      
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? null : parsed;
      
    } catch (error) {
      console.error('Error parsing date:', dateValue, error);
      return null;
    }
  };

  // Helper function to format dates
  const formatDate = (date) => {
    if (!date) return 'TBD';
    
    try {
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

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    isDrawingRef.current = true;
    
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    
    setIsDrawing(false);
    isDrawingRef.current = false;
    
    // Save signature data
    const canvas = canvasRef.current;
    setSignatureData(canvas.toDataURL());
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
    setSignatureImageUrl('');
  };

  // Upload signature to Firebase Storage first
  const uploadSignatureToStorage = async () => {
    if (!signatureData) {
      alert('Please provide your signature first');
      return;
    }

    setIsUploadingSignature(true);
    
    try {
      console.log('Starting signature upload...');
      
      // Convert signature to blob
      const canvas = canvasRef.current;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      
      console.log('Signature blob created:', blob);
      
      // Upload signature image to Firebase Storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const signatureFileName = `${order.poNumber}_signature_${timestamp}.png`;
      const signatureRef = ref(storage, `signatures/${signatureFileName}`);
      
      console.log('Uploading to Firebase Storage...');
      const signatureSnapshot = await uploadBytes(signatureRef, blob);
      const imageUrl = await getDownloadURL(signatureSnapshot.ref);
      
      console.log('Signature uploaded successfully:', imageUrl);
      setSignatureImageUrl(imageUrl);
      
      // Update local contract data to show signature immediately in preview
      setContractData(prev => ({
        ...prev,
        signature: {
          imageUrl: imageUrl,
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim(),
          signatureDate: new Date(signatureDate),
          signedAt: new Date(),
          contractSigned: false // Not fully signed until finalized
        }
      }));

      alert('Signature uploaded successfully! You can now finalize the contract.');
      
    } catch (error) {
      console.error('Error uploading signature:', error);
      alert(`Failed to upload signature: ${error.message}`);
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const validateForm = () => {
    if (!signatureImageUrl) {
      alert('Please upload your signature first');
      return false;
    }
    if (!signerName.trim()) {
      alert('Please enter your name');
      return false;
    }
    if (!signatureDate) {
      alert('Please select signature date');
      return false;
    }
    return true;
  };

  const finalizeContract = async () => {
    if (!validateForm()) return;

    setUploading(true);
    
    try {
      console.log('Starting contract finalization...');
      console.log('Using signature URL:', signatureImageUrl);
      
      // Generate the signed contract HTML with the uploaded signature
      const signatureInfo = {
        imageUrl: signatureImageUrl,
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        signatureDate: new Date(signatureDate),
        signedAt: new Date()
      };
      
      const signedContractHtml = generateSignedContractHtml(signatureInfo);
      console.log('Generated signed contract HTML');

      // Upload the signed contract to Firebase Storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const signedContractFileName = `${order.poNumber}_signed_contract_${timestamp}.html`;
      const signedContractBlob = new Blob([signedContractHtml], { type: 'text/html' });
      const signedContractRef = ref(storage, `signed-contracts/${signedContractFileName}`);
      
      console.log('Uploading signed contract to storage...');
      const signedContractSnapshot = await uploadBytes(signedContractRef, signedContractBlob);
      const signedContractUrl = await getDownloadURL(signedContractSnapshot.ref);
      console.log('Signed contract uploaded successfully:', signedContractUrl);

      // Extract signature filename from URL for path storage
      const signaturePathMatch = signatureImageUrl.match(/signatures%2F([^?]+)/);
      const signaturePath = signaturePathMatch ? `signatures/${decodeURIComponent(signaturePathMatch[1])}` : `signatures/${order.poNumber}_signature_${timestamp}.png`;
      
      // Prepare complete update data for Firestore
      const updateData = {
        signature: {
          imageUrl: signatureImageUrl,
          imagePath: signaturePath,
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim(),
          signatureDate: new Date(signatureDate),
          signedAt: new Date(),
          contractSigned: true
        },
        signedContractUrl: signedContractUrl,
        signedContractPath: `signed-contracts/${signedContractFileName}`,
        contractStatus: 'signed',
        
        signedAt: new Date(),
        updatedAt: new Date()
      };

      // Only add originalContractUrl if it exists
      if (contractData.contractUrl || order.contractUrl) {
        updateData.originalContractUrl = contractData.contractUrl || order.contractUrl;
      }

      // Debug logging
      console.log('Order object:', order);
      console.log('Update data for Firestore:', updateData);
      
      // Determine the correct document ID for Firestore update
      let documentId = order.id;
      if (!documentId && order.poNumber) {
        // If no id, try using poNumber as document ID
        documentId = order.poNumber;
      }
      
      if (!documentId) {
        throw new Error('No valid document ID found. Order must have either id or poNumber.');
      }
      
      console.log('Using document ID for Firestore:', documentId);
      
      // Update the order document in Firestore
      const orderRef = doc(db, 'orders', documentId);
      await updateDoc(orderRef, updateData);
      
      console.log('Firestore database updated successfully');

      // Update local state to reflect the signed contract
      setContractData(prev => ({
        ...prev,
        signature: {
          imageUrl: signatureImageUrl,
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim(),
          signatureDate: new Date(signatureDate),
          signedAt: new Date(),
          contractSigned: true
        },
        contractStatus: 'signed',
        signedContractUrl: signedContractUrl
      }));
      
      // Show success state
      setUploaded(true);
      setShowSignaturePanel(false);
      
      // Optional: Redirect or notify user
      console.log('Contract signed successfully!');

    } catch (error) {
      console.error('Error finalizing contract:', error);
      alert(`Failed to finalize contract: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Function to generate signed contract HTML
  const generateSignedContractHtml = (signatureInfo) => {
    const pricing = getPricingData();
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Signed Sales Contract - ${contractData.salesContract || 'N/A'}</title>
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
        
        .signature-section {
            margin-top: 40px;
            font-size: 12px;
            border: 2px solid #16a34a;
            padding: 20px;
            background: #f0fdf4;
            border-radius: 8px;
        }
        
        .signed-banner {
            text-align: center;
            background: #dcfce7;
            border: 2px solid #16a34a;
            padding: 15px;
            margin: 20px 0;
            border-radius: 8px;
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
            width: 300px;
            border-collapse: collapse;
            margin: 10px 0 10px auto;
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
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-section">
            <img src="https://firebasestorage.googleapis.com/v0/b/insaneambition-66b76.appspot.com/o/PNG%20BACKGROUND%20WHITTE%20TRANSPARENT%201.png?alt=media&token=ef93bcfa-f0b1-40fe-a65c-147d8a100f59" alt="Aussie Steel Direct" class="company-logo" />
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

    <div class="signed-banner">
        <div style="font-size: 18px; font-weight: bold; color: #166534; margin-bottom: 5px;">
            ✓ DIGITALLY SIGNED CONTRACT
        </div>
        <div style="font-size: 12px; color: #15803d;">
            This contract has been executed and is legally binding
        </div>
    </div>

    <div class="document-info">
        <div>
            <strong>Australian Business Number:</strong> 95 675 742 720<br>
            <strong>Company Address:</strong> U 6008/370 Queen Street, Melbourne VIC 3000 Australia<br>
            <strong>Sales Contract:</strong> ${contractData?.salesContract || 'N/A'}
        </div>
        <div style="text-align: right;">
            <strong>${contractData?.customerInfo?.companyName || 'Customer'} Order Ref No:</strong> ${order?.poNumber || 'N/A'}
        </div>
    </div>

    <div style="margin-bottom: 20px;">
        <div style="font-weight: bold; margin-bottom: 10px; font-size: 14px;">Customer:</div>
        <div class="info-grid">
            <div class="info-label">Customer:</div>
            <div>${contractData?.customerInfo?.companyName || 'N/A'}</div>
            
            <div class="info-label">Date:</div>
            <div>${formatDate(contractData?.orderDate || order?.orderDate)}</div>
            
            <div class="info-label">Delivery Date:</div>
            <div>${formatDate(contractData?.estimatedDelivery || contractData?.deliveryDate || order?.estimatedDelivery)}</div>
            
            <div class="info-label">Delivery Address:</div>
            <div>${contractData?.deliveryAddress?.fullAddress || 
                   (typeof contractData?.deliveryAddress === 'string' ? contractData.deliveryAddress : 'TBA')}</div>
            
            <div class="info-label">Attention to:</div>
            <div style="white-space: pre-line;">${getAuthorizedUsersDisplay()}</div>
        </div>
    </div>

    <div style="margin: 20px 0; font-size: 14px;">
       We are pleased to advise that we will supply the following material:
   </div>

   <div class="info-grid">
       <div class="info-label">Product Description:</div>
       <div>${getMainProductInfo()}${hasACRSCertification() ? '<span class="acrs-badge">ACRS CERTIFIED</span>' : ''}</div>
       
       <div class="info-label">Payment Terms:</div>
       <div>${contractData?.contractTerms?.paymentTerms || contractData?.paymentTerms || '30 Days from delivery to yard'}</div>
       
       <div class="info-label">Delivery Terms:</div>
       <div>${contractData?.contractTerms?.deliveryTerms || contractData?.deliveryTerms || 'Delivery Duty paid - unloading by purchaser'}</div>
       
       <div class="info-label">Total Quantity:</div>
       <div>${getTotalQuantity()} ${contractData?.items?.[0]?.pricePerUnit === 'tonne' ? 'tonnes' : 'units'}</div>
       
       <div class="info-label">Quantity Tolerance:</div>
       <div>${contractData?.contractTerms?.quantityTolerance || contractData?.quantityTolerance || '+/- 10%'}</div>
       
       <div class="info-label">Invoicing Basis:</div>
       <div>${contractData?.contractTerms?.invoicingBasis || contractData?.invoicingBasis || 'Theoretical Weight'}</div>
       
       <div class="info-label">Total Amount:</div>
       <div>AUD ${contractData?.totalAmount?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'} GST inclusive</div>
       
       <div class="info-label">Bank details:</div>
       <div>Commonwealth Bank<br>Aussie Steel Direct Pty Ltd<br>BSB: 063-019<br>Account: 1273 6650</div>
       
       <div class="info-label">Packing:</div>
       <div>${contractData?.contractTerms?.packing || contractData?.packing || "Mill's Standard for Export"}</div>
       
       <div class="info-label">Shipment:</div>
       <div>${contractData?.estimatedDelivery ? 
           `Delivery by ${formatLongDate(contractData.estimatedDelivery)}` : 
           contractData?.shipmentDetails || 'TBD'}</div>
       
       <div class="info-label">Documentation:</div>
       <div>${contractData?.contractTerms?.documentation || contractData?.documentation || 'Commercial Invoice<br>Certificate of Origin<br>Mill Test Certificates<br>ACRS Certification'}</div>
   </div>

   <div style="margin: 30px 0; font-size: 14px;">
       <strong>Please return a signed copy of our Sales Contract as your acceptance of the above.</strong>
   </div>

   <h3 style="margin: 30px 0 15px 0; font-size: 14px; font-weight: bold;">Product Sizes and Quantities:</h3>
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

   <table class="summary-table">
       <tr>
           <td class="label-cell">Sales Amount :</td>
           <td class="amount-cell">${pricing.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
       </tr>
       <tr>
           <td class="label-cell">GST (10%) :</td>
           <td class="amount-cell">${pricing.gst.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
       </tr>
       <tr>
           <td class="label-cell">Total (incl. GST) :</td>
           <td class="amount-cell">${pricing.totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
       </tr>
   </table>

   <div class="payment-terms">
       ${contractData?.contractTerms?.paymentTerms || contractData?.paymentTerms || 'STRICTLY 30 DAYS FROM ARRIVAL TO YARD'}
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
       <div style="margin-bottom: 15px; font-weight: bold; font-size: 14px;">EXECUTED CONTRACT - CUSTOMER SIGNATURE</div>
       
       <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 15px;">
           <img src="${signatureInfo.imageUrl}" alt="Digital Signature" style="max-width: 300px; max-height: 80px; border: 1px solid #ddd; padding: 5px; background: white;" />
           <div style="color: #16a34a; font-weight: bold; font-size: 14px;">
               ✓ DIGITALLY SIGNED
           </div>
       </div>
       
       <div style="border-top: 1px solid #16a34a; padding-top: 15px;">
           <div><strong>Signatory Name:</strong> ${signatureInfo.signerName}</div>
           ${signatureInfo.signerTitle ? `<div><strong>Title/Position:</strong> ${signatureInfo.signerTitle}</div>` : ''}
           <div><strong>Company:</strong> ${contractData?.customerInfo?.companyName || 'N/A'}</div>
           <div><strong>ABN:</strong> ${getABN()}</div>
           <div><strong>Date Signed:</strong> ${signatureInfo.signatureDate.toLocaleDateString('en-AU')}</div>
           <div><strong>Time Signed:</strong> ${signatureInfo.signedAt.toLocaleString('en-AU')}</div>
           <div><strong>Digital Signature ID:</strong> ${order?.poNumber || 'N/A'}</div>
       </div>
   </div>

   <div style="margin-top: 30px; font-size: 11px; text-align: center; color: #666;">
       This document contains a legally binding digital signature in accordance with the Electronic Transactions Act.
       <br>Document generated on ${new Date().toLocaleString('en-AU')}
   </div>
</body>
</html>`;
};

 const printContract = () => {
   window.print();
 };

 // Show loading state while fetching order
 if (loadingOrder) {
   return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
       <div className="bg-white rounded-2xl p-8 shadow-xl">
         <div className="flex items-center gap-3">
           <Loader className="w-6 h-6 animate-spin text-blue-600" />
           <span className="text-gray-800">Loading order details...</span>
         </div>
       </div>
     </div>
   );
 }

 // Show error state if order fetch failed
 if (error) {
   return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
       <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full text-center">
         <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
         <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Order</h2>
         <p className="text-gray-600 mb-4">{error}</p>
         <button
           onClick={() => window.location.reload()}
           className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
         >
           Retry
         </button>
       </div>
     </div>
   );
 }

 // Show message if no order found
 if (!order) {
   return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
       <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full text-center">
         <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
         <h2 className="text-xl font-bold text-gray-900 mb-2">No Order Found</h2>
         <p className="text-gray-600">Please check the order ID and try again.</p>
       </div>
     </div>
   );
 }

 if (loading) {
   return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
       <div className="bg-white rounded-2xl p-8 shadow-xl">
         <div className="flex items-center gap-3">
           <Loader className="w-6 h-6 animate-spin text-blue-600" />
           <span className="text-gray-800">Loading contract details...</span>
         </div>
       </div>
     </div>
   );
 }

 return (
   <div className="min-h-screen bg-gray-50">
     <div className="max-w-7xl mx-auto px-4 py-6">
       {/* Header */}
       <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-2xl mb-6 shadow-xl">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
             <FileSignature className="w-8 h-8" />
             <div>
               <h1 className="text-2xl font-bold">Sales Contract Signature</h1>
               <p className="text-blue-100 flex items-center gap-2">
                 PO #{order.poNumber} - {contractData?.customerInfo?.companyName}
                 {hasACRSCertification() && (
                   <span className="inline-flex items-center gap-1 bg-blue-500/30 px-2 py-1 rounded-full text-xs">
                     <Shield className="w-3 h-3" />
                     ACRS Certified
                   </span>
                 )}
               </p>
             </div>
           </div>
           {uploaded && (
             <div className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full">
               <CheckCircle className="w-5 h-5" />
               <span>Contract Signed</span>
             </div>
           )}
         </div>
       </div>

       {/* Main Content */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Contract Display - Takes 2/3 of the width on large screens */}
         <div className="lg:col-span-2">
           <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
             <div className="p-8">
               {/* Contract Content - Using inline styles to match Sales Contract Generator exactly */}
               <div style={{ 
                 fontFamily: 'Arial, sans-serif', 
                 lineHeight: '1.4', 
                 color: '#333', 
                 maxWidth: '800px', 
                 margin: '0 auto', 
                 background: 'white' 
               }}>
               
               {/* Header */}
               <div style={{ 
                 display: 'flex', 
                 justifyContent: 'space-between', 
                 alignItems: 'flex-start', 
                 marginBottom: '30px', 
                 paddingBottom: '15px', 
                 borderBottom: '2px solid #000' 
               }}>
                 <div style={{ flex: 1 }}>
                   <img 
                     src="https://firebasestorage.googleapis.com/v0/b/insaneambition-66b76.appspot.com/o/PNG%20BACKGROUND%20WHITTE%20TRANSPARENT%201.png?alt=media&token=ef93bcfa-f0b1-40fe-a65c-147d8a100f59" 
                     alt="Aussie Steel Direct" 
                     style={{ 
                       maxWidth: '180px', 
                       maxHeight: '120px', 
                       width: 'auto', 
                       height: 'auto', 
                       objectFit: 'contain', 
                       marginBottom: '10px', 
                       display: 'block' 
                     }}
                     onError={(e) => {
                       e.target.style.display = 'none';
                       e.target.nextElementSibling.style.display = 'block';
                     }}
                   />
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#0d9488', 
                     marginBottom: '5px', 
                     display: 'none' 
                   }}>
                     AUSSIE STEEL DIRECT
                   </div>
                   
                 </div>
                 
                 <div style={{ textAlign: 'right' }}>
                   <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
                     Aussie Steel Direct Pty Ltd
                   </h3>
                   <div style={{ fontSize: '12px', lineHeight: '1.3' }}>
                     95 675 742 720<br />
                     sales@aussiesteeldirect.com.au<br />
                     +61 4 4952 5928
                   </div>
                 </div>
               </div>

               {/* Document Info */}
               <div style={{ 
                 display: 'flex', 
                 justifyContent: 'space-between', 
                 marginBottom: '20px', 
                 fontSize: '14px' 
               }}>
                 <div>
                   <strong>Australian Business Number:</strong> 95 675 742 720<br />
                   <strong>Company Address:</strong> U 6008/370 Queen Street, Melbourne VIC 3000 Australia<br />
                   <strong>Sales Contract:</strong> {contractData?.salesContract}
                 </div>
                 <div style={{ textAlign: 'right' }}>
                   <strong>{contractData?.customerInfo?.companyName || 'Customer Company'} Order Ref No:</strong> {order.poNumber}
                 </div>
               </div>

               <div style={{ marginBottom: '20px' }}>
                 <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>Customer:</div>
                 <div style={{ 
                   display: 'grid', 
                   gridTemplateColumns: '150px 1fr', 
                   gap: '5px', 
                   marginBottom: '15px', 
                   fontSize: '13px' 
                 }}>
                   <div style={{ fontWeight: 'bold' }}>Customer:</div>
                   <div>{contractData?.customerInfo?.companyName || 'Customer Company'}</div>
                   
                   <div style={{ fontWeight: 'bold' }}>Date:</div>
                   <div>{formatDate(contractData?.orderDate || order?.orderDate)}</div>
                   
                   <div style={{ fontWeight: 'bold' }}>Delivery Date:</div>
                   <div>{formatDate(contractData?.estimatedDelivery || contractData?.deliveryDate || order?.estimatedDelivery)}</div>
                   
                   <div style={{ fontWeight: 'bold' }}>Delivery Address:</div>
                   <div>{contractData?.deliveryAddress?.fullAddress || 
                        (typeof contractData?.deliveryAddress === 'string' ? contractData.deliveryAddress : 'TBA')}</div>
                   
                   <div style={{ fontWeight: 'bold' }}>Attention to:</div>
                   <div style={{ whiteSpace: 'pre-line' }}>{getAuthorizedUsersDisplay()}</div>
                 </div>
               </div>

               {/* Supply Notice */}
               <div style={{ margin: '20px 0', fontSize: '14px' }}>
                 We are pleased to advise that we will supply the following material:
               </div>

               {/* Contract Terms Grid */}
               <div style={{ 
                 display: 'grid', 
                 gridTemplateColumns: '150px 1fr', 
                 gap: '5px', 
                 marginBottom: '15px', 
                 fontSize: '13px' 
               }}>
                 <div style={{ fontWeight: 'bold' }}>Product Description:</div>
                 <div className="flex items-center gap-2">
                   {getMainProductInfo()}
                   {hasACRSCertification() && (
                     <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">
                       <Shield className="w-3 h-3" />
                       ACRS CERTIFIED
                     </span>
                   )}
                 </div>
                 
                 <div style={{ fontWeight: 'bold' }}>Payment Terms:</div>
                 <div>{contractData?.contractTerms?.paymentTerms || contractData?.paymentTerms || '30 Days from delivery to yard'}</div>
                 
                 <div style={{ fontWeight: 'bold' }}>Delivery Terms:</div>
                 <div>{contractData?.contractTerms?.deliveryTerms || contractData?.deliveryTerms || 'Delivery Duty paid - unloading by purchaser'}</div>
                 
                 <div style={{ fontWeight: 'bold' }}>Total Quantity:</div>
                 <div>{getTotalQuantity()} {contractData?.items?.[0]?.pricePerUnit === 'tonne' ? 'tonnes' : 'units'}</div>
                 
                 <div style={{ fontWeight: 'bold' }}>Quantity Tolerance:</div>
                 <div>{contractData?.contractTerms?.quantityTolerance || contractData?.quantityTolerance || '+/- 10%'}</div>
                 
                 <div style={{ fontWeight: 'bold' }}>Invoicing Basis:</div>
                 <div>{contractData?.contractTerms?.invoicingBasis || contractData?.invoicingBasis || 'Theoretical Weight'}</div>
                 
                 <div style={{ fontWeight: 'bold' }}>Total Amount:</div>
                 <div>AUD {contractData?.totalAmount?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'} GST inclusive</div>
                 
                 <div style={{ fontWeight: 'bold' }}>Bank details:</div>
                 <div>Commonwealth Bank<br />Aussie Steel Direct Pty Ltd<br />BSB: 063-019<br />Account: 1273 6650</div>
                 
                 <div style={{ fontWeight: 'bold' }}>Packing:</div>
                 <div>{contractData?.contractTerms?.packing || contractData?.packing || "Mill's Standard for Export"}</div>
                 
                 <div style={{ fontWeight: 'bold' }}>Shipment:</div>
                 <div>{contractData?.estimatedDelivery ? 
                   `Delivery by ${formatLongDate(contractData?.estimatedDelivery)}` : 
                   contractData?.shipmentDetails || 'TBD'}</div>
                 
                 <div style={{ fontWeight: 'bold' }}>Documentation:</div>
                 <div>{contractData?.contractTerms?.documentation || contractData?.documentation || 'Commercial Invoice<br />Certificate of Origin<br />Mill Test Certificates<br />ACRS Certification'}</div>
               </div>

               {/* Acceptance Notice */}
               <div style={{ margin: '30px 0', fontSize: '14px' }}>
                 <strong>Please return a signed copy of our Sales Contract as your acceptance of the above.</strong>
               </div>

               {/* Product Details Section */}
               <div style={{ marginTop: '30px' }}>
                 

                 {/* Product Table */}
                 {/* Product Table Section - Replace the gray boxes with green table */}
<div style={{ marginBottom: '20px' }}>
  <h3 style={{ margin: '20px 0', fontSize: '14px', fontWeight: 'bold' }}>
    Product Sizes and Quantities:
  </h3>
  <p style={{ fontSize: '12px', marginBottom: '15px' }}>
    {hasACRSCertification() ? 
      'Deformed Bars in Length are produced to AS/NZS 4671 : 2019 Grade 500N and are ACRS certified.' :
      'Steel products manufactured to Australian Standards.'
    }
  </p>

  {contractData?.items && contractData.items.length > 0 ? (
    <table style={{ 
      width: '100%', 
      borderCollapse: 'collapse', 
      margin: '20px 0', 
      border: '2px solid #000' 
    }}>
      <thead>
        <tr>
          <th style={{ 
            backgroundColor: '#4a9b8e', 
            color: 'white', 
            padding: '8px', 
            textAlign: 'center', 
            fontSize: '12px', 
            fontWeight: 'bold', 
            border: '1px solid #000' 
          }}>
            Description of Goods{hasACRSCertification() ? (
              <><br />AS/NZS 4671 : 2019 Grade 500 N Reinforcing Bar ACRS</>
            ) : ''}
          </th>
          <th style={{ 
            backgroundColor: '#4a9b8e', 
            color: 'white', 
            padding: '8px', 
            textAlign: 'center', 
            fontSize: '12px', 
            fontWeight: 'bold', 
            border: '1px solid #000' 
          }}>
            Price<br />(AUD)
          </th>
          <th style={{ 
            backgroundColor: '#4a9b8e', 
            color: 'white', 
            padding: '8px', 
            textAlign: 'center', 
            fontSize: '12px', 
            fontWeight: 'bold', 
            border: '1px solid #000' 
          }}>
            Qty
          </th>
          <th style={{ 
            backgroundColor: '#4a9b8e', 
            color: 'white', 
            padding: '8px', 
            textAlign: 'center', 
            fontSize: '12px', 
            fontWeight: 'bold', 
            border: '1px solid #000' 
          }}>
            Amount<br />(AUD)
          </th>
        </tr>
      </thead>
      <tbody>
        {contractData.items.map((item, index) => {
          const quantity = item.quantity || item.totalWeight || 0;
          const unitPrice = item.unitPrice || item.pricePerTonne || 0;
          const itemTotal = quantity * unitPrice;
          const priceUnit = item.pricePerUnit === 'tonne' ? 'tonne' : 
                           item.pricePerUnit === 'each' ? 'each' : 
                           item.pricePerUnit || 'each';

          return (
            <tr key={index}>
              <td style={{ 
                padding: '8px', 
                textAlign: 'left', 
                border: '1px solid #000', 
                fontSize: '12px', 
                fontWeight: 'bold' 
              }}>
                {generateProductDescription(item)}
                {item.isACRSCertified && (
                  <span style={{
                    display: 'inline-block',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    marginLeft: '5px'
                  }}>
                    ACRS CERTIFIED
                  </span>
                )}
              </td>
              <td style={{ 
                padding: '8px', 
                textAlign: 'center', 
                border: '1px solid #000', 
                fontSize: '12px' 
              }}>
                {unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })} per {priceUnit}
              </td>
              <td style={{ 
                padding: '8px', 
                textAlign: 'center', 
                border: '1px solid #000', 
                fontSize: '12px' 
              }}>
                {quantity}
              </td>
              <td style={{ 
                padding: '8px', 
                textAlign: 'center', 
                border: '1px solid #000', 
                fontSize: '12px' 
              }}>
                {itemTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          );
        })}
        
        {/* Total Row */}
        <tr>
          <td style={{ 
            padding: '8px', 
            textAlign: 'left', 
            border: '1px solid #000', 
            fontSize: '12px', 
            fontWeight: 'bold' 
          }}>
            Sundry Total
          </td>
          <td style={{ 
            padding: '8px', 
            textAlign: 'center', 
            border: '1px solid #000', 
            fontSize: '12px' 
          }}>
          </td>
          <td style={{ 
            padding: '8px', 
            textAlign: 'center', 
            border: '1px solid #000', 
            fontSize: '12px', 
            fontWeight: 'bold' 
          }}>
            {getTotalQuantity()}
          </td>
          <td style={{ 
            padding: '8px', 
            textAlign: 'center', 
            border: '1px solid #000', 
            fontSize: '12px', 
            fontWeight: 'bold' 
          }}>
            {contractData.items.reduce((sum, item) => {
              const quantity = item.quantity || item.totalWeight || 0;
              const unitPrice = item.unitPrice || item.pricePerTonne || 0;
              return sum + (quantity * unitPrice);
            }, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </td>
        </tr>
      </tbody>
    </table>
  ) : (
    <div style={{ 
      textAlign: 'center', 
      padding: '40px', 
      color: '#6b7280',
      border: '2px solid #000',
      backgroundColor: '#f9fafb'
    }}>
      <div style={{ fontSize: '14px', marginBottom: '8px' }}>📦</div>
      <p style={{ fontSize: '12px' }}>No product details available</p>
    </div>
  )}
</div>

                 {/* Summary Table - Exact match to Sales Contract Generator */}
                 <table style={{ 
                   width: '300px', 
                   marginLeft: 'auto', 
                   borderCollapse: 'collapse', 
                   margin: '10px 0 10px auto',
                   fontSize: '12px'
                 }}>
                   <tbody>
                     <tr>
                       <td style={{ 
                         padding: '5px 8px', 
                         border: '1px solid #000', 
                         textAlign: 'right', 
                         fontWeight: 'bold', 
                         backgroundColor: '#f5f5f5' 
                       }}>
                         Sales Amount :
                       </td>
                       <td style={{ 
                         padding: '5px 8px', 
                         border: '1px solid #000', 
                         textAlign: 'right', 
                         width: '100px' 
                       }}>
                         {getPricingData().subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                       </td>
                     </tr>
                     <tr>
                       <td style={{ 
                         padding: '5px 8px', 
                         border: '1px solid #000', 
                         textAlign: 'right', 
                         fontWeight: 'bold', 
                         backgroundColor: '#f5f5f5' 
                       }}>
                         GST (10%) :
                       </td>
                       <td style={{ 
                         padding: '5px 8px', 
                         border: '1px solid #000', 
                         textAlign: 'right' 
                       }}>
                         {getPricingData().gst.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                       </td>
                     </tr>
                     <tr>
                       <td style={{ 
                         padding: '5px 8px', 
                         border: '1px solid #000', 
                         textAlign: 'right', 
                         fontWeight: 'bold', 
                         backgroundColor: '#f5f5f5' 
                       }}>
                         Total (incl. GST) :
                       </td>
                       <td style={{ 
                         padding: '5px 8px', 
                         border: '1px solid #000', 
                         textAlign: 'right', 
                         fontWeight: 'bold' 
                       }}>
                         {getPricingData().totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                       </td>
                     </tr>
                   </tbody>
                 </table>

                 {/* Payment Terms - Exact match to Sales Contract Generator */}
                 <div style={{ 
                   margin: '20px 0', 
                   fontSize: '14px', 
                   fontWeight: 'bold', 
                   textAlign: 'center' 
                 }}>
                   {contractData?.contractTerms?.paymentTerms || contractData?.paymentTerms || 'STRICTLY 30 DAYS FROM ARRIVAL TO YARD'}
                 </div>

                 <div style={{ 
                   margin: '20px 0', 
                   fontSize: '14px', 
                   fontWeight: 'bold', 
                   textAlign: 'center' 
                 }}>
                   BALANCE OF PAYMENT MAY BE MADE BY DIRECT DEPOSIT UPON MATURITY
                 </div>

                 {/* Bank Details - Exact match to Sales Contract Generator */}
                 <div style={{ margin: '20px 0', fontSize: '12px' }}>
                   <strong>Bank</strong> &nbsp;&nbsp;&nbsp; : &nbsp;&nbsp; Commonwealth Bank &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Acc Name</strong> : &nbsp;&nbsp; Aussie Steel Direct Pty Ltd<br />
                   <strong>BSB</strong> &nbsp;&nbsp;&nbsp;&nbsp; : &nbsp;&nbsp; 063-019<br />
                   <strong>ACC</strong> &nbsp;&nbsp;&nbsp;&nbsp; : &nbsp;&nbsp; 1273 6650
                 </div>

                 {/* Terms Section - Exact match to Sales Contract Generator */}
                 <div style={{ margin: '20px 0', fontSize: '11px', lineHeight: '1.5' }}>
                   <p><strong>All sales are subject to Aussie Steel Direct's General Terms and Conditions of Sale 2025.</strong></p>
                   <br />
                   <p><strong>Duties / Taxes :</strong> Any changes in government or export taxes into Aussie Steel Direct's accounts.</p>
                   <br />
                   <p><strong>Other terms of this Contract shall be as per INCOTERMS 2020.</strong></p>
                 </div>
               </div>

               {/* Signature Section */}
               <div style={{ marginTop: '40px', fontSize: '12px' }}>
                 <div style={{ marginBottom: '10px' }}><strong>Signed for and on behalf of</strong></div>
                 
                 {(contractData?.signature?.contractSigned || signatureImageUrl) ? (
                   <div style={{ border: '1px solid #ccc', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                       <img 
                         src={contractData.signature?.imageUrl || signatureImageUrl} 
                         alt="Digital Signature" 
                         style={{ maxWidth: '300px', maxHeight: '80px', border: '1px solid #ddd', padding: '5px', backgroundColor: 'white' }}
                       />
                       <div style={{ color: '#16a34a', fontWeight: 'bold' }}>
                         {contractData.signature?.contractSigned ? '✓ Digitally Signed' : '✓ Signature Preview'}
                       </div>
                     </div>
                     {contractData.signature?.contractSigned && (
                       <div style={{ borderTop: '1px solid #ddd', paddingTop: '10px' }}>
                         <div><strong>Name:</strong> {contractData.signature.signerName}</div>
                         {contractData.signature.signerTitle && (
                           <div><strong>Title:</strong> {contractData.signature.signerTitle}</div>
                         )}
                         <div><strong>Company:</strong> {contractData.customerInfo?.companyName}</div>
                         <div><strong>ABN:</strong> {getABN()}</div>
                         <div><strong>Date Signed:</strong> {contractData.signature.signatureDate?.toLocaleDateString ? contractData.signature.signatureDate.toLocaleDateString('en-AU') : formatDate(contractData.signature.signatureDate)}</div>
                         <div><strong>Signed At:</strong> {contractData.signature.signedAt?.toLocaleString ? contractData.signature.signedAt.toLocaleString('en-AU') : new Date().toLocaleString('en-AU')}</div>
                       </div>
                     )}
                   </div>
                 ) : (
                   <div style={{ border: '1px dotted #000', height: '80px', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9', color: '#666' }}>
                     {showSignaturePanel ? 'Please complete signature in the panel →' : 'Awaiting Customer Signature'}
                   </div>
                 )}
                 
                 <div style={{ marginTop: '10px' }}>
                   <div><strong>Company:</strong> {contractData?.customerInfo?.companyName || 'Customer Company'}</div>
                   <div><strong>ABN:</strong> {getABN()}</div>
                   <div style={{ borderBottom: '1px dotted #000', paddingBottom: '5px', marginTop: '5px' }}>
                     <strong>Date:</strong> {contractData?.signature?.contractSigned ? formatDate(contractData?.signature.signatureDate) : '_______________'}
                   </div>
                 </div>
               </div>

               {/* Status Banner */}
               {contractData?.signature?.contractSigned && (
                 <div style={{ marginTop: '30px', textAlign: 'center', padding: '15px', backgroundColor: '#dcfce7', border: '2px solid #16a34a', borderRadius: '8px' }}>
                   <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#166534', marginBottom: '5px' }}>
                     ✓ CONTRACT EXECUTED
                   </div>
                   <div style={{ fontSize: '12px', color: '#15803d' }}>
                     This contract has been digitally signed and is legally binding.
                   </div>
                 </div>
               )}
             </div>
           </div>
         </div>

         {/* Signature Panel - Takes 1/3 of the width on large screens */}
         <div className="lg:col-span-1">
           <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
             <div className="p-6">
               <div className="space-y-6">
                 <div>
                   <h3 className="text-xl font-semibold text-gray-800 mb-2">Digital Signature</h3>
                   <p className="text-sm text-gray-600">Please review the contract and provide your digital signature to proceed.</p>
                 </div>

                 

                 {/* Signature Form */}
                 <div className="space-y-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Signatory Name *
                     </label>
                     <input
                       type="text"
                       value={signerName}
                       onChange={(e) => setSignerName(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       placeholder="Enter your full name"
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Title/Position
                     </label>
                     <input
                       type="text"
                       value={signerTitle}
                       onChange={(e) => setSignerTitle(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                       placeholder="e.g., Managing Director, CFO"
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Signature Date *
                     </label>
                     <input
                       type="date"
                       value={signatureDate}
                       onChange={(e) => setSignatureDate(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     />
                   </div>

                   {/* Signature Canvas */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Digital Signature *
                     </label>
                     <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                       {!showSignaturePanel ? (
                         <button
                           onClick={() => setShowSignaturePanel(true)}
                           className="w-full py-12 text-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                         >
                           <PenTool className="w-12 h-12 mx-auto mb-3" />
                           <div className="text-base font-medium">Click to add signature</div>
                         </button>
                       ) : (
                         <div className="space-y-4">
                           <div className="text-sm text-gray-600 text-center">
                             Draw your signature below
                           </div>
                           <canvas
                             ref={canvasRef}
                             className="w-full h-48 border border-gray-300 rounded cursor-crosshair bg-white"
                             onMouseDown={startDrawing}
                             onMouseMove={draw}
                             onMouseUp={stopDrawing}
                             onMouseLeave={stopDrawing}
                             onTouchStart={startDrawing}
                             onTouchMove={draw}
                             onTouchEnd={stopDrawing}
                           />
                           <div className="flex gap-3">
                             <button
                               onClick={clearSignature}
                               className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                             >
                               <RotateCcw className="w-4 h-4" />
                               Clear
                             </button>
                             <button
                               onClick={uploadSignatureToStorage}
                               disabled={!signatureData || isUploadingSignature}
                               className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors disabled:opacity-50"
                             >
                               {isUploadingSignature ? (
                                 <Loader className="w-4 h-4 animate-spin" />
                               ) : (
                                 <Save className="w-4 h-4" />
                               )}
                               {isUploadingSignature ? 'Uploading...' : 'Upload Signature'}
                             </button>
                           </div>
                         </div>
                       )}
                     </div>
                     
                     {signatureImageUrl && (
                       <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                         <div className="flex items-center gap-2 text-sm text-green-700">
                           <CheckCircle className="w-5 h-5" />
                           <span>Signature uploaded successfully</span>
                         </div>
                       </div>
                     )}
                   </div>

                   {/* Action Buttons */}
                   <div className="space-y-4 pt-6">
                     <button
                       onClick={finalizeContract}
                       disabled={uploading || !signatureImageUrl || !signerName.trim()}
                       className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 px-6 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                     >
                       {uploading ? (
                         <>
                           <Loader className="w-6 h-6 animate-spin" />
                           <span>Finalizing Contract...</span>
                         </>
                       ) : uploaded ? (
                         <>
                           <CheckCircle className="w-6 h-6" />
                           <span>Contract Signed Successfully</span>
                         </>
                       ) : (
                         <>
                           <FileSignature className="w-6 h-6" />
                           <span>Finalize & Sign Contract</span>
                         </>
                       )}
                     </button>

                     {contractData?.signedContractUrl && (
                       <button
                         onClick={() => window.open(contractData.signedContractUrl, '_blank')}
                         className="w-full flex items-center justify-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 px-4 rounded-lg font-medium transition-colors"
                       >
                         <Download className="w-5 h-5" />
                         <span>Download Signed Contract</span>
                       </button>
                     )}
                   </div>

                   {/* Terms Acknowledgment */}
                   <div className="pt-6 border-t border-gray-200">
                     <div className="text-xs text-gray-500 space-y-2">
                       <p>
                         By signing this contract, you acknowledge that you have read, understood, and agree to be bound by all terms and conditions outlined in this sales contract.
                       </p>
                       <p>
                         This digital signature is legally binding in accordance with the Electronic Transactions Act.
                       </p>
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         </div>
       </div>

       {/* Success Modal */}
       {uploaded && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
           <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
             <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <CheckCircle className="w-8 h-8 text-green-600" />
             </div>
             <h3 className="text-xl font-bold text-gray-900 mb-2">Contract Signed Successfully!</h3>
             <p className="text-gray-600 mb-6">
               The sales contract has been digitally signed and stored securely. Both parties will receive a copy of the executed contract.
             </p>
             <div className="flex gap-3">
               <button
                 onClick={() => window.open(contractData.signedContractUrl, '_blank')}
                 className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
               >
                 View Contract
               </button>
               <button
                 onClick={() => router.back()}
                 className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
               >
                 Close
               </button>
             </div>
           </div>
         </div>
       )}
     </div>
   </div>
   </div>
 );
};

export default SalesContractSignature;