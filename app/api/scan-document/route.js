// app/api/scan-document/route.js (With DOCX Support)

import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Dynamic imports to avoid SSR issues
async function parsePDF(buffer) {
  const pdf = await import('pdf-parse');
  return pdf.default(buffer);
}

async function parseDocx(buffer) {
  const mammoth = await import('mammoth');
  return mammoth.extractRawText({ buffer });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { fileData, fileName, fileType } = body;

    if (!fileData) {
      return NextResponse.json(
        { success: false, error: 'No file data provided' },
        { status: 400 }
      );
    }

    console.log(`Processing ${fileType} file: ${fileName}`);

    // Prepare the prompt for extracting order/invoice data
    const systemPrompt = `You are an expert document analyzer specializing in extracting structured data from purchase orders, invoices, quotes, and similar business documents.

Your task is to analyze the provided document and extract relevant information to populate an order form. 

Extract the following information and return it as a JSON object with this exact structure:

{
  "customerInfo": {
    "companyName": "string",
    "contactPerson": "string", 
    "email": "string",
    "phone": "string",
    "address": {
      "street": "string",
      "city": "string", 
      "state": "string",
      "postcode": "string",
      "country": "Australia"
    }
  },
  "items": [
    {
      "barType": "string (e.g., N12, N16, N20, etc.)",
      "length": "number (in meters)",
      "quantity": "number",
      "totalWeight": "number (in tonnes)",
      "pricePerTonne": "number",
      "totalPrice": "number"
    }
  ],
  "poNumber": "string",
  "orderDate": "YYYY-MM-DD",
  "deliveryDate": "YYYY-MM-DD", 
  "reference": "string",
  "notes": "string",
  "salesContract": "string",
  "subtotal": "number",
  "gst": "number", 
  "totalAmount": "number"
}

Important extraction guidelines:
- please give full name of the bar type and not short form
- Look for steel/rebar product specifications (N12, N16, N20, etc.)
- Extract quantities, weights, and pricing information
- Find customer/billing information including company name, contact details
- Look for PO numbers, order dates, delivery dates
- Calculate totals if not explicitly stated (GST is typically 10% in Australia)
- For Australian addresses, ensure state abbreviations (NSW, VIC, QLD, etc.)
- If information is not found, use empty string "" for strings, 0 for numbers
- Be precise with numerical values - don't include currency symbols in numbers
- Look for contract numbers, reference numbers, or job numbers
- Extract email addresses and phone numbers in proper formats
- Look for table structures and line items in the document

Return only the JSON object, no additional text or formatting.`;

    let response;
    let extractedText = '';
    let processingMethod = '';
    
    // Handle different file types
    if (fileType === 'application/pdf') {
      try {
        const pdfBuffer = Buffer.from(fileData, 'base64');
        console.log('Attempting to extract text from PDF...');
        
        const pdfData = await parsePDF(pdfBuffer);
        extractedText = pdfData.text;
        processingMethod = 'pdf-text-extraction';
        
        console.log('PDF text extracted successfully. Length:', extractedText.length);
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('No text could be extracted from the PDF. The PDF might be image-based or password protected.');
        }

      } catch (pdfError) {
        console.error('PDF processing error:', pdfError);
        return NextResponse.json({
          success: false,
          error: `Failed to process PDF: ${pdfError.message}. Please try converting the PDF to an image (PNG, JPG) for better results.`,
          suggestion: 'Convert your PDF to PNG/JPG format using online tools, or try uploading as a Word document (.docx) if available.',
          allowManualEntry: true
        }, { status: 400 });
      }
    } 
    else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.toLowerCase().endsWith('.docx')) {
      try {
        const docxBuffer = Buffer.from(fileData, 'base64');
        console.log('Attempting to extract text from DOCX...');
        
        const docxData = await parseDocx(docxBuffer);
        extractedText = docxData.value;
        processingMethod = 'docx-text-extraction';
        
        console.log('DOCX text extracted successfully. Length:', extractedText.length);
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('No text could be extracted from the Word document. The document might be empty or corrupted.');
        }

      } catch (docxError) {
        console.error('DOCX processing error:', docxError);
        return NextResponse.json({
          success: false,
          error: `Failed to process Word document: ${docxError.message}. Please ensure the document is a valid .docx file.`,
          suggestion: 'Try saving the document as a new .docx file or convert it to PDF/image format.',
          allowManualEntry: true
        }, { status: 400 });
      }
    } 
    else {
      // For images, use vision capabilities
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validImageTypes.includes(fileType)) {
        return NextResponse.json({
          success: false,
          error: 'Please upload a valid file: Images (JPEG, PNG, WebP), PDF, or Word documents (.docx)',
        }, { status: 400 });
      }

      processingMethod = 'vision-analysis';
      
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this document image and extract the order information. Look carefully at all text, tables, and structured data in the image. This appears to be a business document (purchase order, invoice, or quote) containing product and customer information."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${fileType};base64,${fileData}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });
    }

    // For text-based documents (PDF, DOCX), send extracted text to OpenAI
    if (extractedText && !response) {
      console.log('Sending extracted text to OpenAI for analysis...');
      
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: `Please analyze this document text and extract the order information. The following text was extracted from a ${fileType === 'application/pdf' ? 'PDF' : 'Word'} document:\n\n---\n${extractedText}\n---\n\nPlease extract the relevant order/invoice information from this text and return it in the specified JSON format.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });
    }

    const aiResponse = response.choices[0].message.content;
    console.log(`OpenAI ${processingMethod} analysis completed`);

    // Try to parse the JSON response
    let extractedData;
    try {
      // Clean the response to extract JSON
      let jsonStr = aiResponse;
      
      // Try to find JSON object in the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      // Remove any markdown formatting
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      extractedData = JSON.parse(jsonStr);
      console.log(`Successfully parsed extracted data from ${processingMethod}`);
      
    } catch (parseError) {
      console.error('Error parsing extracted data:', parseError);
      console.error('Raw AI response:', aiResponse);
      
      // Return a fallback structure with the raw response in notes
      extractedData = {
        customerInfo: {
          companyName: '',
          contactPerson: '',
          email: '',
          phone: '',
          address: {
            street: '',
            city: '',
            state: '',
            postcode: '',
            country: 'Australia'
          }
        },
        items: [{
          barType: '',
          length: '',
          quantity: '',
          totalWeight: '',
          pricePerTonne: '',
          totalPrice: ''
        }],
        poNumber: '',
        orderDate: new Date().toISOString().split('T')[0],
        deliveryDate: '',
        reference: '',
        notes: `Document analysis completed but requires manual review. Please verify and fill in the information below.\n\nProcessing method: ${processingMethod}\nOriginal file: ${fileName}\n\nAI Response: ${aiResponse.substring(0, 500)}...`,
        salesContract: '',
        subtotal: 0,
        gst: 0,
        totalAmount: 0,
        assignedUsers: []
      };
    }

    // Validate and clean the extracted data
    extractedData = validateAndCleanData(extractedData);

    return NextResponse.json({
      success: true,
      data: extractedData,
      rawResponse: aiResponse,
      extractedText: extractedText ? extractedText.substring(0, 1500) + (extractedText.length > 1500 ? '...' : '') : null,
      debugInfo: {
        fileType,
        fileName,
        textLength: extractedText.length,
        processingMethod
      }
    });

  } catch (error) {
    console.error('Error processing document:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to process document',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

// Helper function to validate and clean extracted data
function validateAndCleanData(data) {
  const cleanData = {
    customerInfo: {
      companyName: data.customerInfo?.companyName || '',
      contactPerson: data.customerInfo?.contactPerson || '',
      email: data.customerInfo?.email || '',
      phone: data.customerInfo?.phone || '',
      address: {
        street: data.customerInfo?.address?.street || '',
        city: data.customerInfo?.address?.city || '',
        state: data.customerInfo?.address?.state || '',
        postcode: data.customerInfo?.address?.postcode || '',
        country: data.customerInfo?.address?.country || 'Australia'
      }
    },
    items: [],
    poNumber: data.poNumber || '',
    orderDate: data.orderDate || new Date().toISOString().split('T')[0],
    deliveryDate: data.deliveryDate || '',
    reference: data.reference || '',
    notes: data.notes || '',
    salesContract: data.salesContract || '',
    subtotal: parseFloat(data.subtotal) || 0,
    gst: parseFloat(data.gst) || 0,
    totalAmount: parseFloat(data.totalAmount) || 0,
    assignedUsers: data.assignedUsers || []
  };

  // Clean and validate items
  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    cleanData.items = data.items.map(item => ({
      barType: item.barType || '',
      length: parseFloat(item.length) || '',
      quantity: parseFloat(item.quantity) || parseFloat(item.totalWeight) || '',
      totalWeight: parseFloat(item.totalWeight) || parseFloat(item.quantity) || '',
      pricePerTonne: parseFloat(item.pricePerTonne) || 0,
      totalPrice: parseFloat(item.totalPrice) || 0
    }));
  } else {
    // Default item if none found
    cleanData.items = [{
      barType: '',
      length: '',
      quantity: '',
      totalWeight: '',
      pricePerTonne: 0,
      totalPrice: 0
    }];
  }

  // Auto-calculate GST if not provided but subtotal exists
  if (cleanData.subtotal > 0 && cleanData.gst === 0) {
    cleanData.gst = Math.round(cleanData.subtotal * 0.1 * 100) / 100;
    cleanData.totalAmount = cleanData.subtotal + cleanData.gst;
  }

  // Validate email format
  if (cleanData.customerInfo.email && !isValidEmail(cleanData.customerInfo.email)) {
    cleanData.customerInfo.email = '';
  }

  return cleanData;
}

// Helper function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}