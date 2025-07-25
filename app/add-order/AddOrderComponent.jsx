'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Package, 
  Building, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  DollarSign, 
  FileText, 
  Save, 
  X,
  Loader,
  Upload,
  CheckCircle,
  File,
  AlertCircle,
  Ruler,
  Weight,
  Shield,
  Tag,
  Calculator,
  Wrench,
  Search,
  PenTool,
  Camera,
  ScanLine,
  Brain,
  Wand2,
  FileImage,
  FileCheck
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as mammoth from 'mammoth';





import { db, storage } from '@/firebase';

const AddOrderComponent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Order Details, 2: Document Upload, 3: Product Check, 4: Success
  const [companyData, setCompanyData] = useState(null);
  
  // User email input state
  const [userEmail, setUserEmail] = useState('');
  const [newAuthorizedEmail, setNewAuthorizedEmail] = useState('');
  const [proformaInvoiceFile, setProformaInvoiceFile] = useState(null);

  // File upload states
  const [purchaseOrderFile, setPurchaseOrderFile] = useState(null);
  const [salesContractFile, setSalesContractFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ po: 0, contract: 0, proforma: 0 });

  // Document scanning states
  const [documentScanFile, setDocumentScanFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [scanResults, setScanResults] = useState(null);
  const [showScanResults, setShowScanResults] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  // Product check states
  const [missingProducts, setMissingProducts] = useState([]);
  const [productsToAdd, setProductsToAdd] = useState([]);
  const [addingProducts, setAddingProducts] = useState(false);

  // Signature form state
  const [signatureForm, setSignatureForm] = useState({
    signerName: '',
    signerTitle: '',
    signatureDate: new Date().toISOString().split('T')[0]
  });

  // Multi-product state
  const [products, setProducts] = useState([{
    id: Date.now(),
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
    specifications: [],
    tags: [],
    isACRSCertified: false,
    unitPrice: '',
    pricePerUnit: 'each',
    currency: 'AUD',
    quantity: 1
  }]);

  const [currentProductIndex, setCurrentProductIndex] = useState(0);

  // New specification states
  const [newSpec, setNewSpec] = useState({ key: '', value: '' });
  const [newTag, setNewTag] = useState('');

  const extractTextFromPDF = async (file) => {
  setScanningProgress(20);
  
  try {
    // Load PDF.js from CDN if not already loaded
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      document.head.appendChild(script);
      
      await new Promise((resolve) => {
        script.onload = resolve;
      });
      
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const arrayBuffer = await file.arrayBuffer();
    
    setScanningProgress(40);
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let extractedText = '';
    const totalPages = pdf.numPages;
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      setScanningProgress(40 + (pageNum / totalPages) * 30);
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Sort items by position (top to bottom, left to right)
      const sortedItems = textContent.items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5]; // Y position (inverted)
        if (Math.abs(yDiff) > 5) return yDiff > 0 ? 1 : -1;
        return a.transform[4] - b.transform[4]; // X position
      });
      
      // Group items by approximate line
      const lines = [];
      let currentLine = [];
      let lastY = null;
      
      sortedItems.forEach(item => {
        const y = item.transform[5];
        
        if (lastY === null || Math.abs(y - lastY) > 5) {
          if (currentLine.length > 0) {
            lines.push(currentLine.map(i => i.str).join(' '));
            currentLine = [];
          }
        }
        
        currentLine.push(item);
        lastY = y;
      });
      
      if (currentLine.length > 0) {
        lines.push(currentLine.map(i => i.str).join(' '));
      }
      
      const pageText = lines.join('\n');
      extractedText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
    }
    
    return extractedText;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF. Please ensure the PDF contains selectable text.');
  }
}

const extractTextFromWord = async (file) => {
  setScanningProgress(25);
  const arrayBuffer = await file.arrayBuffer();
  
  setScanningProgress(50);
  const result = await mammoth.extractRawText({ arrayBuffer });
  const extractedText = result.value;
  
  // Log any messages or warnings from Mammoth
  if (result.messages && result.messages.length > 0) {
    console.log('Mammoth messages:', result.messages);
  }
  
  return extractedText;
};

// Local parsing logic to replace OpenAI dependency
const parseExtractedDataLocal = (extractedText) => {
  const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line);
  
  const parsedData = {
    orderInfo: {
      poNumber: null,
      orderDate: null,
      estimatedDelivery: null,
      reference: null,
      notes: null
    },
    customerInfo: {
      companyName: null,
      contactPerson: null,
      email: null,
      phone: null,
      abn: null,
      address: {
        street: null,
        city: null,
        state: null,
        postcode: null,
        country: null
      }
    },
    deliveryAddress: {
      street: null,
      city: null,
      state: null,
      postcode: null,
      country: null
    },
    products: [],
    paymentTerms: null,
    deliveryTerms: null
  };

  let currentProduct = null;
  let products = [];

  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();
    
    // PO Number patterns
    if (lowerLine.includes('po number') || lowerLine.includes('purchase order number') || lowerLine.includes('p.o.')) {
      const poMatch = line.match(/(?:po\s*number|purchase\s*order\s*number|p\.o\.)[:\s#]*([a-z0-9\-_]+)/i);
      if (poMatch) parsedData.orderInfo.poNumber = poMatch[1];
    }
    
    // Order date patterns
    if (lowerLine.includes('order date') || lowerLine.includes('date ordered')) {
      const dateMatch = line.match(/(?:order\s*date|date\s*ordered)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i);
      if (dateMatch) parsedData.orderInfo.orderDate = dateMatch[1];
    }
    
    // Company name patterns
    if (lowerLine.includes('company') || lowerLine.includes('client') || lowerLine.includes('customer')) {
      const companyMatch = line.match(/(?:company|client|customer)[:\s]*(.+)/i);
      if (companyMatch && !parsedData.customerInfo.companyName) {
        parsedData.customerInfo.companyName = companyMatch[1].trim();
      }
    }
    
    // Contact person patterns
    if (lowerLine.includes('contact') && (lowerLine.includes('person') || lowerLine.includes('name'))) {
      const contactMatch = line.match(/contact\s*(?:person|name)[:\s]*(.+)/i);
      if (contactMatch) parsedData.customerInfo.contactPerson = contactMatch[1].trim();
    }
    
    // Email patterns
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !parsedData.customerInfo.email) {
      parsedData.customerInfo.email = emailMatch[0];
    }
    
    // Phone patterns
    const phoneMatch = line.match(/(?:phone|tel|mobile)[:\s]*([+\d\s\-()]+)/i);
    if (phoneMatch && !parsedData.customerInfo.phone) {
      parsedData.customerInfo.phone = phoneMatch[1].trim();
    }
    
    // ABN patterns
    const abnMatch = line.match(/abn[:\s]*(\d{2}\s*\d{3}\s*\d{3}\s*\d{3}|\d{11})/i);
    if (abnMatch) {
      parsedData.customerInfo.abn = abnMatch[1].replace(/\s/g, '');
    }
    
    // Address patterns
    if (lowerLine.includes('address') && !lowerLine.includes('email')) {
      const addressMatch = line.match(/address[:\s]*(.+)/i);
      if (addressMatch) {
        const addressText = addressMatch[1].trim();
        parsedData.customerInfo.address.street = addressText;
        
        // Try to extract postcode and state
        const postcodeMatch = addressText.match(/(\w{2,3})\s*(\d{4})$/i);
        if (postcodeMatch) {
          parsedData.customerInfo.address.state = postcodeMatch[1].toUpperCase();
          parsedData.customerInfo.address.postcode = postcodeMatch[2];
        }
      }
    }
    
    // Product patterns - look for item codes, product names, quantities, prices
    if (lowerLine.includes('item') && (lowerLine.includes('code') || lowerLine.includes('number'))) {
      const itemMatch = line.match(/(?:item\s*code|item\s*number)[:\s]*([a-z0-9\-_]+)/i);
      if (itemMatch) {
        if (currentProduct) products.push(currentProduct);
        currentProduct = {
          itemCode: itemMatch[1],
          productName: null,
          description: null,
          quantity: null,
          unitPrice: null,
          currency: 'AUD'
        };
      }
    }
    
    // Product name patterns
    if (currentProduct && (lowerLine.includes('product') || lowerLine.includes('description'))) {
      const productMatch = line.match(/(?:product|description)[:\s]*(.+)/i);
      if (productMatch && !currentProduct.productName) {
        currentProduct.productName = productMatch[1].trim();
        currentProduct.description = productMatch[1].trim();
      }
    }
    
    // Quantity patterns
    if (currentProduct && (lowerLine.includes('qty') || lowerLine.includes('quantity'))) {
      const qtyMatch = line.match(/(?:qty|quantity)[:\s]*(\d+)/i);
      if (qtyMatch) currentProduct.quantity = parseInt(qtyMatch[1]);
    }
    
    // Price patterns
    const priceMatch = line.match(/\$(\d+(?:\.\d{2})?)/);
    if (priceMatch && currentProduct && !currentProduct.unitPrice) {
      currentProduct.unitPrice = parseFloat(priceMatch[1]);
    }
    
    // Payment terms patterns
    if (lowerLine.includes('payment') && lowerLine.includes('terms')) {
      const paymentMatch = line.match(/payment\s*terms[:\s]*(.+)/i);
      if (paymentMatch) parsedData.paymentTerms = paymentMatch[1].trim();
    }
    
    // Delivery terms patterns
    if (lowerLine.includes('delivery') && lowerLine.includes('terms')) {
      const deliveryMatch = line.match(/delivery\s*terms[:\s]*(.+)/i);
      if (deliveryMatch) parsedData.deliveryTerms = deliveryMatch[1].trim();
    }
  });

  // Add the last product if exists
  if (currentProduct) products.push(currentProduct);
  
  parsedData.products = products;
  
  return parsedData;
};

  // Form state
  const [orderForm, setOrderForm] = useState({
    // Customer information
    poNumber: '',
    customerInfo: {
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      abn: '',
      address: {
        street: '',
        city: '',
        state: 'VIC',
        postcode: '',
        country: 'Australia'
      }
    },
    
    // Delivery details
    deliveryAddress: {
      street: '',
      city: '',
      state: 'VIC',
      postcode: '',
      country: 'Australia'
    },
    sameAsCustomer: true,
    
    // Order details
    orderDate: new Date().toISOString().split('T')[0],
    estimatedDelivery: '',
    reference: '',
    notes: '',
    
    // Terms and conditions
    paymentTerms: '30 Days from delivery to yard',
    deliveryTerms: 'Delivery Duty paid - unloading by purchaser',
    documentation: 'Commercial Invoice Certificate of Origin Mill Test Certificates ACRS Certification',
    packing: "Mill's Standard for Export",
    invoicingBasis: 'Theoretical Weight',
    quantityTolerance: '+/- 10%',
    
    // Authorized emails
    authorizedEmails: []
  });

  // OpenAI API configuration - In production, this should be in environment variables
  const OPENAI_API_KEY = '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';

  // Document scanning functionality
const handleDocumentScan = async (file) => {
  if (!file) {
    alert('Please select a document to scan');
    return;
  }

  // Check if file is supported (PDF or Word document)
  const validTypes = [
    'application/pdf', // PDF files
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword' // .doc
  ];
  
  if (!validTypes.includes(file.type)) {
    alert('Please select a PDF or Word document (.pdf, .doc, .docx)');
    return;
  }

  setIsScanning(true);
  setScanningProgress(0);
  setDocumentScanFile(file);

  try {
    let extractedText = '';

    if (file.type === 'application/pdf') {
      // Handle PDF files with CDN-loaded PDF.js
      extractedText = await extractTextFromPDF(file);
    } else {
      // Handle Word documents with Mammoth
      extractedText = await extractTextFromWord(file);
    }
    
    setScanningProgress(75);
    
    // FIXED: Proper API key check - check if key exists and is not empty
    if (!OPENAI_API_KEY || OPENAI_API_KEY.trim() === '') {
      console.warn('OpenAI API key not configured. Using basic local parsing instead.');
      
      // Use local parsing as fallback
      const parsedData = parseExtractedDataLocal(extractedText);
      setScanningProgress(100);
      
      // AUTO-FILL IMMEDIATELY - No modal shown
      autoFillFormWithData(parsedData, extractedText);
      
    } else {
      console.log('Using OpenAI API for intelligent parsing...');
      
      try {
        // Use OpenAI API for intelligent parsing
        const parsedData = await parseExtractedData(extractedText);
        
        setScanningProgress(100);
        
        // AUTO-FILL IMMEDIATELY - No modal shown
        autoFillFormWithData(parsedData, extractedText);
        
        console.log('OpenAI parsing successful and form auto-filled:', parsedData);
        
      } catch (openAIError) {
        console.error('OpenAI parsing failed, falling back to local parsing:', openAIError);
        
        // Fallback to local parsing if OpenAI fails
        const parsedData = parseExtractedDataLocal(extractedText);
        setScanningProgress(100);
        
        // AUTO-FILL IMMEDIATELY - No modal shown
        autoFillFormWithData(parsedData, extractedText);
        
        alert('OpenAI parsing failed, used local parsing instead. Form has been auto-filled. Error: ' + openAIError.message);
      }
    }
    
  } catch (error) {
    console.error('Document scanning error:', error);
    alert('Error scanning document: ' + error.message);
  } finally {
    setIsScanning(false);
    setScanningProgress(0);
  }
};


  // Convert file to base64
  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Extract text using OpenAI Vision API
  const extractTextWithOpenAI = async (base64Image) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please extract all text from this document. Focus on:
                - Company names and contact information
                - Product details (item codes, names, descriptions, quantities, prices)
                - Purchase order numbers
                - Addresses
                - Dates
                - Any technical specifications
                
                Return the extracted text in a clear, structured format.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  // Parse extracted data using OpenAI
  const parseExtractedData = async (extractedText) => {
  console.log('Calling backend API for document parsing...');
  console.log('Text length:', extractedText.length);
  console.log('Extracted Text:', extractedText); // Log first 500 chars for debugging
  
  try {
    const response = await fetch('/api/parse-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extractedText: extractedText
      }),
    });

    console.log('API Response Status:', response.status);

    // Handle different response statuses
    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error Response:', errorData);
      
      // Handle specific error types
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (response.status === 402) {
        throw new Error('API quota exceeded. Please contact support.');
      } else if (response.status === 500 && errorData.error === 'OpenAI API key not configured') {
        throw new Error('OpenAI API not configured. Using local parsing instead.');
      } else {
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
    }

    const data = await response.json();
    console.log('API Response Data:', data);
    setIsOpen(true)
    
    if (!data.success) {
      throw new Error(data.error || 'API returned unsuccessful response');
    }

    console.log('Successfully parsed document via API:', data.data);
    console.log('Metadata:', data.metadata);
    
    return data.data;
    
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};


  // Auto-fill form with extracted data
 const autoFillFormWithData = (extractedData, scanResults) => {
  console.log('🚀 === AUTO-FILL FUNCTION STARTED ===');
  console.log('Available extracted data:', extractedData);
  
  if (!extractedData) {
    console.log('❌ No extracted data available');
    alert('No extracted data available for auto-fill');
    return;
  }

  try {
    // Store scan results for reference
    setScanResults(scanResults);
    setExtractedData(extractedData);

    // Auto-fill order information
    if (extractedData.orderInfo) {
      console.log('✅ Filling order info:', extractedData.orderInfo);
      setOrderForm(prev => {
        const updated = {
          ...prev,
          poNumber: extractedData.orderInfo.poNumber || prev.poNumber,
          orderDate: extractedData.orderInfo.orderDate || prev.orderDate,
          estimatedDelivery: extractedData.orderInfo.estimatedDelivery || prev.estimatedDelivery,
          reference: extractedData.orderInfo.reference || prev.reference,
          notes: extractedData.orderInfo.notes || prev.notes
        };
        console.log('Order form updated:', updated);
        return updated;
      });
    }

    // Auto-fill customer information  
    if (extractedData.customerInfo) {
      console.log('✅ Filling customer info:', extractedData.customerInfo);
      setOrderForm(prev => {
        const updated = {
          ...prev,
          customerInfo: {
            companyName: extractedData.customerInfo.companyName || prev.customerInfo.companyName,
            contactPerson: extractedData.customerInfo.contactPerson || prev.customerInfo.contactPerson,
            email: extractedData.customerInfo.email || prev.customerInfo.email,
            phone: extractedData.customerInfo.phone || prev.customerInfo.phone,
            abn: extractedData.customerInfo.abn || prev.customerInfo.abn,
            address: {
              street: extractedData.customerInfo.address?.street || prev.customerInfo.address.street,
              city: extractedData.customerInfo.address?.city || prev.customerInfo.address.city,
              state: extractedData.customerInfo.address?.state || prev.customerInfo.address.state,
              postcode: extractedData.customerInfo.address?.postcode || prev.customerInfo.address.postcode,
              country: extractedData.customerInfo.address?.country || prev.customerInfo.address.country
            }
          }
        };
        console.log('Customer info updated:', updated.customerInfo);
        return updated;
      });
    }

    // Auto-fill products - THE MOST IMPORTANT PART
    if (extractedData.products && extractedData.products.length > 0) {
      console.log('✅ Filling products:', extractedData.products);
      
      const extractedProducts = extractedData.products.map((product, index) => {
        const mappedProduct = {
          id: Date.now() + index,
          itemCode: product.itemCode || '',
          productName: product.productName || '',
          description: product.description || '',
          category: product.category || 'Bars & Rods',
          material: product.material || 'AS/NZS 4671:2019',
          dimensions: {
            length: product.dimensions?.length ? String(product.dimensions.length) : '',
            width: product.dimensions?.width ? String(product.dimensions.width) : '',
            height: product.dimensions?.height ? String(product.dimensions.height) : '',
            diameter: product.dimensions?.diameter ? String(product.dimensions.diameter) : '',
            thickness: product.dimensions?.thickness ? String(product.dimensions.thickness) : '',
            unit: product.dimensions?.unit || 'mm'
          },
          weight: product.weight ? String(product.weight) : '',
          finish: product.finish || 'Raw/Mill Finish',
          specifications: [],
          tags: [],
          isACRSCertified: product.productName?.includes('ACRS') || false,
          unitPrice: product.unitPrice ? String(product.unitPrice) : '',
          pricePerUnit: product.pricePerUnit || 'each',
          currency: product.currency || 'AUD',
          quantity: product.quantity ? Number(product.quantity) : 1
        };
        console.log(`Product ${index + 1} mapped:`, mappedProduct);
        return mappedProduct;
      });

      console.log('Setting all products:', extractedProducts);
      setProducts(extractedProducts);
      setCurrentProductIndex(0);
    }

    // Auto-fill payment terms if found
    if (extractedData.paymentTerms) {
      setOrderForm(prev => ({
        ...prev,
        paymentTerms: extractedData.paymentTerms
      }));
    }

    // Auto-fill delivery terms if found
    if (extractedData.deliveryTerms) {
      setOrderForm(prev => ({
        ...prev,
        deliveryTerms: extractedData.deliveryTerms
      }));
    }

    // Show success message
    const successMessage = `✅ Document scanned and form auto-filled successfully!
    
Data extracted and filled:
- PO Number: ${extractedData.orderInfo?.poNumber || 'Not found'}
- Company: ${extractedData.customerInfo?.companyName || 'Not found'}  
- ABN: ${extractedData.customerInfo?.abn || 'Not found'}
- Products: ${extractedData.products?.length || 0} items
- Payment Terms: ${extractedData.paymentTerms || 'Not found'}

Please review the auto-filled data below and make any necessary adjustments.`;
    
    console.log('✅ AUTO-FILL COMPLETED SUCCESSFULLY!');
    alert(successMessage);

    // Scroll to top of form so user can see the filled data
    const formContainer = document.querySelector('.overflow-y-auto');
    if (formContainer) {
      formContainer.scrollTop = 0;
    }

  } catch (error) {
    console.error('❌ Auto-fill error:', error);
    alert('Error auto-filling form: ' + error.message);
  }
};

  // Add new product
  const addNewProduct = () => {
    const newProduct = {
      id: Date.now(),
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
      specifications: [],
      tags: [],
      isACRSCertified: false,
      unitPrice: '',
      pricePerUnit: 'each',
      currency: 'AUD',
      quantity: 1
    };
    
    setProducts(prev => [...prev, newProduct]);
    setCurrentProductIndex(products.length);
  };

  // Remove product
  const removeProduct = (index) => {
    if (products.length > 1) {
      setProducts(prev => prev.filter((_, i) => i !== index));
      if (currentProductIndex >= products.length - 1) {
        setCurrentProductIndex(Math.max(0, products.length - 2));
      }
    }
  };

  // Update product at specific index
  const updateProduct = (index, field, value) => {
    setProducts(prev => prev.map((product, i) => {
      if (i === index) {
        if (field.includes('.')) {
          const fields = field.split('.');
          const updatedProduct = { ...product };
          let current = updatedProduct;
          for (let j = 0; j < fields.length - 1; j++) {
            current = current[fields[j]];
          }
          current[fields[fields.length - 1]] = value;
          return updatedProduct;
        } else {
          return { ...product, [field]: value };
        }
      }
      return product;
    }));
  };

  // Categories and materials
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

  const [emailLookupLoading, setEmailLookupLoading] = useState(false);
  const [debouncedEmail, setDebouncedEmail] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmail(userEmail);
    }, 500);

    return () => clearTimeout(timer);
  }, [userEmail]);

  // Load company data when modal opens or user email changes
  useEffect(() => {
    if (isOpen && debouncedEmail && debouncedEmail.includes('@')) {
      loadCompanyData();
    }
  }, [isOpen, debouncedEmail]);

  // Load user's company data from companies collection
  const loadCompanyData = async () => {
    if (!debouncedEmail) return;
    
    try {
      console.log('=== LOADING COMPANY DATA ===');
      console.log('Searching for email:', debouncedEmail);
      
      // First check if user is in authorizedUsers array
      const companiesQuery = query(
        collection(db, 'companies'),
        where('authorizedUsers', 'array-contains', debouncedEmail)
      );
      
      const companiesSnapshot = await getDocs(companiesQuery);
      console.log('Companies found in authorizedUsers:', companiesSnapshot.size);
      
      if (!companiesSnapshot.empty) {
        const companyDoc = companiesSnapshot.docs[0];
        const company = {
          id: companyDoc.id,
          ...companyDoc.data()
        };
        
        console.log('Company found via authorizedUsers:', company);
        setCompanyData(company);
        
        // Pre-fill form with company data
        setOrderForm(prev => ({
          ...prev,
          customerInfo: {
            ...prev.customerInfo,
            companyName: company.companyName || '',
            contactPerson: company.contactPerson || '',
            email: company.email || '',
            phone: company.phone || '',
            abn: company.abn || '',
            address: company.address || prev.customerInfo.address
          },
          authorizedEmails: company.authorizedUsers || []
        }));

        // Pre-fill signature form with company contact person
        setSignatureForm(prev => ({
          ...prev,
          signerName: company.contactPerson || '',
          signerTitle: 'Authorized Representative'
        }));
      } else {
        console.log('No company found in authorizedUsers, checking superAdmin...');
        
        // Fallback: Check if user is superAdmin
        const ownerQuery = query(
          collection(db, 'companies'),
          where('superAdmin', '==', debouncedEmail)
        );
        
        const ownerSnapshot = await getDocs(ownerQuery);
        console.log('Companies found via superAdmin:', ownerSnapshot.size);
        
        if (!ownerSnapshot.empty) {
          const companyDoc = ownerSnapshot.docs[0];
          const company = {
            id: companyDoc.id,
            ...companyDoc.data()
          };
          
          console.log('Company found via superAdmin:', company);
          setCompanyData(company);
          
          // Pre-fill form with company data
          setOrderForm(prev => ({
            ...prev,
            customerInfo: {
              ...prev.customerInfo,
              companyName: company.companyName || '',
              contactPerson: company.contactPerson || '',
              email: company.email || '',
              phone: company.phone || '',
              abn: company.abn || '',
              address: company.address || prev.customerInfo.address
            },
            authorizedEmails: company.authorizedUsers || []
          }));

          // Pre-fill signature form
          setSignatureForm(prev => ({
            ...prev,
            signerName: company.contactPerson || '',
            signerTitle: 'Authorized Representative'
          }));
        } else {
          console.log('NO COMPANY FOUND FOR USER:', debouncedEmail);
          // Only reset company data if we have a complete email
          if (debouncedEmail.includes('@') && debouncedEmail.includes('.')) {
            setCompanyData(null);
          }
        }
      }
    } catch (error) {
      console.error('Error loading company data:', error);
    }
  };

  // Check if products exist in database
  const checkProductsInDatabase = async () => {
    console.log('=== CHECKING PRODUCTS IN DATABASE ===');
    const missing = [];
    
    for (const product of products) {
      if (product.itemCode && product.itemCode.trim()) {
        try {
          const productsQuery = query(
            collection(db, 'products'),
            where('itemCode', '==', product.itemCode.trim().toUpperCase())
          );
          
          const snapshot = await getDocs(productsQuery);
          
          if (snapshot.empty) {
            console.log('Product not found in database:', product.itemCode);
            missing.push(product);
          } else {
            console.log('Product found in database:', product.itemCode);
          }
        } catch (error) {
          console.error('Error checking product:', product.itemCode, error);
          // If there's an error checking, assume it's missing to be safe
          missing.push(product);
        }
      }
    }
    
    console.log('Missing products:', missing.length);
    setMissingProducts(missing);
    setProductsToAdd(missing); // Initially, all missing products are selected to add
    
    return missing;
  };

  // Add missing products to database
  const addMissingProductsToDatabase = async () => {
    if (productsToAdd.length === 0) return;
    
    setAddingProducts(true);
    try {
      console.log('Adding products to database:', productsToAdd.length);
      
      for (const product of productsToAdd) {
        const productData = {
          itemCode: product.itemCode.trim().toUpperCase(),
          productName: product.productName.trim(),
          description: product.description.trim(),
          category: product.category,
          dimensions: {
            length: product.dimensions.length ? parseFloat(product.dimensions.length) : null,
            width: product.dimensions.width ? parseFloat(product.dimensions.width) : null,
            height: product.dimensions.height ? parseFloat(product.dimensions.height) : null,
            diameter: product.dimensions.diameter ? parseFloat(product.dimensions.diameter) : null,
            thickness: product.dimensions.thickness ? parseFloat(product.dimensions.thickness) : null,
            unit: product.dimensions.unit
          },
          material: product.material,
          finish: product.finish,
          weight: product.weight ? parseFloat(product.weight) : null,
          pricing: {
            unitPrice: parseFloat(product.unitPrice),
            currency: product.currency,
            pricePerUnit: product.pricePerUnit
          },
          stock: {
            quantity: 0, // Start with 0 stock for new products
            minStock: 0,
            location: ''
          },
          specifications: product.specifications || [],
          tags: product.tags || [],
          isActive: true,
          isACRSCertified: product.isACRSCertified || false,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await addDoc(collection(db, 'products'), productData);
        console.log('Added product to database:', product.itemCode);
      }
      
      console.log('All selected products added to database');
    } catch (error) {
      console.error('Error adding products to database:', error);
      throw error;
    } finally {
      setAddingProducts(false);
    }
  };

  // Reset form to initial state
  const resetForm = () => {
    setStep(1);
    setPurchaseOrderFile(null);
    setSalesContractFile(null);
    setProformaInvoiceFile(null);
    setUploadProgress({ po: 0, contract: 0, proforma: 0 });
    setMissingProducts([]);
    setProductsToAdd([]);

    // Reset document scanning states
    setDocumentScanFile(null);
    setIsScanning(false);
    setScanningProgress(0);
    setScanResults(null);
    setShowScanResults(false);
    setExtractedData(null);

    setUserEmail('');
    setCompanyData(null);
    setNewAuthorizedEmail('');
    
    setSignatureForm({
      signerName: '',
      signerTitle: '',
      signatureDate: new Date().toISOString().split('T')[0]
    });
    
    // Reset products to single product
    setProducts([{
      id: Date.now(),
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
      specifications: [],
      tags: [],
      isACRSCertified: false,
      unitPrice: '',
      pricePerUnit: 'each',
      currency: 'AUD',
      quantity: 1
    }]);
    
    setCurrentProductIndex(0);

    setOrderForm({
      poNumber: '',
      customerInfo: {
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        abn: '',
        address: {
          street: '',
          city: '',
          state: 'VIC',
          postcode: '',
          country: 'Australia'
        }
      },
      deliveryAddress: {
        street: '',
        city: '',
        state: 'VIC',
        postcode: '',
        country: 'Australia'
      },
      sameAsCustomer: true,
      orderDate: new Date().toISOString().split('T')[0],
      estimatedDelivery: '',
      reference: '',
      notes: '',
      paymentTerms: '30 Days from delivery to yard',
      deliveryTerms: 'Delivery Duty paid - unloading by purchaser',
      documentation: 'Commercial Invoice Certificate of Origin Mill Test Certificates ACRS Certification',
      packing: "Mill's Standard for Export",
      invoicingBasis: 'Theoretical Weight',
      quantityTolerance: '+/- 10%',
      authorizedEmails: []
    });

    setNewSpec({ key: '', value: '' });
    setNewTag('');
  };

  // Open modal
  const openModal = () => {
    setIsOpen(true);
  };

  // Close modal
  const closeModal = () => {
    if (!loading && !addingProducts && !isScanning) {
      setIsOpen(false);
      setTimeout(resetForm, 300);
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    
    products.forEach(product => {
      if (product.unitPrice && product.quantity) {
        const unitPrice = parseFloat(product.unitPrice) || 0;
        const quantity = parseInt(product.quantity) || 0;
        subtotal += unitPrice * quantity;
      }
    });
    
    const gst = subtotal * 0.1; // 10% GST
    const total = subtotal + gst;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      gst: parseFloat(gst.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  };

  // Generate sales contract number
  const generateSalesContractNumber = () => {
    return `SC${Math.floor(10000 + Math.random() * 90000)}`;
  };

  // Handle file selection
  const handleFileSelect = (file, type) => {
    if (type === 'po') {
      setPurchaseOrderFile(file);
    } else if (type === 'contract') {
      setSalesContractFile(file);
    } else if (type === 'proforma') {
      setProformaInvoiceFile(file);
    } else if (type === 'scan') {
      setDocumentScanFile(file);
    }
  };

  // Upload file to Firebase Storage
  const uploadFile = async (file, folder, fileName) => {
    try {
      const storageRef = ref(storage, `${folder}/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return {
        url: downloadURL,
        path: `${folder}/${fileName}`
      };
    } catch (error) {
      console.error(`Error uploading file to ${folder}:`, error);
      throw error;
    }
  };

  // Add specification
  const addSpecification = (productIndex) => {
    if (!newSpec.key.trim() || !newSpec.value.trim()) {
      alert('Please enter both specification key and value');
      return;
    }

    setProducts(prev => prev.map((product, i) => {
      if (i === productIndex) {
        return {
          ...product,
          specifications: [...product.specifications, { ...newSpec }]
        };
      }
      return product;
    }));
    setNewSpec({ key: '', value: '' });
  };

  // Remove specification
  const removeSpecification = (productIndex, specIndex) => {
    setProducts(prev => prev.map((product, i) => {
      if (i === productIndex) {
        return {
          ...product,
          specifications: product.specifications.filter((_, j) => j !== specIndex)
        };
      }
      return product;
    }));
  };

  // Add tag
  const addTag = (productIndex) => {
    if (!newTag.trim()) {
      alert('Please enter a tag');
      return;
    }

    const currentProduct = products[productIndex];
    if (currentProduct.tags.includes(newTag.trim())) {
      alert('Tag already exists');
      return;
    }

    setProducts(prev => prev.map((product, i) => {
      if (i === productIndex) {
        return {
          ...product,
          tags: [...product.tags, newTag.trim()]
        };
      }
      return product;
    }));
    setNewTag('');
  };

  // Remove tag
  const removeTag = (productIndex, tagIndex) => {
    setProducts(prev => prev.map((product, i) => {
      if (i === productIndex) {
        return {
          ...product,
          tags: product.tags.filter((_, j) => j !== tagIndex)
        };
      }
      return product;
    }));
  };

  // Add authorized email
  const addAuthorizedEmail = () => {
    if (!newAuthorizedEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAuthorizedEmail.trim())) {
      alert('Please enter a valid email address');
      return;
    }

    if (orderForm.authorizedEmails.includes(newAuthorizedEmail.trim())) {
      alert('This email is already authorized');
      return;
    }

    setOrderForm(prev => ({
      ...prev,
      authorizedEmails: [...prev.authorizedEmails, newAuthorizedEmail.trim()]
    }));
    setNewAuthorizedEmail('');
  };

  // Remove authorized email
  const removeAuthorizedEmail = (index) => {
    setOrderForm(prev => ({
      ...prev,
      authorizedEmails: prev.authorizedEmails.filter((_, i) => i !== index)
    }));
  };

  // Add all company emails
  const addAllCompanyEmails = () => {
    if (!companyData || !companyData.authorizedUsers) return;

    const newEmails = companyData.authorizedUsers.filter(
      email => !orderForm.authorizedEmails.includes(email)
    );

    if (newEmails.length === 0) {
      alert('All company emails are already added');
      return;
    }

    setOrderForm(prev => ({
      ...prev,
      authorizedEmails: [...prev.authorizedEmails, ...newEmails]
    }));
  };

  // Add single company email
  const addSingleCompanyEmail = (email) => {
    if (orderForm.authorizedEmails.includes(email)) {
      return;
    }

    setOrderForm(prev => ({
      ...prev,
      authorizedEmails: [...prev.authorizedEmails, email]
    }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Check if all products have required fields
    const hasValidProducts = products.every(product => 
      product.itemCode && product.productName && product.unitPrice && product.quantity
    );

    if (!userEmail || !hasValidProducts || !orderForm.customerInfo.companyName || !orderForm.poNumber) {
      alert('Please fill in all required fields including PO Number for all products and your email');
      return;
    }

    // Validate signature fields if sales contract is uploaded
    if (salesContractFile && (!signatureForm.signerName || !signatureForm.signatureDate)) {
      alert('Please fill in signature details (Signer Name and Signature Date) when uploading a sales contract');
      return;
    }

    setLoading(true);
    try {
      console.log('=== DEBUG COMPANY DATA ===');
      console.log('userEmail:', userEmail);
      console.log('companyData:', companyData);
      
      const totals = calculateTotals();
      const poNumber = orderForm.poNumber;
      const salesContractNumber = generateSalesContractNumber();
      const currentDate = new Date();
      const signatureDateTime = new Date(signatureForm.signatureDate);
      
      // Prepare delivery address
      const deliveryAddress = orderForm.sameAsCustomer 
        ? orderForm.customerInfo.address 
        : orderForm.deliveryAddress;
      
      const fullDeliveryAddress = `${deliveryAddress.street}, ${deliveryAddress.city} ${deliveryAddress.state} ${deliveryAddress.postcode}`;

      setStep(2); // Move to document upload step

      // Step 1: Upload files if provided
      let pdfUpload = null;
      let contractUpload = null;
      let proformaUpload = null;

      if (purchaseOrderFile) {
        console.log('Uploading purchase order...');
        setUploadProgress(prev => ({ ...prev, po: 25 }));
        
        const poFileName = `${poNumber}_${new Date().toISOString().replace(/[:.]/g, '-')}.${purchaseOrderFile.name.split('.').pop()}`;
        pdfUpload = await uploadFile(purchaseOrderFile, 'purchase-orders', poFileName);
        
        setUploadProgress(prev => ({ ...prev, po: 100 }));
      }

      if (salesContractFile) {
        console.log('Uploading signed sales contract...');
        setUploadProgress(prev => ({ ...prev, contract: 25 }));
        
        const contractFileName = `${poNumber}_signed_contract_${new Date().toISOString().replace(/[:.]/g, '-')}.${salesContractFile.name.split('.').pop()}`;
        contractUpload = await uploadFile(salesContractFile, 'signed-contracts', contractFileName);
        
        setUploadProgress(prev => ({ ...prev, contract: 100 }));
      }

      if (proformaInvoiceFile) {
        console.log('Uploading proforma invoice...');
        setUploadProgress(prev => ({ ...prev, proforma: 25 }));
        
        const proformaFileName = `${poNumber}_proforma_invoice_${new Date().toISOString().replace(/[:.]/g, '-')}.${proformaInvoiceFile.name.split('.').pop()}`;
        proformaUpload = await uploadFile(proformaInvoiceFile, 'proforma-invoices', proformaFileName);
        
        setUploadProgress(prev => ({ ...prev, proforma: 100 }));
      }

      // Step 2: Check if products exist in database
      setStep(3); // Move to product check step
      const missingProducts = await checkProductsInDatabase();

      // If there are missing products, show the product check step
      if (missingProducts.length > 0) {
        setLoading(false); // Stop loading to allow user interaction
        return; // Don't proceed to order creation yet
      }

      // If no missing products, proceed directly to order creation
      await createOrder(pdfUpload, contractUpload, proformaUpload, totals, poNumber, salesContractNumber, currentDate, signatureDateTime, deliveryAddress, fullDeliveryAddress);

    } catch (error) {
      console.error('Error creating order:', error);
      alert('Error creating order. Please try again.');
      setLoading(false);
    }
  };

  // Create the order (separated from handleSubmit for reuse)
  const createOrder = async (pdfUpload, contractUpload, proformaUpload, totals, poNumber, salesContractNumber, currentDate, signatureDateTime, deliveryAddress, fullDeliveryAddress) => {
    try {
      // Prepare complete order data with uploaded file URLs
      const orderData = {
        // Basic order info
        poNumber,
        salesContract: salesContractNumber,
        userId: '',
        userEmail: userEmail,
        companyId: companyData?.id || null,
        status: 'pending',
        
        // Dates
        orderDate: new Date(orderForm.orderDate),
        estimatedDelivery: orderForm.estimatedDelivery ? new Date(orderForm.estimatedDelivery) : null,
        createdAt: currentDate,
        updatedAt: currentDate,
        
        // Company data (from companies collection)
        companyData: companyData ? {
          companyName: companyData.companyName,
          abn: companyData.abn,
          contactPerson: companyData.contactPerson,
          email: companyData.email,
          phone: companyData.phone,
          address: companyData.address,
          logoUrl: companyData.logoUrl,
          website: companyData.website,
          status: companyData.status,
          isVerified: companyData.isVerified
        } : null,
        
        // Customer info
        customerInfo: {
          ...orderForm.customerInfo,
          address: {
            ...orderForm.customerInfo.address,
            fullAddress: `${orderForm.customerInfo.address.street}, ${orderForm.customerInfo.address.city} ${orderForm.customerInfo.address.state} ${orderForm.customerInfo.address.postcode}`
          }
        },
        
        customerCompanyData: {
          abn: orderForm.customerInfo.abn
        },
        
        // Delivery details
        deliveryAddress: {
          ...deliveryAddress,
          fullAddress: fullDeliveryAddress
        },
        
        // Items array with all products
        items: products.map(product => ({
          itemCode: product.itemCode.trim().toUpperCase(),
          productName: product.productName.trim(),
          barType: product.productName.trim(),
          description: product.description.trim(),
          category: product.category,
          material: product.material,
          length: product.dimensions.length ? `${product.dimensions.length}${product.dimensions.unit}` : '',
          dimensions: {
            length: product.dimensions.length ? parseFloat(product.dimensions.length) : null,
            width: product.dimensions.width ? parseFloat(product.dimensions.width) : null,
            height: product.dimensions.height ? parseFloat(product.dimensions.height) : null,
            diameter: product.dimensions.diameter ? parseFloat(product.dimensions.diameter) : null,
            thickness: product.dimensions.thickness ? parseFloat(product.dimensions.thickness) : null,
            unit: product.dimensions.unit
          },
          weight: product.weight ? parseFloat(product.weight) : null,
          finish: product.finish,
          specifications: product.specifications,
          tags: product.tags,
          isACRSCertified: product.isACRSCertified,
         quantity: parseInt(product.quantity),
         pricePerTonne: 0,
         pricePerUnit: product.pricePerUnit,
         unitPrice: parseFloat(product.unitPrice),
         currency: product.currency,
         totalWeight: parseInt(product.quantity),
         imageUrl: null
       })),
       
       // Financial details
       subtotal: totals.subtotal,
       gst: totals.gst,
       totalAmount: totals.total,
       
       // Terms and conditions
       paymentTerms: orderForm.paymentTerms,
       deliveryTerms: orderForm.deliveryTerms,
       documentation: orderForm.documentation,
       packing: orderForm.packing,
       invoicingBasis: orderForm.invoicingBasis,
       quantityTolerance: orderForm.quantityTolerance,
       
       // Additional info
       reference: orderForm.reference,
       notes: orderForm.notes,
       authorizedEmails: orderForm.authorizedEmails,
       
       // Contract status - set based on sales contract upload
       contractStatus: salesContractFile ? 'signed' : 'unsigned',
       
       // Document URLs - include uploaded file data
       pdfUrl: pdfUpload?.url || null,
       pdfPath: pdfUpload?.path || null,
       pdfUploadedAt: pdfUpload ? currentDate : null,
       contractUrl: contractUpload?.url || null,
       contractPath: contractUpload?.path || null,
       contractUploadedAt: contractUpload ? currentDate : null,
       originalContractUrl: contractUpload?.url || null,
       signedContractUrl: contractUpload?.url || null,
       signedContractPath: contractUpload?.path || null,
       signedAt: contractUpload ? currentDate : null,
       
       proformaInvoiceUrl: proformaUpload?.url || null,
       proformaInvoicePath: proformaUpload?.path || null,
       proformaInvoiceUploadedAt: proformaUpload ? currentDate : null,
       
       // Document scanning metadata
       documentScanResults: scanResults ? {
         extractedText: scanResults,
         extractedData: extractedData,
         scanDate: new Date(),
         scanFileName: documentScanFile?.name || null
       } : null,
       
       // Signature data - populate if sales contract uploaded
       signature: salesContractFile ? {
         contractSigned: true,
         signatureDate: signatureDateTime,
         signedAt: currentDate,
         signerName: signatureForm.signerName,
         signerTitle: signatureForm.signerTitle,
         imageUrl: null,
         imagePath: null
       } : {
         contractSigned: false,
         signatureDate: null,
         signedAt: null,
         signerName: '',
         signerTitle: '',
         imageUrl: null,
         imagePath: null
       }
     };

     // Create order in Firestore with all data including file URLs
     console.log('Creating order in Firestore with complete data...');
     const docRef = await addDoc(collection(db, 'orders'), orderData);
     const orderId = docRef.id;

     setStep(4); // Move to success step
     
     console.log('Order created successfully:', orderId);
     
     // Auto-close after success
     setTimeout(() => {
       closeModal();
     }, 2000);
     
   } catch (error) {
     console.error('Error creating order:', error);
     alert('Error creating order. Please try again.');
   } finally {
     setLoading(false);
   }
 };

 // Handle product check completion
 const handleProductCheckComplete = async () => {
   setLoading(true);
   try {
     // Add selected products to database
     if (productsToAdd.length > 0) {
       await addMissingProductsToDatabase();
     }

     // Get the stored upload data and proceed with order creation
     const totals = calculateTotals();
     const poNumber = orderForm.poNumber;
     const salesContractNumber = generateSalesContractNumber();
     const currentDate = new Date();
     const signatureDateTime = new Date(signatureForm.signatureDate);
     
     const deliveryAddress = orderForm.sameAsCustomer 
       ? orderForm.customerInfo.address 
       : orderForm.deliveryAddress;
     
     const fullDeliveryAddress = `${deliveryAddress.street}, ${deliveryAddress.city} ${deliveryAddress.state} ${deliveryAddress.postcode}`;

     // Create uploads objects (these would be stored from previous step in real implementation)
     let pdfUpload = null;
     let contractUpload = null;
     let proformaUpload = null;

     if (purchaseOrderFile) {
       const poFileName = `${poNumber}_${new Date().toISOString().replace(/[:.]/g, '-')}.${purchaseOrderFile.name.split('.').pop()}`;
       pdfUpload = await uploadFile(purchaseOrderFile, 'purchase-orders', poFileName);
     }

     if (salesContractFile) {
       const contractFileName = `${poNumber}_signed_contract_${new Date().toISOString().replace(/[:.]/g, '-')}.${salesContractFile.name.split('.').pop()}`;
       contractUpload = await uploadFile(salesContractFile, 'signed-contracts', contractFileName);
     }

     if (proformaInvoiceFile) {
       const proformaFileName = `${poNumber}_proforma_invoice_${new Date().toISOString().replace(/[:.]/g, '-')}.${proformaInvoiceFile.name.split('.').pop()}`;
       proformaUpload = await uploadFile(proformaInvoiceFile, 'proforma-invoices', proformaFileName);
     }

     await createOrder(pdfUpload, contractUpload, proformaUpload, totals, poNumber, salesContractNumber, currentDate, signatureDateTime, deliveryAddress, fullDeliveryAddress);

   } catch (error) {
     console.error('Error in product check completion:', error);
     alert('Error completing order. Please try again.');
     setLoading(false);
   }
 };

 // Toggle product to add selection
 const toggleProductToAdd = (productId) => {
   setProductsToAdd(prev => {
     const exists = prev.find(p => p.id === productId);
     if (exists) {
       return prev.filter(p => p.id !== productId);
     } else {
       const productToAdd = missingProducts.find(p => p.id === productId);
       return [...prev, productToAdd];
     }
   });
 };

 // Handle form input changes
 const handleInputChange = (form, path, value, productIndex = null) => {
   if (form === 'product' && productIndex !== null) {
     updateProduct(productIndex, path, value);
   } else if (form === 'signature') {
     setSignatureForm(prev => {
       if (path.includes('.')) {
         const fields = path.split('.');
         const newData = { ...prev };
         let current = newData;
         for (let i = 0; i < fields.length - 1; i++) {
           current = current[fields[i]];
         }
         current[fields[fields.length - 1]] = value;
         return newData;
       } else {
         return { ...prev, [path]: value };
       }
     });
   } else {
     setOrderForm(prev => {
       if (path.includes('.')) {
         const fields = path.split('.');
         const newData = { ...prev };
         let current = newData;
         for (let i = 0; i < fields.length - 1; i++) {
           current = current[fields[i]];
         }
         current[fields[fields.length - 1]] = value;
         return newData;
       } else {
         return { ...prev, [path]: value };
       }
     });
   }
 };

 // Copy customer address to delivery address
 const copyCustomerAddress = () => {
   setOrderForm(prev => ({
     ...prev,
     deliveryAddress: { ...prev.customerInfo.address },
     sameAsCustomer: true
   }));
 };

 // File input component
 const FileUpload = ({ label, file, onFileSelect, type, required = false, showSignatureFields = false }) => (
   <div className="space-y-2">
     <label className="block text-sm font-medium text-gray-700">
       {label} {required && '*'}
     </label>
     <div className="relative">
       <input
         type="file"
         accept=".pdf,.doc,.docx,.html,.jpg,.jpeg,.png"
         onChange={(e) => onFileSelect(e.target.files[0], type)}
         className="hidden"
         id={`file-${type}`}
       />
       <label
         htmlFor={`file-${type}`}
         className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-400 transition-colors"
       >
         <Upload className="w-5 h-5 text-gray-400" />
         <span className="text-gray-600">
           {file ? file.name : 'Choose file...'}
         </span>
       </label>
     </div>
     {file && (
       <div className="flex items-center gap-2 text-sm text-green-600">
         <File className="w-4 h-4" />
         <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
       </div>
     )}
     
     {/* Signature fields for sales contract */}
     {showSignatureFields && file && (
       <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
         <h5 className="font-medium text-yellow-800 mb-3 flex items-center gap-2">
           <PenTool className="w-4 h-4" />
           Contract Signature Details
         </h5>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">
               Signer Name *
             </label>
             <input
               type="text"
               value={signatureForm.signerName}
               onChange={(e) => handleInputChange('signature', 'signerName', e.target.value)}
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
               placeholder="Full name of person signing"
               required
             />
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">
               Signer Title
             </label>
             <input
               type="text"
               value={signatureForm.signerTitle}
               onChange={(e) => handleInputChange('signature', 'signerTitle', e.target.value)}
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
               placeholder="e.g. Authorized Representative"
             />
           </div>
           <div className="md:col-span-2">
             <label className="block text-sm font-medium text-gray-700 mb-1">
               Signature Date *
             </label>
             <input
               type="date"
               value={signatureForm.signatureDate}
               onChange={(e) => handleInputChange('signature', 'signatureDate', e.target.value)}
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
               required
             />
           </div>
         </div>
         <p className="text-xs text-yellow-700 mt-2">
           This information will be recorded as the contract signature details
         </p>
       </div>
     )}
   </div>
 );

 // Document scanner component
 const DocumentScanner = () => (
   <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
     <div className="flex items-center gap-3 mb-4">
       <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
         <Brain className="w-6 h-6 text-white" />
       </div>
       <div>
         <h3 className="text-lg font-semibold text-gray-800">AI Document Scanner</h3>
         <p className="text-sm text-gray-600">
           Upload a document to extract data and auto-fill the form using AI
         </p>
       </div>
     </div>

     {/* Upload Section */}
     <div className="space-y-4">
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Document for Scanning
        </label>
        <div className="relative">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => handleFileSelect(e.target.files[0], 'scan')}
            className="hidden"
            id="scan-file"
            disabled={isScanning}
          />
          <label
            htmlFor="scan-file"
            className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              isScanning 
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                : 'border-purple-300 hover:border-purple-400 bg-white'
            }`}
          >
            <Camera className="w-5 h-5 text-purple-500" />
            <span className="text-gray-700">
              {documentScanFile ? documentScanFile.name : 'Choose PDF or Word document...'}
            </span>
          </label>
        </div>
        {documentScanFile && !isScanning && (
          <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
            <FileImage className="w-4 h-4" />
            <span>{documentScanFile.name} ({Math.round(documentScanFile.size / 1024)} KB)</span>
          </div>
        )}
      </div>

       {/* Scan Button */}
       <button
         onClick={() => handleDocumentScan(documentScanFile)}
         disabled={!documentScanFile || isScanning}
         className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
       >
         {isScanning ? (
           <>
             <Loader className="w-5 h-5 animate-spin" />
             Scanning Document...
           </>
         ) : (
           <>
             <ScanLine className="w-5 h-5" />
             Scan & Extract Data
           </>
         )}
       </button>

       {/* Progress Bar */}
       {isScanning && (
         <div className="space-y-2">
           <div className="flex justify-between text-sm text-gray-600">
             <span>Processing document...</span>
             <span>{scanningProgress}%</span>
           </div>
           <div className="w-full bg-gray-200 rounded-full h-2">
             <div 
               className="bg-purple-600 h-2 rounded-full transition-all duration-300"
               style={{ width: `${scanningProgress}%` }}
             ></div>
           </div>
         </div>
       )}

       {/* Processing Steps */}
       {isScanning && (
         <div className="space-y-2 text-sm text-gray-600">
           <div className={`flex items-center gap-2 ${scanningProgress >= 25 ? 'text-green-600' : ''}`}>
             <div className={`w-2 h-2 rounded-full ${scanningProgress >= 25 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
             Converting document to image...
           </div>
           <div className={`flex items-center gap-2 ${scanningProgress >= 50 ? 'text-green-600' : ''}`}>
             <div className={`w-2 h-2 rounded-full ${scanningProgress >= 50 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
             Extracting text with AI vision...
           </div>
           <div className={`flex items-center gap-2 ${scanningProgress >= 75 ? 'text-green-600' : ''}`}>
             <div className={`w-2 h-2 rounded-full ${scanningProgress >= 75 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
             Parsing structured data...
           </div>
           <div className={`flex items-center gap-2 ${scanningProgress >= 100 ? 'text-green-600' : ''}`}>
             <div className={`w-2 h-2 rounded-full ${scanningProgress >= 100 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
             Finalizing extraction...
           </div>
         </div>
       )}

       {/* Instructions */}
       <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
         <div className="flex items-start gap-2">
           <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
           <div className="text-sm text-blue-800">
             <p className="font-medium mb-1">How it works:</p>
             <ul className="space-y-1 text-blue-700">
               <li>• Upload purchase orders, invoices, or quotes (PDF, DOC, Images)</li>
               <li>• AI extracts company info, products, prices, and addresses</li>
               <li>• Review extracted data before auto-filling the form</li>
               <li>• Requires OpenAI API key configuration</li>
             </ul>
           </div>
           </div>
      </div>
    </div>
  </div>
);

// Scan Results Modal
const ScanResultsModal = () => {
  console.log('🎭 ScanResultsModal render check:', { showScanResults, extractedData: !!extractedData });
  
  if (!showScanResults) {
    console.log('❌ Modal not showing because showScanResults is false');
    return null;
  }
  
  if (!extractedData) {
    console.log('❌ Modal not showing because extractedData is null');
    return null;
  }
  
  console.log('✅ Modal SHOULD be visible now');
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Scan Results - FOUND DATA!</h3>
                <p className="text-sm text-gray-600">
                  {extractedData?.products?.length || 0} products found
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                console.log('❌ Closing scan results modal');
                setShowScanResults(false);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Quick Summary */}
        <div className="p-6 bg-green-50">
          <h4 className="font-semibold text-green-800 mb-2">Quick Summary:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>PO: {extractedData?.orderInfo?.poNumber || 'Not found'}</div>
            <div>Company: {extractedData?.customerInfo?.companyName || 'Not found'}</div>
            <div>Products: {extractedData?.products?.length || 0}</div>
            <div>Total Value: ${extractedData?.products?.reduce((sum, p) => sum + (p.unitPrice * p.quantity), 0).toFixed(2) || '0.00'}</div>
          </div>
        </div>

        {/* Footer with prominent button */}
        <div className="p-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => setShowScanResults(false)}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              console.log('🚀 AUTO-FILL BUTTON CLICKED FROM MODAL!');
              autoFillFromExtractedData();
            }}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-lg font-semibold"
          >
            <Wand2 className="w-5 h-5" />
            AUTO-FILL FORM NOW!
          </button>
        </div>
      </div>
    </div>
  );
};


return (
  <>
    {/* Trigger Button */}
    <button
      onClick={openModal}
      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-lg"
    >
      <Plus className="w-5 h-5" />
      Add New Order
    </button>

    {/* Scan Results Modal */}
    <ScanResultsModal />

    {/* Main Modal */}
    {isOpen && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl max-w-6xl w-full my-8 max-h-[95vh] overflow-hidden flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Create New Order</h2>
                  <p className="text-sm text-gray-600">
                    {step === 1 ? 'Order & Product Details' : 
                     step === 2 ? 'Uploading Documents...' : 
                     step === 3 ? 'Product Database Check' : 
                     'Complete'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={loading || addingProducts || isScanning}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Progress indicator */}
            <div className="mt-4 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                1
              </div>
              <div className={`h-1 w-12 ${step >= 2 ? 'bg-teal-600' : 'bg-gray-200'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                2
              </div>
              <div className={`h-1 w-12 ${step >= 3 ? 'bg-teal-600' : 'bg-gray-200'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 3 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                3
              </div>
              <div className={`h-1 w-12 ${step >= 4 ? 'bg-teal-600' : 'bg-gray-200'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 4 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                4
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {step === 1 && (
              <div className="space-y-8">
                {/* Document Scanner Section */}
                <DocumentScanner />

                {/* User Email Input */}
                <div className="bg-yellow-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                    <Mail className="w-5 h-5 text-yellow-600" />
                    User Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Email Address *
                      </label>
                      <input
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        placeholder="e.g. adam@psa.com.au"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This email will be used to find your company data and create the order
                      </p>
                    </div>

                    {companyData && (
                      <div className="bg-green-100 rounded-lg p-4">
                        <h4 className="font-medium text-green-800 mb-2">Company Found!</h4>
                        <p className="text-sm text-green-700">
                          <strong>{companyData.companyName}</strong><br/>
                          ABN: {companyData.abn}<br/>
                          Contact: {companyData.contactPerson}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product Information - Multiple Products */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Package className="w-5 h-5 text-blue-600" />
                      Product Information ({products.length} {products.length === 1 ? 'item' : 'items'})
                    </h3>
                    <button
                      type="button"
                      onClick={addNewProduct}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Product
                    </button>
                  </div>

                  {/* Product Tabs */}
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2 mb-4 border-b border-blue-200 pb-4">
                      {products.map((product, index) => {
                        const isActive = currentProductIndex === index;
                        
                        return (
                          <div
                            key={product.id}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors relative ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setCurrentProductIndex(index)}
                              className="flex items-center gap-2 flex-1"
                            >
                              <Package className="w-4 h-4" />
                              <span className="font-medium">Item {index + 1}</span>
                              {product.productName && (
                                <span className="text-xs opacity-75 max-w-24 truncate">
                                  {product.productName}
                                </span>
                              )}
                            </button>
                            {products.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeProduct(index)}
                                className="ml-2 p-1 hover:bg-red-100 rounded-full text-red-600 transition-colors"
                                title="Remove this product"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Product Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                      {products.map((product, index) => (
                        <div
                          key={product.id}
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                            currentProductIndex === index
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : 'border-gray-200 bg-white hover:border-blue-300'
                          }`}
                          onClick={() => setCurrentProductIndex(index)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">Item {index + 1}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              product.itemCode && product.productName && product.unitPrice && product.quantity
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {product.itemCode && product.productName && product.unitPrice && product.quantity
                                ? 'Complete'
                                : 'Incomplete'
                              }
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div><span className="font-medium">Code:</span> {product.itemCode || 'Not set'}</div>
                            <div><span className="font-medium">Name:</span> {product.productName || 'Not set'}</div>
                            <div><span className="font-medium">Qty:</span> {product.quantity || 0} {product.pricePerUnit}</div>
                            <div><span className="font-medium">Price:</span> ${product.unitPrice || '0.00'} {product.currency}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                 {/* Current Product Form */}
                  {products[currentProductIndex] && (
                    <div className="border border-blue-200 rounded-lg p-6 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-800">
                          Editing Item {currentProductIndex + 1}
                        </h4>
                        {products.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProduct(currentProductIndex)}
                            className="flex items-center gap-2 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Remove Item
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Item Code *
                          </label>
                          <input
                            type="text"
                            value={products[currentProductIndex].itemCode}
                            onChange={(e) => handleInputChange('product', 'itemCode', e.target.value, currentProductIndex)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. FBSB321330"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            value={products[currentProductIndex].productName}
                            onChange={(e) => handleInputChange('product', 'productName', e.target.value, currentProductIndex)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. Forge Bar Starter Bar 32mm x 1330mm"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category *
                          </label>
                          <select
                            value={products[currentProductIndex].category}
                            onChange={(e) => handleInputChange('product', 'category', e.target.value, currentProductIndex)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          >
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Material *
                          </label>
                          <select
                            value={products[currentProductIndex].material}
                            onChange={(e) => handleInputChange('product', 'material', e.target.value, currentProductIndex)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          >
                            {materials.map(mat => (
                              <option key={mat} value={mat}>{mat}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description *
                          </label>
                          <textarea
                            value={products[currentProductIndex].description}
                            onChange={(e) => handleInputChange('product', 'description', e.target.value, currentProductIndex)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. 32mm x 1330mm assembled with FBENDCAP32"
                            required
                          />
                        </div>
                      </div>

                      {/* Dimensions */}
                      <div className="mb-6">
                        <h5 className="font-medium text-gray-800 mb-3">Dimensions</h5>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Length
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={products[currentProductIndex].dimensions.length}
                              onChange={(e) => handleInputChange('product', 'dimensions.length', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="1330"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Width
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={products[currentProductIndex].dimensions.width}
                              onChange={(e) => handleInputChange('product', 'dimensions.width', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="50"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Height
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={products[currentProductIndex].dimensions.height}
                              onChange={(e) => handleInputChange('product', 'dimensions.height', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="25"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Diameter
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={products[currentProductIndex].dimensions.diameter}
                              onChange={(e) => handleInputChange('product', 'dimensions.diameter', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="32"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Thickness
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={products[currentProductIndex].dimensions.thickness}
                              onChange={(e) => handleInputChange('product', 'dimensions.thickness', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="5"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Unit
                            </label>
                            <select
                              value={products[currentProductIndex].dimensions.unit}
                              onChange={(e) => handleInputChange('product', 'dimensions.unit', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-transparent"
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

                      {/* Weight, Finish, ACRS */}
                      <div className="mb-6">
                        <h5 className="font-medium text-gray-800 mb-3">Product Details</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Weight (kg)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={products[currentProductIndex].weight}
                              onChange={(e) => handleInputChange('product', 'weight', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="2.5"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Finish
                            </label>
                            <select
                              value={products[currentProductIndex].finish}
                              onChange={(e) => handleInputChange('product', 'finish', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              {finishes.map(finish => (
                                <option key={finish} value={finish}>{finish}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              ACRS Certified
                            </label>
                            <select
                              value={products[currentProductIndex].isACRSCertified}
                              onChange={(e) => handleInputChange('product', 'isACRSCertified', e.target.value === 'true', currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value={false}>No</option>
                              <option value={true}>Yes</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Quantity and Pricing */}
                      <div className="mb-6">
                        <h5 className="font-medium text-gray-800 mb-3">Quantity & Pricing</h5>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Quantity *
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={products[currentProductIndex].quantity}
                              onChange={(e) => handleInputChange('product', 'quantity', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Unit Price *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={products[currentProductIndex].unitPrice}
                              onChange={(e) => handleInputChange('product', 'unitPrice', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="14.92"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Price Per
                            </label>
                            <select
                              value={products[currentProductIndex].pricePerUnit}
                              onChange={(e) => handleInputChange('product', 'pricePerUnit', e.target.value, currentProductIndex)}
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
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Currency
                            </label>
                            <select
                              value={products[currentProductIndex].currency}
                              onChange={(e) => handleInputChange('product', 'currency', e.target.value, currentProductIndex)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="AUD">AUD</option>
                              <option value="USD">USD</option>
                              <option value="MYR">MYR</option>
                            </select>
                          </div>
                        </div>

                        {/* Product Total */}
                        {products[currentProductIndex].unitPrice && products[currentProductIndex].quantity && (
                          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-gray-700">Item Total:</span>
                              <span className="font-bold text-blue-800">
                                ${(parseFloat(products[currentProductIndex].unitPrice || 0) * parseInt(products[currentProductIndex].quantity || 0)).toFixed(2)} {products[currentProductIndex].currency}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Specifications for current product */}
                      <div className="mb-6">
                        <h5 className="font-medium text-gray-800 mb-3">Technical Specifications</h5>
                        
                        {/* Add Specification */}
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={newSpec.key}
                              onChange={(e) => setNewSpec({...newSpec, key: e.target.value})}
                              placeholder="Property (e.g. Tensile Strength)"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <input
                              type="text"
                              value={newSpec.value}
                              onChange={(e) => setNewSpec({...newSpec, value: e.target.value})}
                              placeholder="Value (e.g. 400 MPa)"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => addSpecification(currentProductIndex)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Current Specifications */}
                        <div className="space-y-2">
                          {products[currentProductIndex].specifications.map((spec, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                              <div>
                                <span className="font-medium">{spec.key}:</span> {spec.value}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeSpecification(currentProductIndex, index)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tags for current product */}
                      <div>
                        <h5 className="font-medium text-gray-800 mb-3">Product Tags</h5>
                        
                        {/* Add Tag */}
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              placeholder="Enter tag (e.g. heavy-duty, outdoor)"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => addTag(currentProductIndex)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Current Tags */}
                        <div className="flex flex-wrap gap-2">
                          {products[currentProductIndex].tags.map((tag, index) => (
                            <div key={index} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => removeTag(currentProductIndex, index)}
                                className="ml-1 p-0.5 hover:bg-blue-200 rounded-full"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    Customer Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        value={orderForm.customerInfo.companyName}
                        onChange={(e) => handleInputChange('order', 'customerInfo.companyName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Person *
                      </label>
                      <input
                        type="text"
                        value={orderForm.customerInfo.contactPerson}
                        onChange={(e) => handleInputChange('order', 'customerInfo.contactPerson', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={orderForm.customerInfo.email}
                        onChange={(e) => handleInputChange('order', 'customerInfo.email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        value={orderForm.customerInfo.phone}
                        onChange={(e) => handleInputChange('order', 'customerInfo.phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ABN
                      </label>
                      <input
                        type="text"
                        value={orderForm.customerInfo.abn}
                        onChange={(e) => handleInputChange('order', 'customerInfo.abn', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Customer Address */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-800">Customer Address</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Street Address *
                        </label>
                        <input
                          type="text"
                          value={orderForm.customerInfo.address.street}
                          onChange={(e) => handleInputChange('order', 'customerInfo.address.street', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          value={orderForm.customerInfo.address.city}
                          onChange={(e) => handleInputChange('order', 'customerInfo.address.city', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          State *
                        </label>
                        <select
                          value={orderForm.customerInfo.address.state}
                          onChange={(e) => handleInputChange('order', 'customerInfo.address.state', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        >
                          <option value="VIC">VIC</option>
                          <option value="NSW">NSW</option>
                          <option value="QLD">QLD</option>
                          <option value="SA">SA</option>
                          <option value="WA">WA</option>
                          <option value="TAS">TAS</option>
                          <option value="NT">NT</option>
                          <option value="ACT">ACT</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Postcode *
                        </label>
                        <input
                          type="text"
                          value={orderForm.customerInfo.address.postcode}
                          onChange={(e) => handleInputChange('order', 'customerInfo.address.postcode', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Country *
                        </label>
                        <input
                          type="text"
                          value={orderForm.customerInfo.address.country}
                          onChange={(e) => handleInputChange('order', 'customerInfo.address.country', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Delivery Address
                    </h3>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={orderForm.sameAsCustomer}
                        onChange={(e) => {
                          handleInputChange('order', 'sameAsCustomer', e.target.checked);
                          if (e.target.checked) {
                            copyCustomerAddress();
                          }
                        }}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-600">Same as customer address</span>
                    </label>
                  </div>

                  {!orderForm.sameAsCustomer && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Street Address *
                        </label>
                        <input
                          type="text"
                          value={orderForm.deliveryAddress.street}
                          onChange={(e) => handleInputChange('order', 'deliveryAddress.street', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          value={orderForm.deliveryAddress.city}
                          onChange={(e) => handleInputChange('order', 'deliveryAddress.city', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          State *
                        </label>
                        <select
                          value={orderForm.deliveryAddress.state}
                          onChange={(e) => handleInputChange('order', 'deliveryAddress.state', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        >
                          <option value="VIC">VIC</option>
                          <option value="NSW">NSW</option>
                          <option value="QLD">QLD</option>
                          <option value="SA">SA</option>
                          <option value="WA">WA</option>
                          <option value="TAS">TAS</option>
                          <option value="NT">NT</option>
                          <option value="ACT">ACT</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Postcode *
                        </label>
                        <input
                          type="text"
                          value={orderForm.deliveryAddress.postcode}
                          onChange={(e) => handleInputChange('order', 'deliveryAddress.postcode', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Country *
                        </label>
                        <input
                          type="text"
                          value={orderForm.deliveryAddress.country}
                          onChange={(e) => handleInputChange('order', 'deliveryAddress.country', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Order Details
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PO Number *
                    </label>
                    <input
                      type="text"
                      value={orderForm.poNumber}
                      onChange={(e) => handleInputChange('order', 'poNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="e.g. PO-2024-001"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Order Date *
                      </label>
                      <input
                        type="date"
                        value={orderForm.orderDate}
                        onChange={(e) => handleInputChange('order', 'orderDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estimated Delivery
                      </label>
                      <input
                        type="date"
                        value={orderForm.estimatedDelivery}
                        onChange={(e) => handleInputChange('order', 'estimatedDelivery', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reference
                      </label>
                      <input
                        type="text"
                        value={orderForm.reference}
                        onChange={(e) => handleInputChange('order', 'reference', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="Purchase order reference"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={orderForm.notes}
                      onChange={(e) => handleInputChange('order', 'notes', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Additional notes or special requirements"
                    />
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Terms & Conditions
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Terms
                      </label>
                      <select
                        value={orderForm.paymentTerms}
                        onChange={(e) => handleInputChange('order', 'paymentTerms', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      >
                        <option value="30 Days from delivery to yard">30 Days from delivery to yard</option>
                        <option value="14 Days from delivery">14 Days from delivery</option>
                        <option value="Cash on delivery">Cash on delivery</option>
                        <option value="Payment in advance">Payment in advance</option>
                        <option value="Letter of credit">Letter of credit</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delivery Terms
                      </label>
                      <select
                        value={orderForm.deliveryTerms}
                        onChange={(e) => handleInputChange('order', 'deliveryTerms', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      >
                        <option value="Delivery Duty paid - unloading by purchaser">Delivery Duty paid - unloading by purchaser</option>
                        <option value="Ex-works">Ex-works</option>
                        <option value="Free on board">Free on board</option>
                        <option value="Cost and freight">Cost and freight</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Invoicing Basis
                      </label>
                      <select
                        value={orderForm.invoicingBasis}
                        onChange={(e) => handleInputChange('order', 'invoicingBasis', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      >
                        <option value="Theoretical Weight">Theoretical Weight</option>
                        <option value="Actual Weight">Actual Weight</option>
                        <option value="Per Unit">Per Unit</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity Tolerance
                      </label>
                      <select
                        value={orderForm.quantityTolerance}
                        onChange={(e) => handleInputChange('order', 'quantityTolerance', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      >
                        <option value="+/- 10%">+/- 10%</option>
                        <option value="+/- 5%">+/- 5%</option>
                        <option value="+/- 15%">+/- 15%</option>
                        <option value="Exact quantity">Exact quantity</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Document Upload */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Document Upload
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FileUpload
                      label="Purchase Order Document"
                      file={purchaseOrderFile}
                      onFileSelect={handleFileSelect}
                      type="po"
                      showSignatureFields={false}
                    />
                    
                    <FileUpload
                      label="Signed Sales Contract Document"
                      file={salesContractFile}
                      onFileSelect={handleFileSelect}
                      type="contract"
                      showSignatureFields={true}
                    />

                    <FileUpload
                      label="Proforma Invoice Document"
                      file={proformaInvoiceFile}
                      onFileSelect={handleFileSelect}
                      type="proforma"
                      showSignatureFields={false}
                    />
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Document Upload Guidelines:</p>
                        <ul className="space-y-1 text-blue-700">
                          <li>• Purchase orders: PDF, DOC, DOCX, HTML → stored in /purchase-orders/</li>
                          <li>• Sales contracts: Upload SIGNED contracts → stored in /signed-contracts/</li>
                          <li>• Proforma invoices: PDF, DOC, DOCX, HTML → stored in /proforma-invoices/</li>
                          <li>• If uploading sales contract, signature details are required</li>
                          <li>• Contract status will be automatically set to "signed" when contract uploaded</li>
                          <li>• Maximum file size: 10MB per document</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Authorized Emails Section */}
                <div className="bg-indigo-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                    <Mail className="w-5 h-5 text-indigo-600" />
                    Authorized Emails
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Add email addresses of people who should have access to this order. These users will be able to view and manage this order.
                  </p>
                  
                  {/* Add Authorized Email */}
                  <div className="mb-4 p-4 bg-white rounded-lg border border-indigo-200">
                    <div className="flex gap-3">
                      <input
                        type="email"
                        value={newAuthorizedEmail}
                        onChange={(e) => setNewAuthorizedEmail(e.target.value)}
                        placeholder="Enter email address (e.g. user@company.com)"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={addAuthorizedEmail}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Add Email
                      </button>
                    </div>
                  </div>

                  {/* Current Authorized Emails */}
                  <div>
                    <h4 className="font-medium text-gray-800 mb-3">Authorized Users ({orderForm.authorizedEmails.length})</h4>
                    <div className="space-y-2">
                      {orderForm.authorizedEmails.length === 0 ? (
                        <div className="text-center py-6 text-gray-500">
                          <Mail className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p>No authorized emails added yet</p>
                          <p className="text-sm">Add email addresses above to grant order access</p>
                        </div>
                      ) : (
                        orderForm.authorizedEmails.map((email, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-indigo-600" />
                              <span className="font-medium text-gray-800">{email}</span>
                              {email === userEmail && (
                                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAuthorizedEmail(index)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                              title="Remove email"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Auto-populate from company */}
                  {companyData && companyData.authorizedUsers && companyData.authorizedUsers.length > 0 && (
                    <div className="mt-4 p-4 bg-indigo-100 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-indigo-800">Company Team Members</h5>
                        <button
                          type="button"
                          onClick={addAllCompanyEmails}
                          className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition-colors"
                        >
                          Add All
                        </button>
                      </div>
                      <div className="space-y-1">
                        {companyData.authorizedUsers.map((email, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="text-indigo-700">{email}</span>
                            {!orderForm.authorizedEmails.includes(email) && (
                              <button
                                type="button"
                                onClick={() => addSingleCompanyEmail(email)}
                                className="text-indigo-600 hover:text-indigo-800 transition-colors"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                {products.length > 0 && products.some(p => p.unitPrice && p.quantity) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      Order Summary
                    </h3>
                    
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="space-y-4">
                        {/* Products List */}
                        <div className="space-y-3">
                          {products.map((product, index) => (
                            product.unitPrice && product.quantity && (
                              <div key={product.id} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                                <div>
                                  <span className="font-medium">{product.productName || `Product ${index + 1}`}</span>
                                  <div className="text-sm text-gray-600">
                                    {product.itemCode} • {product.quantity} {product.pricePerUnit} × ${parseFloat(product.unitPrice || 0).toFixed(2)}
                                  </div>
                                </div>
                                <span className="font-medium">
                                  ${(parseFloat(product.unitPrice || 0) * parseInt(product.quantity || 0)).toFixed(2)} {product.currency}
                                </span>
                              </div>
                            )
                          ))}
                        </div>
                        
                        {/* Totals */}
                        <div className="border-t pt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-medium">${calculateTotals().subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">GST (10%):</span>
                            <span className="font-medium">${calculateTotals().gst.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-lg font-bold text-teal-600 border-t pt-2 mt-2">
                            <span>Total:</span>
                            <span>${calculateTotals().total.toFixed(2)} AUD</span>
                          </div>
                        </div>
                        
                        {/* Contract Status Indicator */}
                        <div className="border-t pt-3 mt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Contract Status:</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              salesContractFile 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {salesContractFile ? 'Signed' : 'Unsigned'}
                            </span>
                          </div>
                          {salesContractFile && signatureForm.signerName && (
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-gray-600 text-sm">Signed by:</span>
                              <span className="text-sm font-medium">{signatureForm.signerName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Other steps remain the same... */}
          </div>

          {/* Footer */}
          {step === 1 && (
            <div className="p-6 border-t border-gray-200 flex justify-between">
              <button
                onClick={closeModal}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading || isScanning}
              >
                Cancel
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={
                  loading || 
                  isScanning ||
                  !userEmail || 
                  !orderForm.poNumber ||
                  !products.every(p => p.itemCode && p.productName && p.unitPrice && p.quantity) || 
                  !orderForm.customerInfo.companyName
                }
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Create Order
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    )}
  </>
);
};

export default AddOrderComponent;