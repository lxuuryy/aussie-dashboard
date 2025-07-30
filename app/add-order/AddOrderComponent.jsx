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
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import DocumentScanner from '@/app/(components)/DocumentScanner';

import { db, storage } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AddOrderForm = () => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Email Check, 2: Order Details, 3: Document Upload, 4: Product Check, 5: Success
  const [companyData, setCompanyData] = useState(null);
  
  // User email input state
  const [userEmail, setUserEmail] = useState('');
  const [emailChecked, setEmailChecked] = useState(false);
  const [newAuthorizedEmail, setNewAuthorizedEmail] = useState('');
  const [proformaInvoiceFile, setProformaInvoiceFile] = useState(null);

  // File upload states
  const [purchaseOrderFile, setPurchaseOrderFile] = useState(null);
  const [salesContractFile, setSalesContractFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ po: 0, contract: 0, proforma: 0 });

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

  // Form state
  const [orderForm, setOrderForm] = useState({
    // Customer information
    poNumber: '',
      salesContract: '', 
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

  // Load company data when user email changes
  useEffect(() => {
    if (debouncedEmail && debouncedEmail.includes('@') && !emailChecked) {
      loadCompanyData();
    }
  }, [debouncedEmail]);

  // Load user's company data from companies collection
  const loadCompanyData = async () => {
    if (!debouncedEmail) return;
    
    setEmailLookupLoading(true);
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
    } finally {
      setEmailLookupLoading(false);
    }
  };

  // Check email and proceed to next step
  const handleEmailCheck = () => {
  if (!userEmail || !userEmail.includes('@')) {
    alert('Please enter a valid email address');
    return;
  }
  setEmailChecked(true);
  setStep(1.5); // Go to document scanning step instead of directly to order details
};
  const handleDataExtracted = (extractedData) => {
  console.log('=== APPLYING EXTRACTED DATA ===');
  console.log('Extracted data:', extractedData);
  
  // Apply customer information
  if (extractedData.customerInfo) {
    setOrderForm(prev => ({
      ...prev,
      customerInfo: {
        ...prev.customerInfo,
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
    }));
  }

  // Apply order details
  if (extractedData.orderDetails) {
    setOrderForm(prev => ({
      ...prev,
      poNumber: extractedData.orderDetails.poNumber || prev.poNumber,
      orderDate: extractedData.orderDetails.orderDate || prev.orderDate,
      estimatedDelivery: extractedData.orderDetails.estimatedDelivery || prev.estimatedDelivery,
      reference: extractedData.orderDetails.reference || prev.reference,
      notes: extractedData.orderDetails.notes || prev.notes
    }));
  }

  // Apply delivery address if provided
  if (extractedData.deliveryAddress && Object.values(extractedData.deliveryAddress).some(v => v)) {
    setOrderForm(prev => ({
      ...prev,
      deliveryAddress: {
        street: extractedData.deliveryAddress.street || prev.deliveryAddress.street,
        city: extractedData.deliveryAddress.city || prev.deliveryAddress.city,
        state: extractedData.deliveryAddress.state || prev.deliveryAddress.state,
        postcode: extractedData.deliveryAddress.postcode || prev.deliveryAddress.postcode,
        country: extractedData.deliveryAddress.country || prev.deliveryAddress.country
      },
      sameAsCustomer: false // Set to false if delivery address is different
    }));
  }

  // Apply products
  if (extractedData.products && extractedData.products.length > 0) {
    const newProducts = extractedData.products.map((product, index) => ({
      id: Date.now() + index,
      itemCode: product.itemCode || '',
      productName: product.productName || '',
      description: product.description || '',
      category: product.category || 'Steel Products',
      material: product.material || 'AS/NZS 4671:2019',
      dimensions: {
        length: product.dimensions?.length || '',
        width: product.dimensions?.width || '',
        height: product.dimensions?.height || '',
        diameter: product.dimensions?.diameter || '',
        thickness: product.dimensions?.thickness || '',
        unit: product.dimensions?.unit || 'mm'
      },
      weight: product.weight || '',
      finish: product.finish || 'Raw/Mill Finish',
      specifications: [],
      tags: [],
      isACRSCertified: product.isACRSCertified || false,
      unitPrice: product.unitPrice || '',
      pricePerUnit: 'each',
      currency: product.currency || 'AUD',
      quantity: product.quantity || 1
    }));
    
    setProducts(newProducts);
    setCurrentProductIndex(0);
  }

  // Apply terms if provided
  if (extractedData.terms) {
    setOrderForm(prev => ({
      ...prev,
      paymentTerms: extractedData.terms.paymentTerms || prev.paymentTerms,
      deliveryTerms: extractedData.terms.deliveryTerms || prev.deliveryTerms
    }));
  }

  // Move to order details step
  setStep(2);
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

  // Helper function implementations
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

  const addAuthorizedEmail = () => {
    if (!newAuthorizedEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

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

  const removeAuthorizedEmail = (index) => {
    setOrderForm(prev => ({
      ...prev,
      authorizedEmails: prev.authorizedEmails.filter((_, i) => i !== index)
    }));
  };

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

  const addSingleCompanyEmail = (email) => {
    if (orderForm.authorizedEmails.includes(email)) {
      return;
    }

    setOrderForm(prev => ({
      ...prev,
      authorizedEmails: [...prev.authorizedEmails, email]
    }));
  };

  const copyCustomerAddress = () => {
    setOrderForm(prev => ({
      ...prev,
      deliveryAddress: { ...prev.customerInfo.address },
      sameAsCustomer: true
    }));
  };

  const handleFileSelect = (file, type) => {
    if (type === 'po') {
      setPurchaseOrderFile(file);
    } else if (type === 'contract') {
      setSalesContractFile(file);
    } else if (type === 'proforma') {
      setProformaInvoiceFile(file);
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
          missing.push(product);
        }
      }
    }
    
    console.log('Missing products:', missing.length);
    setMissingProducts(missing);
    setProductsToAdd(missing);
    
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
            quantity: 0,
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

  // Generate sales contract number
  const generateSalesContractNumber = () => {
    return `SC${Math.floor(10000 + Math.random() * 90000)}`;
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

  // Create the order
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

      setStep(5); // Move to success step
      
      console.log('Order created successfully:', orderId);
      
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Error creating order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Check if all products have required fields
    const hasValidProducts = products.every(product => 
      product.itemCode && product.productName && product.unitPrice && product.quantity
    );

if (!userEmail || !hasValidProducts || !orderForm.customerInfo.companyName || !orderForm.poNumber || !orderForm.salesContract) {
  alert('Please fill in all required fields including PO Number, Sales Contract Number for all products and your email'); // ← UPDATE MESSAGE
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
          const salesContractNumber = orderForm.salesContract; // ← ADD THIS LINE

      const currentDate = new Date();
      const signatureDateTime = new Date(signatureForm.signatureDate);
      
      // Prepare delivery address
      const deliveryAddress = orderForm.sameAsCustomer 
        ? orderForm.customerInfo.address 
        : orderForm.deliveryAddress;
      
      const fullDeliveryAddress = `${deliveryAddress.street}, ${deliveryAddress.city} ${deliveryAddress.state} ${deliveryAddress.postcode}`;

     setStep(4); // Move to document upload step

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

 return (
   <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
     <div className="max-w-6xl mx-auto space-y-6">
       
       {/* Header */}
       <Card>
         <CardHeader>
           <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center">
               <Plus className="w-6 h-6 text-white" />
             </div>
             <div>
               <CardTitle className="text-2xl">Create New Order</CardTitle>
               <CardDescription>
  {step === 1 ? 'Verify your email and company details' : 
   step === 1.5 ? 'Scan documents to auto-fill order information' :
   step === 2 ? 'Enter order and product information' : 
   step === 3 ? 'Upload documents' : 
   step === 4 ? 'Processing and product check' : 
   'Order completed'}
</CardDescription>
             </div>
           </div>
           
           {/* Progress indicator */}
           {/* Step 1.5: Document Scanning */}

         </CardHeader>
       </Card>

       {/* Step 1: Email Check */}
       {step === 1 && (
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Mail className="w-5 h-5 text-yellow-600" />
               Email Verification
             </CardTitle>
             <CardDescription>
               Enter your email address to verify your company details and access
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4">
                 <div>
                   <Label htmlFor="userEmail">Your Email Address *</Label>
                   <Input
                     id="userEmail"
                     type="email"
                     value={userEmail}
                     onChange={(e) => setUserEmail(e.target.value)}
                     placeholder="e.g. adam@psa.com.au"
                     className="mt-1"
                     disabled={emailLookupLoading}
                   />
                   <p className="text-xs text-muted-foreground mt-1">
                     This email will be used to find your company data and create the order
                   </p>
                 </div>

                 {emailLookupLoading && (
                   <div className="flex items-center gap-2 text-sm text-muted-foreground">
                     <Loader className="w-4 h-4 animate-spin" />
                     Checking company data...
                   </div>
                 )}
               </div>

               {companyData && (
                 <Card className="bg-green-50 border-green-200">
                   <CardContent className="pt-6">
                     <div className="flex items-center gap-2 mb-3">
                       <CheckCircle className="w-5 h-5 text-green-600" />
                       <h4 className="font-medium text-green-800">Company Found!</h4>
                     </div>
                     <div className="text-sm text-green-700 space-y-1">
                       <p><strong>{companyData.companyName}</strong></p>
                       <p>ABN: {companyData.abn}</p>
                       <p>Contact: {companyData.contactPerson}</p>
                       <p>Status: {companyData.isVerified ? 'Verified' : 'Pending'}</p>
                     </div>
                   </CardContent>
                 </Card>
               )}

               {debouncedEmail && debouncedEmail.includes('@') && !companyData && !emailLookupLoading && (
                 <Alert variant="destructive">
                   <AlertCircle className="h-4 w-4" />
                   <AlertDescription>
                     No company found for this email address. Please contact support or use a different email.
                   </AlertDescription>
                 </Alert>
               )}
             </div>

             <div className="flex justify-end">
               <Button 
                 onClick={handleEmailCheck}
                 disabled={!userEmail || !userEmail.includes('@') || emailLookupLoading}
                 className="flex items-center gap-2"
               >
                 Continue to Order Details
                 <ArrowRight className="w-4 h-4" />
               </Button>
             </div>
           </CardContent>
         </Card>
       )}
       {/* Step 1.5: Document Scanning */}
{step === 1.5 && emailChecked && (
  <DocumentScanner
    onDataExtracted={handleDataExtracted}
    onSkip={() => setStep(2)}
    companyData={companyData}
  />
)}

       {/* Step 2: Order Details */}
       {step === 2 && emailChecked && (
         <div className="space-y-6">
           
           {/* Company Info Display */}
           {companyData && (
             <Card className="bg-blue-50 border-blue-200">
               <CardContent className="pt-6">
                 <div className="flex items-center gap-2 mb-2">
                   <Building className="w-5 h-5 text-blue-600" />
                   <h4 className="font-medium text-blue-800">Logged in as: {companyData.companyName}</h4>
                 </div>
                 <p className="text-sm text-blue-700">Email: {userEmail}</p>
               </CardContent>
             </Card>
           )}

           {/* PO Number - Required First */}
           <Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <FileText className="w-5 h-5" />
      Order Numbers 
    </CardTitle>
    <CardDescription>
      Enter your PO number and Sales Contract number
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* ← CHANGE TO GRID */}
      <div>
        <Label htmlFor="poNumber">PO Number *</Label>
        <Input
          id="poNumber"
          type="text"
          value={orderForm.poNumber}
          onChange={(e) => handleInputChange('order', 'poNumber', e.target.value)}
          placeholder="e.g. PO-2024-001"
          className="mt-1"
        />
      </div>
      {/* ← ADD THIS NEW FIELD */}
      <div>
        <Label htmlFor="salesContract">Sales Contract Number *</Label>
        <Input
          id="salesContract"
          type="text"
          value={orderForm.salesContract}
          onChange={(e) => handleInputChange('order', 'salesContract', e.target.value)}
          placeholder="e.g. SC-2024-001"
          className="mt-1"
        />
      </div>
    </div>
  </CardContent>
</Card>

           {/* Product Information */}
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <Package className="w-5 h-5 text-blue-600" />
                   Product Information ({products.length} {products.length === 1 ? 'item' : 'items'})
                 </div>
                 <Button onClick={addNewProduct} variant="outline" size="sm">
                   <Plus className="w-4 h-4 mr-2" />
                   Add Product
                 </Button>
               </CardTitle>
               <CardDescription>
                 Add products to your order with detailed specifications
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
               {/* Product Tabs */}
               <Tabs value={currentProductIndex.toString()} onValueChange={(value) => setCurrentProductIndex(parseInt(value))}>
                 <TabsList className="grid w-full grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                   {products.map((product, index) => (
                     <TabsTrigger key={product.id} value={index.toString()} className="relative">
                       <Package className="w-4 h-4 mr-1" />
                       Item {index + 1}
                       {products.length > 1 && (
                         <Button
                           variant="ghost"
                           size="sm"
                           className="absolute -top-2 -right-2 h-5 w-5 p-0 bg-red-100 hover:bg-red-200 rounded-full"
                           onClick={(e) => {
                             e.stopPropagation();
                             removeProduct(index);
                           }}
                         >
                           <X className="w-3 h-3 text-red-600" />
                         </Button>
                       )}
                     </TabsTrigger>
                   ))}
                 </TabsList>

                 {products.map((product, index) => (
                   <TabsContent key={product.id} value={index.toString()} className="space-y-6">
                     {/* Basic Product Info */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <Label htmlFor={`itemCode-${index}`}>Item Code *</Label>
                         <Input
                           id={`itemCode-${index}`}
                           value={product.itemCode}
                           onChange={(e) => handleInputChange('product', 'itemCode', e.target.value, index)}
                           placeholder="e.g. FBSB321330"
                           className="mt-1"
                         />
                       </div>
                       
                       <div>
                         <Label htmlFor={`productName-${index}`}>Product Name *</Label>
                         <Input
                           id={`productName-${index}`}
                           value={product.productName}
                           onChange={(e) => handleInputChange('product', 'productName', e.target.value, index)}
                           placeholder="e.g. Forge Bar Starter Bar 32mm x 1330mm"
                           className="mt-1"
                         />
                       </div>
                       
                       <div>
                         <Label htmlFor={`category-${index}`}>Category *</Label>
                         <Select 
                           value={product.category} 
                           onValueChange={(value) => handleInputChange('product', 'category', value, index)}
                         >
                           <SelectTrigger className="mt-1">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             {categories.map(cat => (
                               <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       
                       <div>
                         <Label htmlFor={`material-${index}`}>Material *</Label>
                         <Select 
                           value={product.material} 
                           onValueChange={(value) => handleInputChange('product', 'material', value, index)}
                         >
                           <SelectTrigger className="mt-1">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             {materials.map(mat => (
                               <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                     </div>

                     <div>
                       <Label htmlFor={`description-${index}`}>Description *</Label>
                       <Textarea
                         id={`description-${index}`}
                         value={product.description}
                         onChange={(e) => handleInputChange('product', 'description', e.target.value, index)}
                         placeholder="e.g. 32mm x 1330mm assembled with FBENDCAP32"
                         className="mt-1"
                         rows={3}
                       />
                     </div>

                     {/* Dimensions */}
                     <div>
                       <h4 className="font-medium mb-3">Dimensions</h4>
                       <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                         <div>
                           <Label htmlFor={`length-${index}`}>Length</Label>
                           <Input
                             id={`length-${index}`}
                             type="number"
                             step="0.01"
                             value={product.dimensions.length}
                             onChange={(e) => handleInputChange('product', 'dimensions.length', e.target.value, index)}
                             placeholder="1330"
                             className="mt-1"
                           />
                         </div>
                         
                         <div>
                           <Label htmlFor={`width-${index}`}>Width</Label>
                           <Input
                             id={`width-${index}`}
                             type="number"
                             step="0.01"
                             value={product.dimensions.width}
                             onChange={(e) => handleInputChange('product', 'dimensions.width', e.target.value, index)}
                             placeholder="50"
                             className="mt-1"
                           />
                         </div>
                         
                         <div>
                           <Label htmlFor={`height-${index}`}>Height</Label>
                           <Input
                             id={`height-${index}`}
                             type="number"
                             step="0.01"
                             value={product.dimensions.height}
                             onChange={(e) => handleInputChange('product', 'dimensions.height', e.target.value, index)}
                             placeholder="25"
                             className="mt-1"
                           />
                         </div>
                         
                         <div>
                           <Label htmlFor={`diameter-${index}`}>Diameter</Label>
                           <Input
                             id={`diameter-${index}`}
                             type="number"
                             step="0.01"
                             value={product.dimensions.diameter}
                             onChange={(e) => handleInputChange('product', 'dimensions.diameter', e.target.value, index)}
                             placeholder="32"
                             className="mt-1"
                           />
                         </div>
                         
                         <div>
                           <Label htmlFor={`thickness-${index}`}>Thickness</Label>
                           <Input
                             id={`thickness-${index}`}
                             type="number"
                             step="0.01"
                             value={product.dimensions.thickness}
                             onChange={(e) => handleInputChange('product', 'dimensions.thickness', e.target.value, index)}
                             placeholder="5"
                             className="mt-1"
                           />
                         </div>
                         
                         <div>
                           <Label htmlFor={`unit-${index}`}>Unit</Label>
                           <Select 
                             value={product.dimensions.unit} 
                             onValueChange={(value) => handleInputChange('product', 'dimensions.unit', value, index)}
                           >
                             <SelectTrigger className="mt-1">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="mm">mm</SelectItem>
                               <SelectItem value="cm">cm</SelectItem>
                               <SelectItem value="m">m</SelectItem>
                               <SelectItem value="in">in</SelectItem>
                               <SelectItem value="ft">ft</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                     </div>

                     {/* Product Details */}
                     <div>
                       <h4 className="font-medium mb-3">Product Details</h4>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div>
                           <Label htmlFor={`weight-${index}`}>Weight (kg)</Label>
                           <Input
                             id={`weight-${index}`}
                             type="number"
                             step="0.01"
                             value={product.weight}
                             onChange={(e) => handleInputChange('product', 'weight', e.target.value, index)}
                             placeholder="2.5"
                             className="mt-1"
                           />
                         </div>
                         
                         <div>
                           <Label htmlFor={`finish-${index}`}>Finish</Label>
                           <Select 
                             value={product.finish} 
                             onValueChange={(value) => handleInputChange('product', 'finish', value, index)}
                           >
                             <SelectTrigger className="mt-1">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               {finishes.map(finish => (
                                 <SelectItem key={finish} value={finish}>{finish}</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                         
                         <div>
                           <Label htmlFor={`acrs-${index}`}>ACRS Certified</Label>
                           <Select 
                             value={product.isACRSCertified.toString()} 
                             onValueChange={(value) => handleInputChange('product', 'isACRSCertified', value === 'true', index)}
                           >
                             <SelectTrigger className="mt-1">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="false">No</SelectItem>
                               <SelectItem value="true">Yes</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                     </div>

                     {/* Quantity and Pricing */}
                     <div>
                       <h4 className="font-medium mb-3">Quantity & Pricing</h4>
                       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div>
                           <Label htmlFor={`quantity-${index}`}>Quantity *</Label>
                           <Input
                             id={`quantity-${index}`}
                             type="number"
                             min="1"
                             value={product.quantity}
                             onChange={(e) => handleInputChange('product', 'quantity', e.target.value, index)}
                             className="mt-1"
                           />
                         </div>

                         <div>
                           <Label htmlFor={`unitPrice-${index}`}>Unit Price *</Label>
                           <Input
                             id={`unitPrice-${index}`}
                             type="number"
                             step="0.01"
                             value={product.unitPrice}
                             onChange={(e) => handleInputChange('product', 'unitPrice', e.target.value, index)}
                             placeholder="14.92"
                             className="mt-1"
                           />
                         </div>
                         
                         <div>
                           <Label htmlFor={`pricePerUnit-${index}`}>Price Per</Label>
                           <Select 
                             value={product.pricePerUnit} 
                             onValueChange={(value) => handleInputChange('product', 'pricePerUnit', value, index)}
                           >
                             <SelectTrigger className="mt-1">
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
                         
                         <div>
                           <Label htmlFor={`currency-${index}`}>Currency</Label>
                           <Select 
                             value={product.currency} 
                             onValueChange={(value) => handleInputChange('product', 'currency', value, index)}
                           >
                             <SelectTrigger className="mt-1">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="AUD">AUD</SelectItem>
                               <SelectItem value="USD">USD</SelectItem>
                               <SelectItem value="MYR">MYR</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>

                       {/* Product Total */}
                       {product.unitPrice && product.quantity && (
                         <Card className="mt-4 bg-blue-50 border-blue-200">
                           <CardContent className="pt-4">
                             <div className="flex justify-between items-center">
                               <span className="font-medium text-gray-700">Item Total:</span>
                               <span className="font-bold text-blue-800 text-lg">
                                 ${(parseFloat(product.unitPrice || 0) * parseInt(product.quantity || 0)).toFixed(2)} {product.currency}
                               </span>
                             </div>
                           </CardContent>
                         </Card>
                       )}
                     </div>

                     {/* Specifications */}
                     <div>
                       <h4 className="font-medium mb-3">Technical Specifications</h4>
                       
                       {/* Add Specification */}
                       <Card className="bg-gray-50 mb-4">
                         <CardContent className="pt-4">
                           <div className="flex gap-3">
                             <Input
                               value={newSpec.key}
                               onChange={(e) => setNewSpec({...newSpec, key: e.target.value})}
                               placeholder="Property (e.g. Tensile Strength)"
                               className="flex-1"
                             />
                             <Input
                               value={newSpec.value}
                               onChange={(e) => setNewSpec({...newSpec, value: e.target.value})}
                               placeholder="Value (e.g. 400 MPa)"
                               className="flex-1"
                             />
                             <Button
                               onClick={() => addSpecification(index)}
                               variant="outline"
                             >
                               Add
                             </Button>
                           </div>
                         </CardContent>
                       </Card>

                       {/* Current Specifications */}
                       <div className="space-y-2">
                         {product.specifications.map((spec, specIndex) => (
                           <Card key={specIndex}>
                             <CardContent className="pt-4">
                               <div className="flex items-center justify-between">
                                 <div>
                                   <span className="font-medium">{spec.key}:</span> {spec.value}
                                 </div>
                                 <Button
                                   onClick={() => removeSpecification(index, specIndex)}
                                   variant="ghost"
                                   size="sm"
                                   className="text-red-600 hover:text-red-800 hover:bg-red-100"
                                 >
                                   <X className="w-4 h-4" />
                                 </Button>
                               </div>
                             </CardContent>
                           </Card>
                         ))}
                       </div>
                     </div>

                     {/* Tags */}
                     <div>
                       <h4 className="font-medium mb-3">Product Tags</h4>
                       
                       {/* Add Tag */}
                       <Card className="bg-gray-50 mb-4">
                         <CardContent className="pt-4">
                           <div className="flex gap-3">
                             <Input
                               value={newTag}
                               onChange={(e) => setNewTag(e.target.value)}
                               placeholder="Enter tag (e.g. heavy-duty, outdoor)"
                               className="flex-1"
                             />
                             <Button
                               onClick={() => addTag(index)}
                               variant="outline"
                             >
                               Add Tag
                             </Button>
                           </div>
                         </CardContent>
                       </Card>

                       {/* Current Tags */}
                       <div className="flex flex-wrap gap-2">
                         {product.tags.map((tag, tagIndex) => (
                           <Badge key={tagIndex} variant="secondary" className="flex items-center gap-1">
                             {tag}
                             <Button
                               onClick={() => removeTag(index, tagIndex)}
                               variant="ghost"
                               size="sm"
                               className="h-4 w-4 p-0 hover:bg-blue-200 rounded-full ml-1"
                             >
                               <X className="w-3 h-3" />
                             </Button>
                           </Badge>
                         ))}
                       </div>
                     </div>
                   </TabsContent>
                 ))}
               </Tabs>
             </CardContent>
           
           </Card>

{/* Customer Information */}
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Building className="w-5 h-5" />
                 Customer Information
               </CardTitle>
               <CardDescription>
                 Enter customer details for the order
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <Label htmlFor="companyName">Company Name *</Label>
                   <Input
                     id="companyName"
                     value={orderForm.customerInfo.companyName}
                     onChange={(e) => handleInputChange('order', 'customerInfo.companyName', e.target.value)}
                     className="mt-1"
                   />
                 </div>
                 
                 <div>
                   <Label htmlFor="contactPerson">Contact Person *</Label>
                   <Input
                     id="contactPerson"
                     value={orderForm.customerInfo.contactPerson}
                     onChange={(e) => handleInputChange('order', 'customerInfo.contactPerson', e.target.value)}
                     className="mt-1"
                   />
                 </div>
                 
                 <div>
                   <Label htmlFor="customerEmail">Email *</Label>
                   <Input
                     id="customerEmail"
                     type="email"
                     value={orderForm.customerInfo.email}
                     onChange={(e) => handleInputChange('order', 'customerInfo.email', e.target.value)}
                     className="mt-1"
                   />
                 </div>
                 
                 <div>
                   <Label htmlFor="customerPhone">Phone *</Label>
                   <Input
                     id="customerPhone"
                     type="tel"
                     value={orderForm.customerInfo.phone}
                     onChange={(e) => handleInputChange('order', 'customerInfo.phone', e.target.value)}
                     className="mt-1"
                   />
                 </div>
                 
                 <div>
                   <Label htmlFor="customerAbn">ABN</Label>
                   <Input
                     id="customerAbn"
                     value={orderForm.customerInfo.abn}
                     onChange={(e) => handleInputChange('order', 'customerInfo.abn', e.target.value)}
                     className="mt-1"
                   />
                 </div>
               </div>

               {/* Customer Address */}
               <Separator />
               <h4 className="font-medium">Customer Address</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <div className="md:col-span-2">
                   <Label htmlFor="customerStreet">Street Address *</Label>
                   <Input
                     id="customerStreet"
                     value={orderForm.customerInfo.address.street}
                     onChange={(e) => handleInputChange('order', 'customerInfo.address.street', e.target.value)}
                     className="mt-1"
                   />
                 </div>
                 
                 <div>
                   <Label htmlFor="customerCity">City *</Label>
                   <Input
                     id="customerCity"
                     value={orderForm.customerInfo.address.city}
                     onChange={(e) => handleInputChange('order', 'customerInfo.address.city', e.target.value)}
                     className="mt-1"
                   />
                 </div>
                 
                 <div>
                   <Label htmlFor="customerState">State *</Label>
                   <Select 
                     value={orderForm.customerInfo.address.state} 
                     onValueChange={(value) => handleInputChange('order', 'customerInfo.address.state', value)}
                   >
                     <SelectTrigger className="mt-1">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="VIC">VIC</SelectItem>
                       <SelectItem value="NSW">NSW</SelectItem>
                       <SelectItem value="QLD">QLD</SelectItem>
                       <SelectItem value="SA">SA</SelectItem>
                       <SelectItem value="WA">WA</SelectItem>
                       <SelectItem value="TAS">TAS</SelectItem>
                       <SelectItem value="NT">NT</SelectItem>
                       <SelectItem value="ACT">ACT</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 
                 <div>
                   <Label htmlFor="customerPostcode">Postcode *</Label>
                   <Input
                     id="customerPostcode"
                     value={orderForm.customerInfo.address.postcode}
                     onChange={(e) => handleInputChange('order', 'customerInfo.address.postcode', e.target.value)}
                     className="mt-1"
                   />
                 </div>
                 
                 <div>
                   <Label htmlFor="customerCountry">Country *</Label>
                   <Input
                     id="customerCountry"
                     value={orderForm.customerInfo.address.country}
                     onChange={(e) => handleInputChange('order', 'customerInfo.address.country', e.target.value)}
                     className="mt-1"
                   />
                 </div>
               </div>
             </CardContent>
           </Card>

           {/* Delivery Address */}
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <MapPin className="w-5 h-5" />
                   Delivery Address
                 </div>
                 <div className="flex items-center space-x-2">
                   <Checkbox
                     id="sameAsCustomer"
                     checked={orderForm.sameAsCustomer}
                     onCheckedChange={(checked) => {
                       handleInputChange('order', 'sameAsCustomer', checked);
                       if (checked) {
                         copyCustomerAddress();
                       }
                     }}
                   />
                   <Label htmlFor="sameAsCustomer" className="text-sm font-normal">
                     Same as customer address
                   </Label>
                 </div>
               </CardTitle>
             </CardHeader>
             <CardContent>
               {!orderForm.sameAsCustomer && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   <div className="md:col-span-2">
                     <Label htmlFor="deliveryStreet">Street Address *</Label>
                     <Input
                       id="deliveryStreet"
                       value={orderForm.deliveryAddress.street}
                       onChange={(e) => handleInputChange('order', 'deliveryAddress.street', e.target.value)}
                       className="mt-1"
                     />
                   </div>
                   
                   <div>
                     <Label htmlFor="deliveryCity">City *</Label>
                     <Input
                       id="deliveryCity"
                       value={orderForm.deliveryAddress.city}
                       onChange={(e) => handleInputChange('order', 'deliveryAddress.city', e.target.value)}
                       className="mt-1"
                     />
                   </div>
                   
                   <div>
                     <Label htmlFor="deliveryState">State *</Label>
                     <Select 
                       value={orderForm.deliveryAddress.state} 
                       onValueChange={(value) => handleInputChange('order', 'deliveryAddress.state', value)}
                     >
                       <SelectTrigger className="mt-1">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="VIC">VIC</SelectItem>
                         <SelectItem value="NSW">NSW</SelectItem>
                         <SelectItem value="QLD">QLD</SelectItem>
                         <SelectItem value="SA">SA</SelectItem>
                         <SelectItem value="WA">WA</SelectItem>
                         <SelectItem value="TAS">TAS</SelectItem>
                         <SelectItem value="NT">NT</SelectItem>
                         <SelectItem value="ACT">ACT</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   
                   <div>
                     <Label htmlFor="deliveryPostcode">Postcode *</Label>
                     <Input
                       id="deliveryPostcode"
                       value={orderForm.deliveryAddress.postcode}
                       onChange={(e) => handleInputChange('order', 'deliveryAddress.postcode', e.target.value)}
                       className="mt-1"
                     />
                   </div>
                   
                   <div>
                     <Label htmlFor="deliveryCountry">Country *</Label>
                     <Input
                       id="deliveryCountry"
                       value={orderForm.deliveryAddress.country}
                       onChange={(e) => handleInputChange('order', 'deliveryAddress.country', e.target.value)}
                       className="mt-1"
                     />
                   </div>
                 </div>
               )}
               {orderForm.sameAsCustomer && (
                 <p className="text-sm text-muted-foreground">
                   Delivery will be made to the customer address above.
                 </p>
               )}
             </CardContent>
           </Card>

           {/* Order Details */}
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Calendar className="w-5 h-5" />
                 Order Details
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <Label htmlFor="orderDate">Order Date *</Label>
                   <Input
                     id="orderDate"
                     type="date"
                     value={orderForm.orderDate}
                     onChange={(e) => handleInputChange('order', 'orderDate', e.target.value)}
                     className="mt-1"
                   />
                 </div>
                 
                 <div>
                   <Label htmlFor="estimatedDelivery">Estimated Delivery</Label>
                   <Input
                     id="estimatedDelivery"
                     type="date"
                     value={orderForm.estimatedDelivery}
                     onChange={(e) => handleInputChange('order', 'estimatedDelivery', e.target.value)}
                     className="mt-1"
                   />
                 </div>
                 
                 <div>
                   <Label htmlFor="reference">Reference</Label>
                   <Input
                     id="reference"
                     value={orderForm.reference}
                     onChange={(e) => handleInputChange('order', 'reference', e.target.value)}
                     placeholder="Purchase order reference"
                     className="mt-1"
                   />
                 </div>
               </div>
               
               <div>
                 <Label htmlFor="notes">Notes</Label>
                 <Textarea
                   id="notes"
                   value={orderForm.notes}
                   onChange={(e) => handleInputChange('order', 'notes', e.target.value)}
                   placeholder="Additional notes or special requirements"
                   className="mt-1"
                   rows={3}
                 />
               </div>
             </CardContent>
           </Card>

           {/* Terms and Conditions */}
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <FileText className="w-5 h-5" />
                 Terms & Conditions
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <Label htmlFor="paymentTerms">Payment Terms</Label>
                   <Select 
                     value={orderForm.paymentTerms} 
                     onValueChange={(value) => handleInputChange('order', 'paymentTerms', value)}
                   >
                     <SelectTrigger className="mt-1">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="30 Days from delivery to yard">30 Days from delivery to yard</SelectItem>
                       <SelectItem value="14 Days from delivery">14 Days from delivery</SelectItem>
                       <SelectItem value="45 days EOM after delivery">45 days EOM after delivery</SelectItem>
                       <SelectItem value="Cash on delivery">Cash on delivery</SelectItem>
                       <SelectItem value="Payment in advance">Payment in advance</SelectItem>
                       <SelectItem value="Letter of credit">Letter of credit</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 
                 <div>
                   <Label htmlFor="deliveryTerms">Delivery Terms</Label>
                   <Select 
                     value={orderForm.deliveryTerms} 
                     onValueChange={(value) => handleInputChange('order', 'deliveryTerms', value)}
                   >
                     <SelectTrigger className="mt-1">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="Delivery Duty paid - unloading by purchaser">Delivery Duty paid - unloading by purchaser</SelectItem>
                       <SelectItem value="Free Into Store - unloading by purchaser">Free Into Store - unloading by purchaser</SelectItem>
                       <SelectItem value="Ex-works">Ex-works</SelectItem>
                       <SelectItem value="Free on board">Free on board</SelectItem>
                       <SelectItem value="Cost and freight">Cost and freight</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 
                 <div>
                   <Label htmlFor="invoicingBasis">Invoicing Basis</Label>
                   <Select 
                     value={orderForm.invoicingBasis} 
                     onValueChange={(value) => handleInputChange('order', 'invoicingBasis', value)}
                   >
                     <SelectTrigger className="mt-1">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="Theoretical Weight">Theoretical Weight</SelectItem>
                       <SelectItem value="Actual Weight">Actual Weight</SelectItem>
                       <SelectItem value="Per Unit">Per Unit</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 
                 <div>
                   <Label htmlFor="quantityTolerance">Quantity Tolerance</Label>
                   <Select 
                     value={orderForm.quantityTolerance} 
                     onValueChange={(value) => handleInputChange('order', 'quantityTolerance', value)}
                   >
                     <SelectTrigger className="mt-1">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="+/- 10%">+/- 10%</SelectItem>
                       <SelectItem value="+/- 5%">+/- 5%</SelectItem>
                       <SelectItem value="+/- 15%">+/- 15%</SelectItem>
                       <SelectItem value="Exact quantity">Exact quantity</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
             </CardContent>
           </Card>

           {/* Order Summary */}
           {products.length > 0 && products.some(p => p.unitPrice && p.quantity) && (
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <Calculator className="w-5 h-5" />
                   Order Summary
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   {/* Products List */}
                   <div className="space-y-3">
                     {products.map((product, index) => (
                       product.unitPrice && product.quantity && (
                         <div key={product.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                           <div>
                             <span className="font-medium">{product.productName || `Product ${index + 1}`}</span>
                             <div className="text-sm text-muted-foreground">
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
                   <Separator />
                   <div className="space-y-2">
                     <div className="flex justify-between items-center">
                       <span className="text-muted-foreground">Subtotal:</span>
                       <span className="font-medium">${calculateTotals().subtotal.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-muted-foreground">GST (10%):</span>
                       <span className="font-medium">${calculateTotals().gst.toFixed(2)}</span>
                     </div>
                     <Separator />
                     <div className="flex justify-between items-center text-lg font-bold text-primary">
                       <span>Total:</span>
                       <span>${calculateTotals().total.toFixed(2)} AUD</span>
                     </div>
                   </div>
                 </div>
               </CardContent>
             </Card>
           )}

           {/* Continue Button */}
           <div className="flex justify-end">
             <Button 
               onClick={() => setStep(3)}
               disabled={
                 !orderForm.poNumber ||
                   !orderForm.salesContract || // ←
                 !products.every(p => p.itemCode && p.productName && p.unitPrice && p.quantity) || 
                 !orderForm.customerInfo.companyName
               }
               className="flex items-center gap-2"
             >
               Continue to Documents
               <ArrowRight className="w-4 h-4" />
             </Button>
           </div>
         </div>
       )}
       {/* Step 3: Document Upload */}
       {step === 3 && (
         <div className="space-y-6">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <FileText className="w-5 h-5" />
                 Document Upload
               </CardTitle>
               <CardDescription>
                 Upload relevant documents for your order (optional but recommended)
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Purchase Order Upload */}
                 <div className="space-y-2">
                   <Label>Purchase Order Document</Label>
                   <div className="relative">
                     <input
                       type="file"
                       accept=".pdf,.doc,.docx,.html"
                       onChange={(e) => handleFileSelect(e.target.files[0], 'po')}
                       className="hidden"
                       id="file-po"
                     />
                     <Label
                       htmlFor="file-po"
                       className="flex items-center gap-2 px-4 py-6 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                     >
                       <Upload className="w-5 h-5 text-muted-foreground" />
                       <span className="text-muted-foreground">
                         {purchaseOrderFile ? purchaseOrderFile.name : 'Choose file...'}
                       </span>
                     </Label>
                   </div>
                   {purchaseOrderFile && (
                     <div className="flex items-center gap-2 text-sm text-green-600">
                       <File className="w-4 h-4" />
                       <span>{purchaseOrderFile.name} ({Math.round(purchaseOrderFile.size / 1024)} KB)</span>
                     </div>
                   )}
                 </div>

                 {/* Sales Contract Upload */}
                 <div className="space-y-2">
                   <Label>Signed Sales Contract Document</Label>
                   <div className="relative">
                     <input
                       type="file"
                       accept=".pdf,.doc,.docx,.html"
                       onChange={(e) => handleFileSelect(e.target.files[0], 'contract')}
                       className="hidden"
                       id="file-contract"
                     />
                     <Label
                       htmlFor="file-contract"
                       className="flex items-center gap-2 px-4 py-6 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                     >
                       <Upload className="w-5 h-5 text-muted-foreground" />
                       <span className="text-muted-foreground">
                         {salesContractFile ? salesContractFile.name : 'Choose file...'}
                       </span>
                     </Label>
                   </div>
                   {salesContractFile && (
                     <div className="flex items-center gap-2 text-sm text-green-600">
                       <File className="w-4 h-4" />
                       <span>{salesContractFile.name} ({Math.round(salesContractFile.size / 1024)} KB)</span>
                     </div>
                   )}
                   
                   {/* Signature fields for sales contract */}
                   {salesContractFile && (
                     <Card className="bg-yellow-50 border-yellow-200">
                       <CardContent className="pt-4">
                         <div className="flex items-center gap-2 mb-3">
                           <PenTool className="w-4 h-4 text-yellow-600" />
                           <h5 className="font-medium text-yellow-800">Contract Signature Details</h5>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                             <Label htmlFor="signerName">Signer Name *</Label>
                             <Input
                               id="signerName"
                               value={signatureForm.signerName}
                               onChange={(e) => handleInputChange('signature', 'signerName', e.target.value)}
                               placeholder="Full name of person signing"
                               className="mt-1"
                             />
                           </div>
                           <div>
                             <Label htmlFor="signerTitle">Signer Title</Label>
                             <Input
                               id="signerTitle"
                               value={signatureForm.signerTitle}
                               onChange={(e) => handleInputChange('signature', 'signerTitle', e.target.value)}
                               placeholder="e.g. Authorized Representative"
                               className="mt-1"
                             />
                           </div>
                           <div className="md:col-span-2">
                             <Label htmlFor="signatureDate">Signature Date *</Label>
                             <Input
                               id="signatureDate"
                               type="date"
                               value={signatureForm.signatureDate}
                               onChange={(e) => handleInputChange('signature', 'signatureDate', e.target.value)}
                               className="mt-1"
                             />
                           </div>
                         </div>
                         <p className="text-xs text-yellow-700 mt-2">
                           This information will be recorded as the contract signature details
                         </p>
                       </CardContent>
                     </Card>
                   )}
                 </div>

                 {/* Proforma Invoice Upload */}
                 <div className="space-y-2">
                   <Label>Proforma Invoice Document</Label>
                   <div className="relative">
                     <input
                       type="file"
                       accept=".pdf,.doc,.docx,.html"
                       onChange={(e) => handleFileSelect(e.target.files[0], 'proforma')}
                       className="hidden"
                       id="file-proforma"
                     />
                     <Label
                       htmlFor="file-proforma"
                       className="flex items-center gap-2 px-4 py-6 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                     >
                       <Upload className="w-5 h-5 text-muted-foreground" />
                       <span className="text-muted-foreground">
                         {proformaInvoiceFile ? proformaInvoiceFile.name : 'Choose file...'}
                       </span>
                     </Label>
                   </div>
                   {proformaInvoiceFile && (
                     <div className="flex items-center gap-2 text-sm text-green-600">
                       <File className="w-4 h-4" />
                       <span>{proformaInvoiceFile.name} ({Math.round(proformaInvoiceFile.size / 1024)} KB)</span>
                     </div>
                   )}
                 </div>
               </div>
               
               <Alert>
                 <AlertCircle className="h-4 w-4" />
                 <AlertDescription>
                   <p className="font-medium mb-1">Document Upload Guidelines:</p>
                   <ul className="space-y-1 text-sm">
                     <li>• Purchase orders: PDF, DOC, DOCX, HTML → stored in /purchase-orders/</li>
                     <li>• Sales contracts: Upload SIGNED contracts → stored in /signed-contracts/</li>
                     <li>• Proforma invoices: PDF, DOC, DOCX, HTML → stored in /proforma-invoices/</li>
                     <li>• If uploading sales contract, signature details are required</li>
                     <li>• Contract status will be automatically set to "signed" when contract uploaded</li>
                     <li>• Maximum file size: 10MB per document</li>
                   </ul>
                 </AlertDescription>
               </Alert>
             </CardContent>
           </Card>

           {/* Authorized Emails */}
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Mail className="w-5 h-5 text-indigo-600" />
                 Authorized Emails
               </CardTitle>
               <CardDescription>
                 Add email addresses of people who should have access to this order
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               {/* Add Authorized Email */}
               <Card className="bg-muted/50">
                 <CardContent className="pt-4">
                   <div className="flex gap-3">
                     <Input
                       value={newAuthorizedEmail}
                       onChange={(e) => setNewAuthorizedEmail(e.target.value)}
                       placeholder="Enter email address (e.g. user@company.com)"
                       className="flex-1"
                     />
                     <Button
                       onClick={addAuthorizedEmail}
                       variant="outline"
                     >
                       Add Email
                     </Button>
                   </div>
                 </CardContent>
               </Card>

               {/* Current Authorized Emails */}
               <div>
                 <h4 className="font-medium mb-3">Authorized Users ({orderForm.authorizedEmails.length})</h4>
                 <div className="space-y-2">
                   {orderForm.authorizedEmails.length === 0 ? (
                     <div className="text-center py-6 text-muted-foreground">
                       <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                       <p>No authorized emails added yet</p>
                       <p className="text-sm">Add email addresses above to grant order access</p>
                     </div>
                   ) : (
                     orderForm.authorizedEmails.map((email, index) => (
                       <Card key={index}>
                         <CardContent className="pt-4">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <Mail className="w-4 h-4 text-indigo-600" />
                               <span className="font-medium">{email}</span>
                               {email === userEmail && (
                                 <Badge variant="secondary">You</Badge>
                               )}
                             </div>
                             <Button
                               onClick={() => removeAuthorizedEmail(index)}
                               variant="ghost"
                               size="sm"
                               className="text-red-600 hover:text-red-800 hover:bg-red-100"
                             >
                               <X className="w-4 h-4" />
                             </Button>
                           </div>
                         </CardContent>
                       </Card>
                     ))
                   )}
                 </div>
               </div>

               {/* Auto-populate from company */}
               {companyData && companyData.authorizedUsers && companyData.authorizedUsers.length > 0 && (
                 <Card className="bg-indigo-50 border-indigo-200">
                   <CardContent className="pt-4">
                     <div className="flex items-center justify-between mb-2">
                       <h5 className="font-medium text-indigo-800">Company Team Members</h5>
                       <Button
                         onClick={addAllCompanyEmails}
                         variant="outline"
                         size="sm"
                         className="border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                       >
                         Add All
                       </Button>
                     </div>
                     <div className="space-y-1">
                       {companyData.authorizedUsers.map((email, index) => (
                         <div key={index} className="flex items-center justify-between text-sm">
                           <span className="text-indigo-700">{email}</span>
                           {!orderForm.authorizedEmails.includes(email) && (
                             <Button
                               onClick={() => addSingleCompanyEmail(email)}
                               variant="ghost"
                               size="sm"
                               className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100"
                             >
                               Add
                             </Button>
                           )}
                         </div>
                       ))}
                     </div>
                   </CardContent>
                 </Card>
               )}
             </CardContent>
           </Card>

           {/* Continue Button */}
           <div className="flex justify-between">
             <Button 
               onClick={() => setStep(2)}
               variant="outline"
             >
               Back to Order Details
             </Button>
             <Button 
               onClick={handleSubmit}
               disabled={
                 loading || 
                 !userEmail || 
                 !orderForm.poNumber ||
                 !orderForm.salesContract || // ← ADD THIS LINE
                 !products.every(p => p.itemCode && p.productName && p.unitPrice && p.quantity) || 
                 !orderForm.customerInfo.companyName ||
                 (salesContractFile && (!signatureForm.signerName || !signatureForm.signatureDate))
               }
               className="flex items-center gap-2"
             >
               {loading ? (
                 <>
                   <Loader className="w-4 h-4 animate-spin" />
                   Processing...
                 </>
               ) : (
                 <>
                   <Save className="w-4 " />
                   Create Order
                 </>
               )}
             </Button>
           </div>
         </div>
       )}

       {/* Step 4: Processing and Product Check */}
       {step === 4 && (
         <div className="space-y-6">
           {loading && missingProducts.length === 0 && (
             <Card>
               <CardContent className="py-12 text-center">
                 <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-teal-600" />
                 <h3 className="text-lg font-semibold text-gray-800 mb-2">Processing Order...</h3>
                 <p className="text-gray-600 mb-6">Please wait while we upload documents and check products.</p>
                 
                 {/* Upload Progress */}
                 {(purchaseOrderFile || salesContractFile || proformaInvoiceFile) && (
                   <div className="space-y-4 max-w-md mx-auto">
                     {purchaseOrderFile && (
                       <div>
                         <div className="flex justify-between text-sm text-gray-600 mb-1">
                           <span>Purchase Order</span>
                           <span>{uploadProgress.po}%</span>
                         </div>
                         <Progress value={uploadProgress.po} className="h-2" />
                       </div>
                     )}
                     
                     {salesContractFile && (
                       <div>
                         <div className="flex justify-between text-sm text-gray-600 mb-1">
                           <span>Signed Sales Contract</span>
                           <span>{uploadProgress.contract}%</span>
                         </div>
                         <Progress value={uploadProgress.contract} className="h-2" />
                       </div>
                     )}

                     {proformaInvoiceFile && (
                       <div>
                         <div className="flex justify-between text-sm text-gray-600 mb-1">
                           <span>Proforma Invoice</span>
                           <span>{uploadProgress.proforma}%</span>
                         </div>
                         <Progress value={uploadProgress.proforma} className="h-2" />
                       </div>
                     )}
                   </div>
                 )}
               </CardContent>
             </Card>
           )}

           {missingProducts.length > 0 && (
             <div className="space-y-6">
               <Card>
                 <CardHeader>
                   <div className="text-center">
                     <Package className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                     <CardTitle className="text-2xl">Product Database Check</CardTitle>
                     <CardDescription>
                       We found {missingProducts.length} product{missingProducts.length !== 1 ? 's' : ''} that {missingProducts.length === 1 ? 'is' : 'are'} not in our database.
                     </CardDescription>
                   </div>
                 </CardHeader>
                 <CardContent>
                   <Alert className="mb-6">
                     <AlertCircle className="h-4 w-4" />
                     <AlertDescription>
                       <p className="font-medium mb-2">Missing Products Found</p>
                       <p className="text-sm mb-4">
                         The following products are not in our database. Would you like to add them? 
                         This will make them available for future orders.
                       </p>
                     </AlertDescription>
                   </Alert>

                   <div className="space-y-4">
                     <div className="flex items-center justify-between mb-4">
                       <h4 className="font-medium">Select products to add to database:</h4>
                       <div className="flex gap-2">
                         <Button
                           onClick={() => setProductsToAdd([])}
                           variant="outline"
                           size="sm"
                         >
                           Select None
                         </Button>
                         <Button
                           onClick={() => setProductsToAdd([...missingProducts])}
                           size="sm"
                         >
                           Select All
                         </Button>
                       </div>
                     </div>

                     {missingProducts.map((product) => (
                       <Card key={product.id} className="border">
                         <CardContent className="pt-4">
                           <div className="flex items-start gap-3">
                             <Checkbox
                               checked={productsToAdd.some(p => p.id === product.id)}
                               onCheckedChange={() => toggleProductToAdd(product.id)}
                               className="mt-1"
                             />
                             <div className="flex-1">
                               <div className="flex items-center gap-3 mb-2">
                                 <Badge variant="outline" className="font-mono">{product.itemCode}</Badge>
                                 {product.isACRSCertified && (
                                   <Badge variant="secondary" className="flex items-center gap-1">
                                     <Shield className="w-3 h-3" />
                                     ACRS
                                   </Badge>
                                 )}
                               </div>
                               <h4 className="font-medium mb-1">{product.productName}</h4>
                               <p className="text-sm text-muted-foreground mb-2">{product.description}</p>
                               <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                 <span>{product.category}</span>
                                 <span>{product.material}</span>
                                 <span className="font-semibold text-green-600">
                                   ${parseFloat(product.unitPrice || 0).toFixed(2)} {product.currency}/{product.pricePerUnit}
                                 </span>
                               </div>
                             </div>
                           </div>
                         </CardContent>
                       </Card>
                     ))}
                   </div>

                   <Alert className="mt-6">
                     <AlertCircle className="h-4 w-4" />
                     <AlertDescription>
                       <p className="font-medium mb-1">What happens next:</p>
                       <ul className="space-y-1 text-sm">
                         <li>• Selected products will be added to the products database</li>
                         <li>• They will be available for future orders and product lookups</li>
                         <li>• Your order will be created regardless of your selection</li>
                         <li>• You can skip this step if you don't want to add any products</li>
                       </ul>
                     </AlertDescription>
                   </Alert>
                 </CardContent>
               </Card>

               <div className="flex justify-between">
                 <Button
                   onClick={() => {
                     setProductsToAdd([]);
                     handleProductCheckComplete();
                   }}
                   variant="outline"
                   disabled={loading || addingProducts}
                 >
                   Skip & Continue
                 </Button>
                 
                 <Button
                   onClick={handleProductCheckComplete}
                   disabled={loading || addingProducts}
                   className="flex items-center gap-2"
                 >
                   {loading || addingProducts ? (
                     <>
                       <Loader className="w-4 h-4 animate-spin" />
                       {addingProducts ? 'Adding Products...' : 'Creating Order...'}
                     </>
                   ) : (
                     <>
                       <Save className="w-4 h-4" />
                       {productsToAdd.length > 0 ? `Add ${productsToAdd.length} Product${productsToAdd.length !== 1 ? 's' : ''} & Create Order` : 'Create Order'}
                     </>
                   )}
                 </Button>
               </div>
             </div>
           )}
         </div>
       )}

       {/* Step 5: Success */}
       {step === 5 && (
         <Card>
           <CardContent className="py-12 text-center">
             <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
             <CardTitle className="text-2xl mb-2">Order Created Successfully!</CardTitle>
             <CardDescription className="mb-6">
               Your order has been created
               {salesContractFile ? ' with signed contract' : ''}
               {purchaseOrderFile ? ' and purchase order uploaded' : ''}
               {proformaInvoiceFile ? ' and proforma invoice uploaded' : ''}.
               {productsToAdd.length > 0 && ` ${productsToAdd.length} product${productsToAdd.length !== 1 ? 's' : ''} ${productsToAdd.length === 1 ? 'was' : 'were'} added to the database.`}
             </CardDescription>
             <Button
               onClick={() => window.location.reload()}
               className="px-6 py-3"
             >
               Create Another Order
             </Button>
           </CardContent>
         </Card>
       )}
     </div>
   </div>
 );
};

export default AddOrderForm;