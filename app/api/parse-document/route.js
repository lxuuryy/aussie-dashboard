import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';

// Define the schema for validation
const DocumentParseSchema = z.object({
  orderInfo: z.object({
    poNumber: z.string().nullable(),
    orderDate: z.string().nullable(),
    estimatedDelivery: z.string().nullable(),
    reference: z.string().nullable(),
    notes: z.string().nullable(),
  }),
  customerInfo: z.object({
    companyName: z.string().nullable(),
    contactPerson: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    abn: z.string().nullable(),
    address: z.object({
      street: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      postcode: z.string().nullable(),
      country: z.string().nullable(),
    }),
  }),
  deliveryAddress: z.object({
    street: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    postcode: z.string().nullable(),
    country: z.string().nullable(),
  }),
  products: z.array(z.object({
    itemCode: z.string().nullable(),
    productName: z.string().nullable(),
    description: z.string().nullable(),
    category: z.string().nullable(),
    material: z.string().nullable(),
    dimensions: z.object({
      length: z.number().nullable(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      diameter: z.number().nullable(),
      thickness: z.number().nullable(),
      unit: z.string().nullable(),
    }),
    weight: z.number().nullable(),
    finish: z.string().nullable(),
    quantity: z.number().nullable(),
    unitPrice: z.number().nullable(),
    currency: z.string().nullable(),
    pricePerUnit: z.string().nullable(),
  })),
  paymentTerms: z.string().nullable(),
  deliveryTerms: z.string().nullable(),
});

// Enhanced JSON parsing function
function parseAIResponse(responseText) {
    console.log('Raw AI response length:', responseText.length);
    console.log('Raw AI response preview:', responseText.substring(0, 200) + '...');
    
    const strategies = [
        // Strategy 1: Direct JSON parse
        () => JSON.parse(responseText),
        
        // Strategy 2: Extract JSON block
        () => {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON object found');
            return JSON.parse(jsonMatch[0]);
        },
        
        // Strategy 3: Remove markdown code blocks
        () => {
            const cleanText = responseText.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(cleanText);
        },
        
        // Strategy 4: Extract between first { and last }
        () => {
            const firstBrace = responseText.indexOf('{');
            const lastBrace = responseText.lastIndexOf('}');
            if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON braces found');
            return JSON.parse(responseText.slice(firstBrace, lastBrace + 1));
        }
    ];
    
    for (let i = 0; i < strategies.length; i++) {
        try {
            const result = strategies[i]();
            console.log(`Successfully parsed using strategy ${i + 1}`);
            return result;
        } catch (error) {
            console.log(`Strategy ${i + 1} failed:`, error.message);
            if (i === strategies.length - 1) {
                throw new Error(`All parsing strategies failed. Raw response: ${responseText.substring(0, 500)}...`);
            }
        }
    }
}

export async function POST(request) {
    try {
        // Check if OpenAI API key is configured
        if (!process.env.OPENAI_API_KEY) {
            return Response.json(
                { error: 'OpenAI API key not configured' },
                { status: 500 }
            );
        }

        const { extractedText } = await request.json();

        if (!extractedText || extractedText.trim().length === 0) {
            return Response.json(
                { error: 'No extracted text provided' },
                { status: 400 }
            );
        }

        console.log('Parsing document with chat completions...');

        const prompt = `You are a data extraction specialist for steel industry purchase orders. 

Parse the following document text and extract structured data. Return ONLY a valid JSON object with the exact structure shown below. Extract only the data that is clearly present in the text. Use null for missing values.

IMPORTANT DATA TYPE REQUIREMENTS:
- All numeric fields (length, width, height, diameter, thickness, weight, quantity, unitPrice) must be returned as actual numbers, not strings
- Dimensions should be numeric values (e.g., 40, not "40")
- Quantities should be numeric values (e.g., 303, not "303")  
- Prices should be numeric values (e.g., 185.80, not "185.80")
- Keep an eye for delivery address.
- make adress same as deliery address
- Street field usually looks like "155 Fraklin St" format
- City is usally the State name or suburb name, e.g., "Melbourne"
- Postcode is usually a 4-digit number, e.g., "3000"  or "QLD4300" without the lettering
- analyze carefully

For Australian addresses, use state abbreviations (VIC, NSW, QLD, etc.). 
For steel products, common categories include: Bars & Rods, Beams & Columns, Plates & Sheets, Pipes & Tubes, Angles & Channels, Wire & Mesh, Fasteners, Structural Steel, Reinforcement, Custom Fabrication.

Required JSON structure with correct data types:
{
  "orderInfo": {
    "poNumber": null,
    "orderDate": null,
    "estimatedDelivery": null,
    "reference": null,
    "notes": null
  },
  "customerInfo": {
    "companyName": null,
    "contactPerson": null,
    "email": null,
    "phone": null,
    "abn": null,
    "address": {
      "street": null,
      "city": null,
      "state": null,
      "postcode": null,
      "country": null
    }
  },
  "deliveryAddress": {
    "street": null,
    "city": null,
    "state": null,
    "postcode": null,
    "country": null
  },
  "products": [
    {
      "itemCode": null,
      "productName": null,
      "description": null,
      "category": null,
      "material": null,
      "dimensions": {
        "length": null,           // NUMBER, not string
        "width": null,            // NUMBER, not string
        "height": null,           // NUMBER, not string
        "diameter": null,         // NUMBER, not string
        "thickness": null,        // NUMBER, not string
        "unit": null
      },
      "weight": null,             // NUMBER, not string
      "finish": null,
      "quantity": null,           // NUMBER, not string
      "unitPrice": null,          // NUMBER, not string
      "currency": null,
      "pricePerUnit": null
    }
  ],
  "paymentTerms": null,
  "deliveryTerms": null
}

Document text to parse:
${extractedText}`;

// Usage in your route handler


        const result = await generateText({
            model: openai('gpt-4o'),
            prompt: prompt,
            temperature: 0, // For consistent, deterministic output
        });

        console.log('Raw AI response:', result.text);

        // Parse the JSON response using enhanced parsing
        let parsedData;
        try {
    parsedData = parseAIResponse(result.text);
            
            // Optional: Validate with Zod schema
            
            
        } catch (parseError) {
            console.error('JSON parsing error:', parseError);
            return Response.json(
                { 
                    error: 'Failed to parse AI response',
                    details: parseError.message,
                    rawResponse: result.text.substring(0, 1000) // Truncate for logging
                },
                { status: 500 }
            );
        }

        console.log('Document parsing successful');
        
        return Response.json({
            success: true,
            data: parsedData
        });

    } catch (error) {
        console.error('Document parsing error:', error);
        
        return Response.json(
            { 
                error: 'Failed to parse document',
                details: error.message 
            },
            { status: 500 }
        );
    }

  }