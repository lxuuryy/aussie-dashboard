'use client'
import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  Scan, 
  FileText, 
  Eye, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Download,
  RefreshCw,
  Zap,
  FileImage,
  File,
  X,
  Brain,
  Sparkles,
  Search,
  Copy,
  Edit3,
  Package,
  DollarSign,
  Calendar,
  Building,
  User,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import * as mammoth from 'mammoth';

const DocumentScanner = ({ onDataExtracted, onClose }) => {
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [previewMode, setPreviewMode] = useState('structured');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Supported file types
  const supportedTypes = {
    'application/pdf': 'PDF Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'application/msword': 'Word Document (Legacy)',
    'text/plain': 'Text File',
    'image/jpeg': 'JPEG Image',
    'image/png': 'PNG Image',
    'image/webp': 'WebP Image',
    'text/html': 'HTML Document'
  };

  // Extract text from PDF using pdf-parse alternative
  const extractTextFromPDF = async (file) => {
    try {
      // Load PDF.js from CDN
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
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const totalPages = pdf.numPages;
      
      for (let i = 1; i <= totalPages; i++) {
        setScanProgress((i / totalPages) * 30); // First 30% for extraction
        
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      
      return fullText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF. Please ensure the PDF contains selectable text.');
    }
  };

  // Extract text from DOCX files
  const extractTextFromDOCX = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error('DOCX extraction error:', error);
      throw new Error('Failed to extract text from Word document.');
    }
  };

  // OCR simulation for images (in production, use real OCR service)
  const performOCR = async (file) => {
    // In a real implementation, you would use:
    // - Google Vision API
    // - AWS Textract
    // - Azure Computer Vision
    // - Tesseract.js for client-side OCR
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('OCR functionality requires integration with an OCR service. Please upload a text-based document instead.'));
      }, 2000);
    });
  };

  // Main text extraction function
  const extractTextFromFile = async (file) => {
    const fileType = file.type;
    
    if (fileType === 'application/pdf') {
      return await extractTextFromPDF(file);
    } else if (fileType.includes('wordprocessingml') || fileType === 'application/msword') {
      return await extractTextFromDOCX(file);
    } else if (fileType === 'text/plain' || fileType === 'text/html') {
      return await file.text();
    } else if (fileType.startsWith('image/')) {
      return await performOCR(file);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  };

  // OpenAI API call for intelligent data extraction
  const extractDataWithOpenAI = async (text, userApiKey) => {

    console.log(text)
    const prompt = `
You are an expert document parser. Extract structured data from the following document text and return it as a JSON object.

The document appears to be a purchase order, invoice, or business document. Extract the following information:

1. Order Information:
   - poNumber (purchase order number)
   - orderDate (in YYYY-MM-DD format)
   - estimatedDelivery (in YYYY-MM-DD format)
   - reference
   - notes

2. Customer Information:
   - companyName
   - contactPerson
   - email
   - phone
   - abn (Australian Business Number if present)
   - address (object with street, city, state, postcode, country)

3. Vendor/Supplier Information:
   - companyName
   - contactPerson
   - email
   - phone
   - abn
   - address (object with street, city, state, postcode, country)

4. Delivery Address:
   - street
   - city
   - state
   - postcode
   - country

5. Products Array (each product should have):
   - itemCode
   - productName
   - description
   - quantity (as number)
   - unitPrice (as number)
   - pricePerUnit (e.g., "each", "meter", "kg")
   - currency (e.g., "AUD", "USD")
   - category (try to determine from description)
   - material (if mentioned)
   - dimensions (object with length, width, height, diameter, thickness, unit)
   - weight (if mentioned)

6. Financial Information:
   - subtotal (as number)
   - gst (as number)
   - total (as number)
   - currency

7. Terms:
   - paymentTerms
   - deliveryTerms
   - documentation
   - quantityTolerance

Extract only the information that is clearly present in the document. Use null for missing values.
For Australian addresses, common states are: VIC, NSW, QLD, SA, WA, TAS, NT, ACT.
For dates, convert to YYYY-MM-DD format.
For numbers, extract as actual numbers, not strings.

Return only valid JSON without any additional text or explanation.

Document text:
${text}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert document parser that extracts structured business data from documents. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('OpenAI API response:', data);
      const extractedText = data.choices[0].message.content;
      
      // Parse the JSON response
      try {
        const parsedData = JSON.parse(extractedText);
        return parsedData;
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON:', extractedText);
        throw new Error('OpenAI returned invalid JSON. Please try again.');
      }
      
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    // Check file type
    if (!Object.keys(supportedTypes).includes(selectedFile.type)) {
      setError(`Unsupported file type: ${selectedFile.type}`);
      return;
    }

    // Check file size (max 50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setExtractedData(null);
    setRawText('');
    setScanProgress(0);
  };

  // Scan document
  const scanDocument = async () => {
    if (!file) return;

    // Check if API key is provided
    const currentApiKey = apiKey || localStorage.getItem('openai_api_key');
    if (!currentApiKey) {
      setShowApiKeyInput(true);
      return;
    }

    setScanning(true);
    setError(null);
    setScanProgress(0);

    try {
      // Extract text from file
      setScanProgress(10);
      const text = await extractTextFromFile(file);
      setRawText(text);
      
      // Process with OpenAI
      setScanProgress(50);
      const structuredData = await extractDataWithOpenAI(text, currentApiKey);
      setExtractedData(structuredData);
      
      setScanProgress(100);
      
      // Save API key for future use (optional)
      if (apiKey) {
        localStorage.setItem('openai_api_key', apiKey);
      }
      
    } catch (err) {
      setError(err.message);
      console.error('Scanning error:', err);
    } finally {
      setScanning(false);
    }
  };

  // Apply extracted data to form
  const applyExtractedData = () => {
    if (!extractedData) return;
    
    // Transform the OpenAI response to match the expected form structure
    const transformedData = {
      // Basic order info
      poNumber: extractedData.poNumber || '',
      orderDate: extractedData.orderDate || '',
      estimatedDelivery: extractedData.estimatedDelivery || '',
      reference: extractedData.reference || '',
      notes: extractedData.notes || '',

      // Customer information
      customerInfo: {
        companyName: extractedData.customerInfo?.companyName || extractedData.customer?.companyName || '',
        contactPerson: extractedData.customerInfo?.contactPerson || extractedData.customer?.contactPerson || '',
        email: extractedData.customerInfo?.email || extractedData.customer?.email || '',
        phone: extractedData.customerInfo?.phone || extractedData.customer?.phone || '',
        abn: extractedData.customerInfo?.abn || extractedData.customer?.abn || '',
        address: extractedData.customerInfo?.address || extractedData.customer?.address || {
          street: '',
          city: '',
          state: 'VIC',
          postcode: '',
          country: 'Australia'
        }
      },

      // Delivery address
      deliveryAddress: extractedData.deliveryAddress || extractedData.delivery?.address || {
        street: '',
        city: '',
        state: 'VIC',
        postcode: '',
        country: 'Australia'
      },

      // Products
      products: (extractedData.products || extractedData.items || []).map(product => ({
        itemCode: product.itemCode || '',
        productName: product.productName || product.name || '',
        description: product.description || '',
        quantity: product.quantity || 1,
        unitPrice: product.unitPrice || product.price || '',
        pricePerUnit: product.pricePerUnit || 'each',
        currency: product.currency || 'AUD',
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
        finish: 'Raw/Mill Finish',
        specifications: [],
        tags: [],
        isACRSCertified: false
      })),

      // Terms
      paymentTerms: extractedData.terms?.paymentTerms || extractedData.paymentTerms || '30 Days from delivery to yard',
      deliveryTerms: extractedData.terms?.deliveryTerms || extractedData.deliveryTerms || 'Delivery Duty paid - unloading by purchaser',
      documentation: extractedData.terms?.documentation || 'Commercial Invoice Certificate of Origin Mill Test Certificates ACRS Certification',
      quantityTolerance: extractedData.terms?.quantityTolerance || '+/- 10%',

      // Financial data
      financials: {
        subtotal: extractedData.subtotal || extractedData.financials?.subtotal || 0,
        gst: extractedData.gst || extractedData.financials?.gst || 0,
        total: extractedData.total || extractedData.financials?.total || 0
      }
    };
    
    onDataExtracted(transformedData);
    onClose();
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Save API key
  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('openai_api_key', apiKey.trim());
      setShowApiKeyInput(false);
      scanDocument();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">AI Document Scanner</h2>
                <p className="text-sm text-gray-600">Extract data from PDFs, Word docs using OpenAI</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {showApiKeyInput ? (
            // API Key Input
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">OpenAI API Key Required</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                To use AI-powered document parsing, please provide your OpenAI API key. 
                Your key will be stored locally and used only for document processing.
              </p>
              
              <div className="max-w-md mx-auto space-y-4">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowApiKeyInput(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveApiKey}
                    disabled={!apiKey.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                  >
                    Save & Scan
                  </button>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg max-w-md mx-auto">
                <p className="text-xs text-blue-800">
                  Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI Platform</a>. 
                  Your key is stored locally and never shared.
                </p>
              </div>
            </div>
          ) : !file ? (
            // File Upload
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload Document</h3>
              <p className="text-gray-600 mb-6">
                Select a purchase order, invoice, or contract to extract data automatically with AI
              </p>
              
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.html,.jpg,.jpeg,.png,.webp"
                onChange={handleFileSelect}
                className="hidden"
                id="document-upload"
              />
              <label
                htmlFor="document-upload"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Upload className="w-5 h-5" />
                Choose Document
              </label>
              
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                {Object.entries(supportedTypes).map(([type, name]) => (
                  <div key={type} className="p-3 border border-gray-200 rounded-lg text-center">
                    <FileText className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <span className="text-xs text-gray-600">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Info */}
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <File className="w-8 h-8 text-blue-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{file.name}</h3>
                  <p className="text-sm text-gray-600">
                    {supportedTypes[file.type]} • {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                {!scanning && !extractedData && (
                  <button
                    onClick={scanDocument}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Scan with AI
                  </button>
                )}
              </div>

              {/* Scanning Progress */}
              {scanning && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Processing with AI...</h3>
                  <p className="text-gray-600 mb-4">
                    {scanProgress < 30 ? 'Extracting text from document...' :
                     scanProgress < 50 ? 'Text extracted, sending to OpenAI...' :
                     'AI is analyzing and structuring the data...'}
                  </p>
                  <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{scanProgress}% complete</p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800">Scanning Error</h4>
                      <p className="text-red-700 text-sm">{error}</p>
                      {error.includes('API') && (
                        <button
                          onClick={() => setShowApiKeyInput(true)}
                          className="mt-2 text-sm text-red-600 underline hover:text-red-800"
                        >
                          Update API Key
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              {extractedData && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Data Extracted Successfully
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewMode(previewMode === 'structured' ? 'raw' : 'structured')}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                      >
                        {previewMode === 'structured' ? 'Show Raw Text' : 'Show Structured'}
                      </button>
                    </div>
                  </div>

                  {previewMode === 'structured' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Order Info */}
                      {(extractedData.poNumber || extractedData.orderDate) && (
                        <div className="p-4 border border-gray-200 rounded-lg">
                          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            Order Information
                          </h4>
                          <div className="space-y-2 text-sm">
                            {extractedData.poNumber && (
                              <div><span className="font-medium">PO Number:</span> {extractedData.poNumber}</div>
                            )}
                            {extractedData.orderDate && (
                              <div><span className="font-medium">Order Date:</span> {extractedData.orderDate}</div>
                            )}
                            {extractedData.estimatedDelivery && (
                              <div><span className="font-medium">Delivery Date:</span> {extractedData.estimatedDelivery}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Customer Info */}
                      {extractedData.customerInfo && (
                        <div className="p-4 border border-gray-200 rounded-lg">
                          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                            <Building className="w-4 h-4 text-green-600" />
                            Customer Information
                          </h4>
                          <div className="space-y-2 text-sm">
                            {extractedData.customerInfo.companyName && (
                              <div><span className="font-medium">Company:</span> {extractedData.customerInfo.companyName}</div>
                            )}
                            {extractedData.customerInfo.contactPerson && (
                              <div><span className="font-medium">Contact:</span> {extractedData.customerInfo.contactPerson}</div>
                            )}
                            {extractedData.customerInfo.email && (
                              <div><span className="font-medium">Email:</span> {extractedData.customerInfo.email}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Products */}
                      {extractedData.products && extractedData.products.length > 0 && (
                        <div className="md:col-span-2 p-4 border border-gray-200 rounded-lg">
                          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4 text-purple-600" />
                            Products ({extractedData.products.length})
                          </h4>
                          <div className="space-y-3">
                            {extractedData.products.map((product, index) => (
                              <div key={index} className="p-3 bg-gray-50 rounded border">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                  <div>
                                    <span className="font-medium">Item:</span> {product.itemCode || 'N/A'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Product:</span> {product.productName || 'N/A'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Qty:</span> {product.quantity} × ${product.unitPrice}
                                  </div>
                                </div>
                                {product.description && (
                                  <p className="text-xs text-gray-600 mt-1">{product.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Financial Info */}
                      {(extractedData.subtotal || extractedData.total) && (
                        <div className="p-4 border border-gray-200 rounded-lg">
                          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-yellow-600" />
                            Financial Summary
                          </h4>
                          <div className="space-y-2 text-sm">
                            {extractedData.subtotal && (
                              <div><span className="font-medium">Subtotal:</span> ${extractedData.subtotal}</div>
                            )}
                            {extractedData.gst && (
                              <div><span className="font-medium">GST:</span> ${extractedData.gst}</div>
                            )}
                            {extractedData.total && (
                              <div><span className="font-medium">Total:</span> ${extractedData.total}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-800">Raw Extracted Text</h4>
                        <button
                          onClick={() => copyToClipboard(rawText)}
                          className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                        >
                          <Copy className="w-3 h-3" />
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded max-h-96 overflow-y-auto whitespace-pre-wrap">
                        {rawText}
                      </pre>
                    </div>
                  )}

                  {/* Apply Button */}
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={applyExtractedData}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Apply to Order Form
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {file ? `Selected: ${file.name}` : 'No file selected'}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {file && !extractedData && !scanning && (
                <button
                  onClick={() => {
                    setFile(null);
                    setError(null);
                    setRawText('');
                    setScanProgress(0);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Choose Different File
                </button>
              )}
              {extractedData && (
                <button
                  onClick={applyExtractedData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Apply Data
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced AddOrderComponent with Document Scanner Integration
const AddOrderComponentWithScanner = () => {
  const [showDocumentScanner, setShowDocumentScanner] = useState(false);
  const [orderForm, setOrderForm] = useState({
    // ... (keep existing orderForm state)
  });
  const [products, setProducts] = useState([{
    // ... (keep existing products state)
  }]);

  // Handle data extracted from document scanner
  const handleDocumentDataExtracted = (extractedData) => {
    console.log('Extracted data:', extractedData);
    
    // Update order form with extracted data
    if (extractedData.poNumber) {
      setOrderForm(prev => ({ ...prev, poNumber: extractedData.poNumber }));
    }
    
    if (extractedData.orderDate) {
      setOrderForm(prev => ({ ...prev, orderDate: extractedData.orderDate }));
    }
    
    if (extractedData.estimatedDelivery) {
      setOrderForm(prev => ({ ...prev, estimatedDelivery: extractedData.estimatedDelivery }));
    }
    
    if (extractedData.reference) {
      setOrderForm(prev => ({ ...prev, reference: extractedData.reference }));
    }
    
    if (extractedData.notes) {
      setOrderForm(prev => ({ ...prev, notes: extractedData.notes }));
    }

    // Update customer info
    if (extractedData.customerInfo) {
      setOrderForm(prev => ({
        ...prev,
        customerInfo: {
          ...prev.customerInfo,
          ...extractedData.customerInfo
        }
      }));
    }

    // Update delivery address
    if (extractedData.deliveryAddress) {
      setOrderForm(prev => ({
        ...prev,
        deliveryAddress: {
          ...prev.deliveryAddress,
          ...extractedData.deliveryAddress
        }
      }));
    }

    // Update terms
    if (extractedData.paymentTerms) {
      setOrderForm(prev => ({ ...prev, paymentTerms: extractedData.paymentTerms }));
    }
    
    if (extractedData.deliveryTerms) {
      setOrderForm(prev => ({ ...prev, deliveryTerms: extractedData.deliveryTerms }));
    }
    
    if (extractedData.documentation) {
      setOrderForm(prev => ({ ...prev, documentation: extractedData.documentation }));
    }
    
    if (extractedData.quantityTolerance) {
      setOrderForm(prev => ({ ...prev, quantityTolerance: extractedData.quantityTolerance }));
    }

    // Update products
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
        specifications: product.specifications || [],
        tags: product.tags || [],
        isACRSCertified: product.isACRSCertified || false,
        unitPrice: product.unitPrice || '',
        pricePerUnit: product.pricePerUnit || 'each',
        currency: product.currency || 'AUD',
        quantity: product.quantity || 1
      }));
      
      setProducts(newProducts);
    }

    // Show success message
    alert(`Document scanned successfully! Extracted ${extractedData.products?.length || 0} products and populated order form.`);
  };

  return (
    <>
      {/* Document Scanner Modal */}
      {showDocumentScanner && (
        <DocumentScanner
          onDataExtracted={handleDocumentDataExtracted}
          onClose={() => setShowDocumentScanner(false)}
        />
      )}

      {/* Your existing AddOrderComponent JSX here */}
      {/* Add the document scanner button in the header or appropriate location */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setShowDocumentScanner(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
        >
          <Brain className="w-5 h-5" />
          Scan Document with AI
        </button>
        
        <div className="text-sm text-gray-500">
          Upload PDF, Word, or image files to auto-fill order details
        </div>
      </div>
      
      {/* Rest of your existing component */}
    </>
  );
};

export default DocumentScanner;