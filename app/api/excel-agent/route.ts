// /api/excel-agent/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const systemPrompt = `You are an AI assistant specialized in Excel/spreadsheet operations for Purchase Orders management. You help users manage shipping data, analyze trends, and automate data operations.

YOUR CAPABILITIES:
1. **Data Operations**: Add, update, delete purchase orders with validation
2. **Analytics**: Generate reports on shipping, products, delays, capacity
3. **Smart Insights**: Identify patterns, suggest optimizations, predict issues
4. **Automation**: Bulk operations, data cleanup, smart suggestions

AVAILABLE TOOLS:
- addPurchaseOrder: Create new purchase orders with proper validation
- updatePurchaseOrder: Modify existing orders with ID reference
- deletePurchaseOrder: Remove orders safely with confirmation
- generateReport: Create detailed reports (summary, shipping, products)
- analyzeData: Perform data analysis (delays, capacity, trends)

PURCHASE ORDER STRUCTURE:
- purchaseOrderNo: Unique identifier
- product: Product name/type
- quantities: Quantity in metric tons
- millName: Mill/supplier name
- salesContactNo: Sales contact reference
- vessel: Shipping vessel name
- pol: Port of Loading
- pod: Port of Destination
- etdShipped: Estimated Time of Departure
- etaDestination: Estimated Time of Arrival
- shippingLine: Shipping company
- invoiceDate: Invoice date or "TBA"
- status: "shipped" or "inProduction"

INTERACTION STYLE:
- Be precise and data-focused
- Provide actionable insights
- Use emojis for visual clarity in reports
- Always validate data before operations
- Suggest best practices for data management
- Explain complex operations clearly

EXAMPLES OF HELPFUL RESPONSES:
- "I'll add a new shipped order with the details you provided..."
- "Based on the data analysis, I found 3 potentially delayed orders..."
- "Here's a summary report showing your shipping performance..."
- "I recommend optimizing vessel utilization for better efficiency..."

Always confirm actions before executing and provide clear feedback on results.`;

  const result = streamText({
    model: openai('gpt-4o'),
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    toolCallStreaming: true,
    tools: {
      addPurchaseOrder: {
        description: 'Add a new purchase order to the database',
        parameters: z.object({
          orderData: z.object({
            purchaseOrderNo: z.string().describe('Unique purchase order number'),
            product: z.string().describe('Product name or type'),
            quantities: z.string().describe('Quantity in metric tons'),
            millName: z.string().optional().describe('Mill or supplier name'),
            salesContactNo: z.string().optional().describe('Sales contact number'),
            vessel: z.string().optional().describe('Shipping vessel name'),
            pol: z.string().optional().describe('Port of Loading'),
            pod: z.string().optional().describe('Port of Destination'),
            etdShipped: z.string().optional().describe('Estimated Time of Departure'),
            etaDestination: z.string().optional().describe('Estimated Time of Arrival'),
            shippingLine: z.string().optional().describe('Shipping line company'),
            invoiceDate: z.string().optional().describe('Invoice date or TBA'),
          }),
          section: z.enum(['shipped', 'inProduction']).describe('Order status section'),
        }),
      },

      updatePurchaseOrder: {
        description: 'Update an existing purchase order',
        parameters: z.object({
          orderId: z.string().describe('Firebase document ID of the order to update'),
          updates: z.object({
            purchaseOrderNo: z.string().optional(),
            product: z.string().optional(),
            quantities: z.string().optional(),
            millName: z.string().optional(),
            salesContactNo: z.string().optional(),
            vessel: z.string().optional(),
            pol: z.string().optional(),
            pod: z.string().optional(),
            etdShipped: z.string().optional(),
            etaDestination: z.string().optional(),
            shippingLine: z.string().optional(),
            invoiceDate: z.string().optional(),
            status: z.enum(['shipped', 'inProduction']).optional(),
          }).describe('Fields to update'),
        }),
      },

      deletePurchaseOrder: {
        description: 'Delete a purchase order from the database',
        parameters: z.object({
          orderId: z.string().describe('Firebase document ID of the order to delete'),
        }),
      },

      generateReport: {
        description: 'Generate analytical reports on purchase orders data',
        parameters: z.object({
          reportType: z.enum(['summary', 'shipping', 'products']).describe('Type of report to generate'),
          filters: z.object({
            dateRange: z.string().optional().describe('Date range filter'),
            status: z.enum(['shipped', 'inProduction', 'all']).optional().describe('Status filter'),
            product: z.string().optional().describe('Product filter'),
          }).optional().describe('Optional filters for the report'),
        }),
      },

      analyzeData: {
        description: 'Perform data analysis on purchase orders',
        parameters: z.object({
          analysisType: z.enum(['delays', 'capacity', 'trends']).describe('Type of analysis to perform'),
        }),
      },
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}