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
import * as mammoth from 'mammoth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Document Scanner Component - FIXED VERSION
const DocumentScanner = ({ onDataExtracted, onSkip, companyData }) => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [processingStep, setProcessingStep] = useState('');
  const [rawExtractedText, setRawExtractedText] = useState('');
  const [showRawText, setShowRawText] = useState(false);

  // Supported file types
  const supportedTypes = {
    'application/pdf': 'PDF Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document (DOCX)',
    'application/msword': 'Word Document (DOC)',
    'text/plain': 'Text File',
    'text/csv': 'CSV File',
    'application/vnd.ms-excel': 'Excel File',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel File (XLSX)'
  };

  // FIXED: Better PDF.js loader with error handling
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

  // File upload handler with better validation
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset previous state
    setError(null);
    setExtractedData(null);
    setRawExtractedText('');
    setScanProgress(0);

    // Validate file type
    if (!supportedTypes[file.type]) {
      setError(`Unsupported file type: ${file.type}. Supported types: ${Object.values(supportedTypes).join(', ')}`);
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

  // FIXED: Better PDF text extraction with proper error handling
  const extractTextFromPDF = async (file) => {
    try {
      const pdfjsLib = await loadPDFJS();
      const arrayBuffer = await file.arrayBuffer();
      
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('PDF file is empty or corrupted');
      }

      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        verbosity: 0 // Reduce console noise
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
          // Continue with other pages
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

  // FIXED: Better Word document extraction
  const extractTextFromWord = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Word document is empty or corrupted');
      }

      const result = await mammoth.extractRawText({ arrayBuffer });
      
      if (!result.value || !result.value.trim()) {
        throw new Error('No readable text found in Word document');
      }

      // Check for extraction warnings
      if (result.messages && result.messages.length > 0) {
        console.warn('Word extraction warnings:', result.messages);
      }

      return result.value.trim();
    } catch (error) {
      console.error('Word extraction error:', error);
      throw new Error(`Failed to extract text from Word document: ${error.message}`);
    }
  };

  // FIXED: Comprehensive text extraction with better error handling
  const extractTextFromFile = async (file) => {
    try {
      setProcessingStep('Reading document...');
      setScanProgress(10);

      let extractedText = '';

      switch (file.type) {
        case 'application/pdf':
          extractedText = await extractTextFromPDF(file);
          break;
          
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          extractedText = await extractTextFromWord(file);
          break;
          
        case 'text/plain':
        case 'text/csv': {
          const text = await file.text();
          if (!text.trim()) {
            throw new Error('Text file is empty');
          }
          extractedText = text;
          break;
        }
        
        default:
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

  // FIXED: Better OpenAI API integration with error handling
  const processWithOpenAI = async (extractedText) => {
    setProcessingStep('Analyzing document with AI...');
    setScanProgress(60);

    const systemPrompt = `You are a document analysis assistant for a steel/metal trading company. Analyze the provided document text and extract relevant information for an order form.

Return ONLY a valid JSON object with this structure (fill only fields you can confidently identify):

{
  "customerInfo": {
    "companyName": "",
    "contactPerson": "",
    "email": "",
    "phone": "",
    "abn": "",
    "address": {
      "street": "",
      "city": "",
      "state": "",
      "postcode": "",
      "country": "Australia"
    }
  },
  "deliveryAddress": {
    "street": "",
    "city": "",
    "state": "",
    "postcode": "",
    "country": "Australia"
  },
  "orderDetails": {
    "poNumber": "",
    "orderDate": "",
    "estimatedDelivery": "",
    "reference": "",
    "notes": ""
  },
  "products": [
    {
      "itemCode": "",
      "productName": "",
      "description": "",
      "category": "Steel Products",
      "material": "AS/NZS 4671:2019",
      "dimensions": {
        "length": "",
        "width": "",
        "height": "",
        "diameter": "",
        "thickness": "",
        "unit": "mm"
      },
      "weight": "",
      "finish": "Raw/Mill Finish",
      "quantity": 1,
      "unitPrice": "",
      "currency": "AUD",
      "isACRSCertified": false
    }
  ],
  "terms": {
    "paymentTerms": "",
    "deliveryTerms": "",
    "notes": ""
  },
  "confidence": {
    "overall": 0.5,
    "customerInfo": 0.5,
    "products": 0.5,
    "orderDetails": 0.5
  }
}

Guidelines:
- Return ONLY valid JSON, no markdown or additional text
- Set confidence scores 0.0-1.0 based on information clarity
- Leave fields empty ("") if uncertain
- For Australian companies: look for ABN, state abbreviations (VIC/NSW/QLD)
- Extract steel product details: grades, dimensions in mm, quantities
- Parse dates to YYYY-MM-DD format`;

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
            { role: 'user', content: `Analyze this document:\n\n${truncatedText}` }
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
        customerInfo: parsedData.customerInfo || {},
        deliveryAddress: parsedData.deliveryAddress || {},
        orderDetails: parsedData.orderDetails || {},
        products: Array.isArray(parsedData.products) ? parsedData.products : [],
        terms: parsedData.terms || {},
        confidence: parsedData.confidence || {
          overall: 0.3,
          customerInfo: 0.3,
          products: 0.3,
          orderDetails: 0.3
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

  // FIXED: Main scanning function with comprehensive error handling
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-600" />
            AI Document Scanner
          </CardTitle>
          <CardDescription>
            Upload a purchase order, quote, or invoice to automatically extract and fill order information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* File Upload Area */}
          {!uploadedFile && (
            <div className="relative">
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.csv,.xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="document-upload"
              />
              <Label
                htmlFor="document-upload"
                className="flex flex-col items-center gap-4 px-6 py-12 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-purple-500/50 transition-colors bg-gradient-to-br from-purple-50 to-blue-50"
              >
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-purple-600" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-700 mb-1">Upload Document</p>
                  <p className="text-sm text-muted-foreground">
                    Drag & drop or click to select files
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supported: PDF, Word, Text, CSV, Excel (Max 10MB)
                  </p>
                </div>
              </Label>
            </div>
          )}

          {/* Uploaded File Info */}
          {uploadedFile && !scanning && !extractedData && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
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
                    <Button
                      onClick={scanDocument}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Scan className="w-4 h-4 mr-2" />
                      Scan Document
                    </Button>
                    <Button
                      onClick={resetScanner}
                      variant="outline"
                      size="sm"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scanning Progress */}
          {scanning && (
            <Card>
              <CardContent className="py-8">
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
                    <Progress value={scanProgress} className="h-3 mb-2" />
                    <p className="text-sm text-gray-600">{scanProgress}% complete</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-1">Document Analysis Error</p>
                <p className="mb-3">{error}</p>
                <div className="flex gap-2">
                  <Button
                    onClick={resetScanner}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                  {onSkip && (
                    <Button
                      onClick={onSkip}
                      variant="outline"
                      size="sm"
                    >
                      Skip & Fill Manually
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Extracted Data Results */}
          {extractedData && (
            <div className="space-y-4">
              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-5 h-5" />
                    Document Analysis Complete
                  </CardTitle>
                  <CardDescription className="text-green-700">
                    Successfully extracted information from {uploadedFile.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Confidence Scores */}
                  {extractedData.confidence && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {Math.round((extractedData.confidence.overall || 0) * 100)}%
                        </div>
                        <div className="text-xs text-gray-600">Overall</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {Math.round((extractedData.confidence.customerInfo || 0) * 100)}%
                        </div>
                        <div className="text-xs text-gray-600">Customer</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {Math.round((extractedData.confidence.products || 0) * 100)}%
                        </div>
                        <div className="text-xs text-gray-600">Products</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {Math.round((extractedData.confidence.orderDetails || 0) * 100)}%
                        </div>
                        <div className="text-xs text-gray-600">Order Details</div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Extracted Information Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Customer Information */}
                    {extractedData.customerInfo && Object.values(extractedData.customerInfo).some(v => v && v !== '') && (
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Badge variant="secondary">Customer Info</Badge>
                        </h4>
                        <div className="space-y-2 text-sm">
                          {extractedData.customerInfo.companyName && (
                            <p><strong>Company:</strong> {extractedData.customerInfo.companyName}</p>
                          )}
                          {extractedData.customerInfo.contactPerson && (
                            <p><strong>Contact:</strong> {extractedData.customerInfo.contactPerson}</p>
                          )}
                          {extractedData.customerInfo.email && (
                            <p><strong>Email:</strong> {extractedData.customerInfo.email}</p>
                          )}
                          {extractedData.customerInfo.phone && (
                            <p><strong>Phone:</strong> {extractedData.customerInfo.phone}</p>
                          )}
                          {extractedData.customerInfo.abn && (
                            <p><strong>ABN:</strong> {extractedData.customerInfo.abn}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Order Details */}
                    {extractedData.orderDetails && Object.values(extractedData.orderDetails).some(v => v && v !== '') && (
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Badge variant="secondary">Order Details</Badge>
                        </h4>
                        <div className="space-y-2 text-sm">
                          {extractedData.orderDetails.poNumber && (
                            <p><strong>PO Number:</strong> {extractedData.orderDetails.poNumber}</p>
                          )}
                          {extractedData.orderDetails.orderDate && (
                            <p><strong>Order Date:</strong> {extractedData.orderDetails.orderDate}</p>
                          )}
                          {extractedData.orderDetails.estimatedDelivery && (
                            <p><strong>Delivery:</strong> {extractedData.orderDetails.estimatedDelivery}</p>
                          )}
                          {extractedData.orderDetails.reference && (
                            <p><strong>Reference:</strong> {extractedData.orderDetails.reference}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Products */}
                    {extractedData.products && extractedData.products.length > 0 && (
                      <div className="md:col-span-2">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Badge variant="secondary">Products ({extractedData.products.length})</Badge>
                        </h4>
                        <div className="space-y-3">
                          {extractedData.products.slice(0, 3).map((product, index) => (
                            <div key={index} className="p-3 bg-white rounded border text-sm">
                              <div className="flex items-center gap-2 mb-2">
                                {product.itemCode && <Badge variant="outline">{product.itemCode}</Badge>}
                                {product.productName && <span className="font-medium">{product.productName}</span>}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                                {product.quantity && <span>Qty: {product.quantity}</span>}
                                {product.unitPrice && <span>Price: ${product.unitPrice}</span>}
                                {product.material && <span>Material: {product.material}</span>}
                                {product.category && <span>Category: {product.category}</span>}
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
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setShowRawText(!showRawText)}
                        variant="outline"
                        size="sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {showRawText ? 'Hide' : 'View'} Raw Text
                      </Button>
                      <Button
                        onClick={resetScanner}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Scan Another
                      </Button>
                    </div>
                    <Button
                      onClick={applyExtractedData}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Apply to Form
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Raw Extracted Text */}
              {showRawText && rawExtractedText && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Raw Extracted Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={rawExtractedText}
                      readOnly
                      rows={10}
                      className="text-xs font-mono"
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Skip Option */}
          <div className="text-center pt-4">
            <Button
              onClick={onSkip}
              variant="ghost"
              className="text-gray-600 hover:text-gray-800"
            >
              Skip document scanning and fill manually
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentScanner;