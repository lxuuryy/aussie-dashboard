import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import pdf from 'pdf-parse';
// import { PDFDocumentProxy } from 'pdf-parse'; // Removed, not exported by pdf-parse

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to extract text from PDF
interface ExtractedPDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
    outline: unknown[];
    attachments: Record<string, unknown>;
    formImage: unknown;
}

async function extractTextFromPDF(pdfPath: string): Promise<string> {
    try {
        const dataBuffer: Buffer = fs.readFileSync(pdfPath);
        const data: ExtractedPDFData = await pdf(dataBuffer) as ExtractedPDFData;
        return data.text;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error('Failed to extract text from PDF');
    }
}

// Helper function to categorize and extract data using OpenAI
interface CompanyInfo {
    name: string | null;
    abn: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
}

interface CustomerInfo {
    companyName: string | null;
    contactPerson: string | null;
    deliveryAddress: string | null;
    attentionTo: string | null;
}

interface Product {
    itemCode: string | null;
    description: string | null;
    specifications: string | null;
    quantity: number | null;
    unitPrice: number | null;
}

interface BankDetails {
    bankName: string | null;
    bsb: string | null;
    accountNumber: string | null;
    accountName: string | null;
}

interface Signatory {
    name: string | null;
    title: string | null;
    date: string | null;
}

interface ExtractedData {
    companyInfo: CompanyInfo;
    contractNumber: string | null;
    orderReference: string | null;
    date: string | null;
    shipmentDate: string | null;
    customer: CustomerInfo;
    products: Product[];
    paymentTerms: string | null;
    deliveryTerms: string | null;
    bankDetails: BankDetails;
    documentation: string[];
    additionalTerms: string | null;
    supplierSignatory: Signatory;
    customerSignatory: Signatory;
}

async function categorizeAndExtractData(extractedText: string): Promise<ExtractedData> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                {
                    role: "user",
                    content: `Please analyze this sales contract text and extract the following information in JSON format. Return ONLY the JSON, no other text:

TEXT TO ANALYZE:
${extractedText}

REQUIRED JSON FORMAT:
{
    "companyInfo": {
        "name": "company name",
        "abn": "ABN number",
        "address": "full address",
        "email": "email address",
        "phone": "phone number"
    },
    "contractNumber": "contract number",
    "orderReference": "order reference number", 
    "date": "contract date in YYYY-MM-DD format",
    "shipmentDate": "shipment date or period",
    "customer": {
        "companyName": "customer company name",
        "contactPerson": "contact person name",
        "deliveryAddress": "delivery address",
        "attentionTo": "attention to person"
    },
    "products": [
        {
            "itemCode": "item code",
            "description": "product description", 
            "specifications": "product specifications",
            "quantity": number,
            "unitPrice": number
        }
    ],
    "paymentTerms": "payment terms",
    "deliveryTerms": "delivery terms",
    "bankDetails": {
        "bankName": "bank name",
        "bsb": "BSB number", 
        "accountNumber": "account number",
        "accountName": "account name"
    },
    "documentation": ["list", "of", "required", "documents"],
    "additionalTerms": "additional terms and conditions",
    "supplierSignatory": {
        "name": "supplier signatory name",
        "title": "title",
        "date": "signature date in YYYY-MM-DD format"
    },
    "customerSignatory": {
        "name": "customer signatory name", 
        "title": "title",
        "date": "signature date in YYYY-MM-DD format"
    }
}

INSTRUCTIONS:
- Extract information accurately from the provided text
- If any field is not found, set it to null or empty string/array as appropriate
- For dates, convert to YYYY-MM-DD format
- For numbers, use actual numeric values
- Be thorough in extracting product details, specifications, and pricing
- Look for variations in field names (e.g., "Sales Contract:", "Contract No:", etc.)
- Extract complete addresses and contact information`
                }
            ],
            max_tokens: 3000,
            temperature: 0.1
        });

        const extractedContent: string | null | undefined = response.choices[0].message.content;
        
        if (!extractedContent) {
            throw new Error('OpenAI response did not contain any content');
        }

        // Parse the JSON response
        try {
            const jsonMatch = extractedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const extractedData: ExtractedData = JSON.parse(jsonMatch[0]);
                return extractedData;
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            console.log('Raw response:', extractedContent);
            throw new Error('Failed to parse extracted data');
        }

    } catch (error) {
        console.error('Error with OpenAI text analysis:', error);
        throw error;
    }
}

// Main handler function
interface DocumentFile {
    name: string;
    type: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
}

// Removed FormDataWithDocument interface

interface PostResponseSuccess {
    success: true;
    data: ExtractedData;
    extractedTextLength: number;
    fieldsExtracted: string[];
}

interface PostResponseError {
    success: false;
    error: string;
}

export async function POST(request: Request): Promise<NextResponse<PostResponseSuccess | PostResponseError>> {
    try {
        // Parse the form data
        const formData = await request.formData();
        const fileEntry = formData.get('document');

        // Check if fileEntry is a File
        if (!(fileEntry instanceof File)) {
            return NextResponse.json({ 
                success: false, 
                error: 'No document provided' 
            }, { status: 400 });
        }

        // Check if file is PDF
        if (fileEntry.type !== 'application/pdf') {
            return NextResponse.json({ 
                success: false, 
                error: 'Only PDF files are supported' 
            }, { status: 400 });
        }
        const tempDir: string = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Save the uploaded file
        // Save the uploaded file
        const buffer: Buffer = Buffer.from(await fileEntry.arrayBuffer());
        const filename: string = `${Date.now()}-${fileEntry.name}`;
        const filepath: string = path.join(tempDir, filename);
        fs.writeFileSync(filepath, buffer);
        let extractedText: string = '';

        try {
            // Extract text from PDF
            console.log('Extracting text from PDF...');
            extractedText = await extractTextFromPDF(filepath);

            console.log('Extracted text length:', extractedText.length);
            console.log('First 500 characters:', extractedText.substring(0, 500));

            if (!extractedText.trim()) {
                throw new Error('No text could be extracted from the PDF document');
            }

            // Categorize and extract structured data using OpenAI
            console.log('Analyzing text with OpenAI...');
            const extractedData: ExtractedData = await categorizeAndExtractData(extractedText);

            // Clean up temporary files
            try {
                fs.unlinkSync(filepath);
            } catch (cleanupError) {
                console.error('Error cleaning up files:', cleanupError);
            }

            // Return the extracted data
            return NextResponse.json({
                success: true,
                data: extractedData,
                extractedTextLength: extractedText.length,
                fieldsExtracted: Object.keys(extractedData).filter(key => {
                    const value = (extractedData as any)[key];
                    return value !== null && 
                                 value !== '' && 
                                 (Array.isArray(value) ? value.length > 0 : true) &&
                                 (typeof value === 'object' && value !== null ? Object.keys(value).some(subKey => value[subKey] !== null && value[subKey] !== '') : true);
                })
            });

        } catch (extractionError: any) {
            // Clean up file on error
            try {
                fs.unlinkSync(filepath);
            } catch (cleanupError) {
                console.error('Error cleaning up files after extraction error:', cleanupError);
            }
            
            throw extractionError;
        }

    } catch (error: any) {
        console.error('Error processing document:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        }, { status: 500 });
    }
}