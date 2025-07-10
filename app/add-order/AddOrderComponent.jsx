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
  PenTool
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import ProductLookoutComponent from '../(components)/ProductLookoutComponent';

import { db, storage } from '@/firebase';

const AddOrderComponent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Order Details, 2: Document Upload, 3: Success
  const [companyData, setCompanyData] = useState(null);
  
  // User email input state
  const [userEmail, setUserEmail] = useState('');
  const [newAuthorizedEmail, setNewAuthorizedEmail] = useState('');
  const [showProductLookup, setShowProductLookup] = useState(false);
  const [proformaInvoiceFile, setProformaInvoiceFile] = useState(null);


  // File upload states
  const [purchaseOrderFile, setPurchaseOrderFile] = useState(null);
  const [salesContractFile, setSalesContractFile] = useState(null);
const [uploadProgress, setUploadProgress] = useState({ po: 0, contract: 0, proforma: 0 });

  // Signature form state
  const [signatureForm, setSignatureForm] = useState({
    signerName: '',
    signerTitle: '',
    signatureDate: new Date().toISOString().split('T')[0]
  });


  const handleProductFromLookup = (selectedProductData) => {
  // Update current product with selected data
  updateProduct(currentProductIndex, 'itemCode', selectedProductData.itemCode);
  updateProduct(currentProductIndex, 'productName', selectedProductData.productName);
  // ... update all other fields
  setShowProductLookup(false);
};
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

  // Load company data when modal opens or user email changes
  useEffect(() => {
    if (isOpen && userEmail) {
      loadCompanyData();
    }
  }, [isOpen, userEmail]);

  // Load user's company data from companies collection
  const loadCompanyData = async () => {
    if (!userEmail) return;
    
    try {
      // First check if user is in authorizedUsers array
      const companiesQuery = query(
        collection(db, 'companies'),
        where('authorizedUsers', 'array-contains', userEmail)
      );
      
      const companiesSnapshot = await getDocs(companiesQuery);
      
      if (!companiesSnapshot.empty) {
        const companyDoc = companiesSnapshot.docs[0];
        const company = {
          id: companyDoc.id,
          ...companyDoc.data()
        };
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
        // Fallback: Check if user is superAdmin
        const ownerQuery = query(
          collection(db, 'companies'),
          where('superAdmin', '==', userEmail)
        );
        
        const ownerSnapshot = await getDocs(ownerQuery);
        
        if (!ownerSnapshot.empty) {
          const companyDoc = ownerSnapshot.docs[0];
          const company = {
            id: companyDoc.id,
            ...companyDoc.data()
          };
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
          // Reset company data if no company found
          setCompanyData(null);
        }
      }
    } catch (error) {
      console.error('Error loading company data:', error);
    }
  };

  // Reset form to initial state
  const resetForm = () => {
    setStep(1);
    setPurchaseOrderFile(null);
    setSalesContractFile(null);
     setProformaInvoiceFile(null); // Add this line
  setUploadProgress({ po: 0, contract: 0, proforma: 0 }); // Update t

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
    if (!loading) {
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

  // Generate PO number
  const generatePONumber = () => {
    return `PO-${Date.now()}`;
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

  // Add PO Number validation
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

      if (purchaseOrderFile) {
        console.log('Uploading purchase order...');
        setUploadProgress(prev => ({ ...prev, po: 25 }));
        
        // Purchase order file name format: PO-{timestamp}_{ISO-date}.{extension}
        const poFileName = `${poNumber}_${new Date().toISOString().replace(/[:.]/g, '-')}.${purchaseOrderFile.name.split('.').pop()}`;
        pdfUpload = await uploadFile(purchaseOrderFile, 'purchase-orders', poFileName);
        
        setUploadProgress(prev => ({ ...prev, po: 100 }));
      }

      if (salesContractFile) {
        console.log('Uploading signed sales contract...');
        setUploadProgress(prev => ({ ...prev, contract: 25 }));
        
        // Signed contract file name format: PO-{timestamp}_signed_contract_{ISO-date}.{extension}
        const contractFileName = `${poNumber}_signed_contract_${new Date().toISOString().replace(/[:.]/g, '-')}.${salesContractFile.name.split('.').pop()}`;
        contractUpload = await uploadFile(salesContractFile, 'signed-contracts', contractFileName);
        
        setUploadProgress(prev => ({ ...prev, contract: 100 }));
      }

      if (proformaInvoiceFile) {
      console.log('Uploading proforma invoice...');
      setUploadProgress(prev => ({ ...prev, proforma: 25 }));
      
      // Proforma invoice file name format: PO-{timestamp}_proforma_invoice_{ISO-date}.{extension}
      const proformaFileName = `${poNumber}_proforma_invoice_${new Date().toISOString().replace(/[:.]/g, '-')}.${proformaInvoiceFile.name.split('.').pop()}`;
      proformaUpload = await uploadFile(proformaInvoiceFile, 'proforma-invoices', proformaFileName);
      
      setUploadProgress(prev => ({ ...prev, proforma: 100 }));
    }

      // Step 2: Prepare complete order data with uploaded file URLs
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

      // Step 3: Create order in Firestore with all data including file URLs
      console.log('Creating order in Firestore with complete data...');
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      const orderId = docRef.id;

      setStep(3); // Move to success step
      
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
          accept=".pdf,.doc,.docx,.html"
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

      {/* Modal */}
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
                      {step === 1 ? 'Order & Product Details' : step === 2 ? 'Uploading Documents...' : 'Complete'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={loading}
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
                <div className={`h-1 w-16 ${step >= 2 ? 'bg-teal-600' : 'bg-gray-200'}`}></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= 2 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  2
                </div>
                <div className={`h-1 w-16 ${step >= 3 ? 'bg-teal-600' : 'bg-gray-200'}`}></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= 3 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  3
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {step === 1 && (
                <div className="space-y-8">
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                  {showProductLookup && (
  <ProductLookoutComponent
    isOpen={showProductLookup}
    onClose={() => setShowProductLookup(false)}
    onProductSelect={handleProductFromLookup}
    currentProductData={products[currentProductIndex]}
  />
)}

<button
  onClick={() => setShowProductLookup(true)}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
>
  <Search className="w-4 h-4" />
  Lookup
</button>

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
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {/* Changed from grid-cols-2 to grid-cols-3 */}
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

              {step === 2 && (
  <div className="text-center py-12">
    <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-teal-600" />
    <h3 className="text-lg font-semibold text-gray-800 mb-2">Processing Order...</h3>
    <p className="text-gray-600 mb-6">Please wait while we create your order and upload documents.</p>
    
    {/* Upload Progress */}
    {(purchaseOrderFile || salesContractFile || proformaInvoiceFile) && (
      <div className="space-y-4 max-w-md mx-auto">
        {purchaseOrderFile && (
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Purchase Order</span>
              <span>{uploadProgress.po}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.po}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {salesContractFile && (
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Signed Sales Contract</span>
              <span>{uploadProgress.contract}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.contract}%` }}
              ></div>
            </div>
          </div>
        )}

        {proformaInvoiceFile && (
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Proforma Invoice</span>
              <span>{uploadProgress.proforma}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.proforma}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    )}
  </div>
)}
              {step === 3 && (
  <div className="text-center py-12">
    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
    <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Created Successfully!</h2>
    <p className="text-gray-600 mb-6">
      Your order has been created
      {salesContractFile ? ' with signed contract' : ''}
      {purchaseOrderFile ? ' and purchase order uploaded' : ''}
      {proformaInvoiceFile ? ' and proforma invoice uploaded' : ''}.
    </p>
    <button
      onClick={closeModal}
      className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
    >
      Continue
    </button>
  </div>
)}
            </div>

            {/* Footer */}
           {step === 1 && (
  <div className="p-6 border-t border-gray-200 flex justify-between">
    <button
      onClick={closeModal}
      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
      disabled={loading}
    >
      Cancel
    </button>
    
    <button
      onClick={handleSubmit}
      disabled={
        loading || 
        !userEmail || 
        !orderForm.poNumber ||  // Add this line
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