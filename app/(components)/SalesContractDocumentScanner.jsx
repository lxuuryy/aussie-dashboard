import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  Scan, 
  CheckCircle, 
  AlertCircle,
  Loader,
  X,
  Zap,
  Bot,
  Download,
  Eye,
  RefreshCw
} from 'lucide-react';

// Sales Contract Document Scanner Component - Adapted from working version
const SalesContractDocumentScanner = ({ onDataExtracted, onSkip }) => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [processingStep, setProcessingStep] = useState('');
  const [rawExtractedText, setRawExtractedText] = useState('');
  const [showRawText, setShowRawText] = useState(false);

  // Supported file types (PDF only for sales contracts)
  const supportedTypes = {
    'application/pdf': 'PDF Document'
  };

  // Better PDF.js loader with error handling
  const loadPDFJS = async () => {
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      return window.pdfjsLib;
    }
    
    return new Promise((resolve, reject) => {
      try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          try {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
          } catch (e) {
            reject(new Error('Failed to initialize PDF.js worker'));
          }
        };
        script.onerror = () => reject(new Error('Failed to load PDF.js library'));
        document.head.appendChild(script);
      } catch (e) {
        reject(new Error('Failed to create PDF.js script element'));
      }
    });
  };

  // File upload handler with validation
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset previous state
    setError(null);
    setExtractedData(null);
    setRawExtractedText('');
    setScanProgress(0);

    // Validate file type (PDF only)
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported for sales contract scanning.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    // Check if file is corrupted or empty
    if (file.size === 0) {
      setError('File appears to be empty or corrupted');
      return;
    }

    setUploadedFile(file);
  }, []);

  // PDF text extraction using PDF.js
  const extractTextFromPDF = async (file) => {
    try {
      const pdfjsLib = await loadPDFJS();
      const arrayBuffer = await file.arrayBuffer();
      
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('PDF file is empty or corrupted');
      }

      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        verbosity: 0
      }).promise;
      
      let fullText = '';
      const totalPages = pdf.numPages;
      
      if (totalPages === 0) {
        throw new Error('PDF has no pages');
      }
      
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .filter(item => item.str && item.str.trim())
            .map(item => item.str)
            .join(' ');
          
          if (pageText.trim()) {
            fullText += pageText + '\n\n';
          }
          
          // Update progress
          setScanProgress(Math.round((pageNum / totalPages) * 40) + 10);
        } catch (pageError) {
          console.warn(`Error processing page ${pageNum}:`, pageError);
        }
      }
      
      if (!fullText.trim()) {
        throw new Error('No readable text found in PDF. The document may be scanned images or protected.');
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  };

  // Extract text from file
  const extractTextFromFile = async (file) => {
    try {
      setProcessingStep('Reading PDF document...');
      setScanProgress(10);

      let extractedText = '';

      if (file.type === 'application/pdf') {
        extractedText = await extractTextFromPDF(file);
      } else {
        throw new Error(`Unsupported file type: ${file.type}`);
      }

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('Document contains insufficient text content for analysis');
      }

      setScanProgress(50);
      return extractedText;
    } catch (error) {
      console.error('Text extraction error:', error);
      throw error;
    }
  };

  // Process with OpenAI API (adapted for sales contracts)
  const processWithOpenAI = async (extractedText) => {
    setProcessingStep('Analyzing contract with AI...');
    setScanProgress(60);

    const systemPrompt = `You are a document analysis assistant for sales contracts. Analyze the provided sales contract text and extract relevant information.

Return ONLY a valid JSON object with this structure (fill only fields you can confidently identify):

{
  "companyInfo": {
    "name": "",
    "abn": "",
    "address": "",
    "email": "",
    "phone": ""
  },
  "contractNumber": "",
  "orderReference": "",
  "date": "",
  "shipmentDate": "",
  "customer": {
    "companyName": "",
    "contactPerson": "",
    "deliveryAddress": "",
    "attentionTo": ""
  },
  "products": [
    {
      "itemCode": "",
      "description": "",
      "specifications": "",
      "quantity": 0,
      "unitPrice": 0
    }
  ],
  "paymentTerms": "",
  "deliveryTerms": "",
  "bankDetails": {
    "bankName": "",
    "bsb": "",
    "accountNumber": "",
    "accountName": ""
  },
  "documentation": [],
  "additionalTerms": "",
  "supplierSignatory": {
    "name": "",
    "title": "",
    "date": ""
  },
  "customerSignatory": {
    "name": "",
    "title": "",
    "date": ""
  },
  "confidence": {
    "overall": 0.5,
    "companyInfo": 0.5,
    "products": 0.5,
    "contractDetails": 0.5
  }
}

Guidelines:
- Return ONLY valid JSON, no markdown or additional text
- Set confidence scores 0.0-1.0 based on information clarity
- Leave fields empty ("") if uncertain
- For dates, convert to YYYY-MM-DD format
- For numbers, use actual numeric values
- Extract complete product details, specifications, and pricing
- Look for contract numbers, order references, ABN numbers
- Extract bank details and payment terms accurately`;

    try {
      // Limit text length to prevent API limits
      const truncatedText = extractedText.length > 8000 
        ? extractedText.substring(0, 8000) + '...[truncated]'
        : extractedText;

      const response = await fetch('/api/openai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze this sales contract:\n\n${truncatedText}` }
          ],
          model: 'gpt-4o',
          temperature: 0.1,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error ${response.status}: ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      
      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        throw new Error('Invalid response format from AI service');
      }

      const aiResponse = result.choices[0].message.content;
      setScanProgress(90);
      
      // Parse JSON response with multiple fallback methods
      let parsedData;
      try {
        // Try direct JSON parse
        parsedData = JSON.parse(aiResponse);
      } catch (parseError) {
        try {
          // Try extracting JSON from markdown code blocks
          const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[1]);
          } else {
            // Try finding JSON object in text
            const jsonStart = aiResponse.indexOf('{');
            const jsonEnd = aiResponse.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              const jsonStr = aiResponse.substring(jsonStart, jsonEnd + 1);
              parsedData = JSON.parse(jsonStr);
            } else {
              throw new Error('No valid JSON found in AI response');
            }
          }
        } catch (secondParseError) {
          console.error('AI Response:', aiResponse);
          throw new Error('AI returned invalid JSON format. Please try again.');
        }
      }

      // Validate the parsed data structure
      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('AI returned invalid data structure');
      }

      // Ensure required fields exist with defaults
      const validatedData = {
        companyInfo: parsedData.companyInfo || {},
        contractNumber: parsedData.contractNumber || '',
        orderReference: parsedData.orderReference || '',
        date: parsedData.date || '',
        shipmentDate: parsedData.shipmentDate || '',
        customer: parsedData.customer || {},
        products: Array.isArray(parsedData.products) ? parsedData.products : [],
        paymentTerms: parsedData.paymentTerms || '',
        deliveryTerms: parsedData.deliveryTerms || '',
        bankDetails: parsedData.bankDetails || {},
        documentation: Array.isArray(parsedData.documentation) ? parsedData.documentation : [],
        additionalTerms: parsedData.additionalTerms || '',
        supplierSignatory: parsedData.supplierSignatory || {},
        customerSignatory: parsedData.customerSignatory || {},
        confidence: parsedData.confidence || {
          overall: 0.3,
          companyInfo: 0.3,
          products: 0.3,
          contractDetails: 0.3
        }
      };

      setScanProgress(100);
      return validatedData;
    } catch (error) {
      console.error('OpenAI processing error:', error);
      
      // Provide more specific error messages
      if (error.message.includes('API Error 401')) {
        throw new Error('AI service authentication failed. Please check API configuration.');
      } else if (error.message.includes('API Error 429')) {
        throw new Error('AI service rate limit exceeded. Please try again in a moment.');
      } else if (error.message.includes('API Error 500')) {
        throw new Error('AI service is temporarily unavailable. Please try again.');
      } else {
        throw new Error(`AI analysis failed: ${error.message}`);
      }
    }
  };

  // Main scanning function
  const scanDocument = async () => {
    if (!uploadedFile) {
      setError('No file selected');
      return;
    }

    setScanning(true);
    setError(null);
    setScanProgress(0);
    setProcessingStep('Starting analysis...');

    try {
      // Step 1: Extract text from document
      const extractedText = await extractTextFromFile(uploadedFile);
      setRawExtractedText(extractedText);

      if (!extractedText.trim()) {
        throw new Error('No text could be extracted from the document');
      }

      // Step 2: Process with OpenAI
      const structuredData = await processWithOpenAI(extractedText);
      
      setExtractedData(structuredData);
      setProcessingStep('Analysis complete!');
      
    } catch (error) {
      console.error('Scanning error:', error);
      setError(error.message || 'An unexpected error occurred during document analysis');
    } finally {
      setScanning(false);
    }
  };

  // Apply extracted data to form
  const applyExtractedData = () => {
    if (extractedData && onDataExtracted) {
      onDataExtracted(extractedData);
    }
  };

  // Reset scanner
  const resetScanner = () => {
    setUploadedFile(null);
    setScanning(false);
    setScanProgress(0);
    setExtractedData(null);
    setError(null);
    setProcessingStep('');
    setRawExtractedText('');
    setShowRawText(false);
    
    // Reset file input
    const fileInput = document.getElementById('document-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-800">AI Sales Contract Scanner</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Upload a PDF sales contract to automatically extract and fill contract information
          </p>

          {/* File Upload Area */}
          {!uploadedFile && (
            <div className="relative">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="document-upload"
              />
              <label
                htmlFor="document-upload"
                className="flex flex-col items-center gap-4 px-6 py-12 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-500 transition-colors bg-gradient-to-br from-purple-50 to-blue-50"
              >
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-purple-600" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-700 mb-1">Upload Sales Contract</p>
                  <p className="text-sm text-gray-500">
                    Drag & drop or click to select a PDF file
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Supported: PDF only (Max 10MB)
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Uploaded File Info */}
          {uploadedFile && !scanning && !extractedData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-blue-900">{uploadedFile.name}</h4>
                    <p className="text-sm text-blue-700">
                      {supportedTypes[uploadedFile.type]} • {(uploadedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={scanDocument}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Scan className="w-4 h-4" />
                    Scan Contract
                  </button>
                  <button
                    onClick={resetScanner}
                    className="text-gray-500 hover:text-gray-700 p-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scanning Progress */}
          {scanning && (
            <div className="bg-white border rounded-lg p-8">
              <div className="text-center space-y-4">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 mx-auto"
                  >
                    <Zap className="w-12 h-12 text-purple-600" />
                  </motion.div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {processingStep}
                  </h3>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div 
                      className="bg-purple-600 h-3 rounded-full transition-all duration-300" 
                      style={{ width: `${scanProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">{scanProgress}% complete</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-800 mb-1">Document Analysis Error</h4>
                  <p className="text-red-700 mb-3">{error}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={resetScanner}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm flex items-center gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Try Again
                    </button>
                    {onSkip && (
                      <button
                        onClick={onSkip}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm"
                      >
                        Skip & Fill Manually
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Extracted Data Results */}
          {extractedData && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-2 text-green-800 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  <h3 className="font-semibold">Contract Analysis Complete</h3>
                </div>
                <p className="text-green-700 mb-4">
                  Successfully extracted information from {uploadedFile.name}
                </p>

                {/* Confidence Scores */}
                {extractedData.confidence && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {Math.round((extractedData.confidence.overall || 0) * 100)}%
                      </div>
                      <div className="text-xs text-gray-600">Overall</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {Math.round((extractedData.confidence.companyInfo || 0) * 100)}%
                      </div>
                      <div className="text-xs text-gray-600">Company Info</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round((extractedData.confidence.products || 0) * 100)}%
                      </div>
                      <div className="text-xs text-gray-600">Products</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {Math.round((extractedData.confidence.contractDetails || 0) * 100)}%
                      </div>
                      <div className="text-xs text-gray-600">Contract Details</div>
                    </div>
                  </div>
                )}

                <hr className="border-gray-200 mb-6" />

                {/* Extracted Information Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Contract Information */}
                  <div>
                    <h4 className="font-medium mb-3 text-gray-800">Contract Information</h4>
                    <div className="space-y-2 text-sm">
                      {extractedData.contractNumber && (
                        <p><strong>Contract Number:</strong> {extractedData.contractNumber}</p>
                      )}
                      {extractedData.orderReference && (
                        <p><strong>Order Reference:</strong> {extractedData.orderReference}</p>
                      )}
                      {extractedData.date && (
                        <p><strong>Date:</strong> {extractedData.date}</p>
                      )}
                      {extractedData.shipmentDate && (
                        <p><strong>Shipment:</strong> {extractedData.shipmentDate}</p>
                      )}
                    </div>
                  </div>

                  {/* Customer Information */}
                  {extractedData.customer && Object.values(extractedData.customer).some(v => v && v !== '') && (
                    <div>
                      <h4 className="font-medium mb-3 text-gray-800">Customer Information</h4>
                      <div className="space-y-2 text-sm">
                        {extractedData.customer.companyName && (
                          <p><strong>Company:</strong> {extractedData.customer.companyName}</p>
                        )}
                        {extractedData.customer.contactPerson && (
                          <p><strong>Contact:</strong> {extractedData.customer.contactPerson}</p>
                        )}
                        {extractedData.customer.attentionTo && (
                          <p><strong>Attention To:</strong> {extractedData.customer.attentionTo}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Products */}
                  {extractedData.products && extractedData.products.length > 0 && (
                    <div className="md:col-span-2">
                      <h4 className="font-medium mb-3 text-gray-800">
                        Products ({extractedData.products.length})
                      </h4>
                      <div className="space-y-3">
                        {extractedData.products.slice(0, 3).map((product, index) => (
                          <div key={index} className="p-3 bg-white rounded border text-sm">
                            <div className="flex items-center gap-2 mb-2">
                              {product.itemCode && (
                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                  {product.itemCode}
                                </span>
                              )}
                              {product.description && (
                                <span className="font-medium">{product.description}</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                              {product.quantity && <span>Qty: {product.quantity}</span>}
                              {product.unitPrice && <span>Price: ${product.unitPrice}</span>}
                              {product.specifications && <span>Specs: {product.specifications}</span>}
                            </div>
                          </div>
                        ))}
                        {extractedData.products.length > 3 && (
                          <p className="text-sm text-gray-600">
                            ... and {extractedData.products.length - 3} more products
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-6">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowRawText(!showRawText)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      {showRawText ? 'Hide' : 'View'} Raw Text
                    </button>
                    <button
                      onClick={resetScanner}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm flex items-center gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Scan Another
                    </button>
                  </div>
                  <button
                    onClick={applyExtractedData}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Apply to Form
                  </button>
                </div>
              </div>

              {/* Raw Extracted Text */}
              {showRawText && rawExtractedText && (
                <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-medium text-gray-800 mb-3">Raw Extracted Text</h4>
                  <textarea
                    value={rawExtractedText}
                    readOnly
                    rows={10}
                    className="w-full p-3 border border-gray-300 rounded text-xs font-mono bg-gray-50"
                  />
                </div>
              )}
            </div>
          )}

          {/* Skip Option */}
          <div className="text-center pt-4">
            <button
              onClick={onSkip}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Skip document scanning and fill manually
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SalesContractDocumentScanner;