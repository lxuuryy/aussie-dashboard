import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractOrderDataRequest {
    documentText: string;
    prompt: string;
}

interface ExtractOrderDataResponse {
    success: boolean;
    extractedData: unknown;
}

interface ErrorResponse {
    error: string;
    message?: string;
    rawResponse?: string;
}

export async function POST(request: Request): Promise<Response> {
    try {
        const { documentText, prompt }: ExtractOrderDataRequest = await request.json();

        if (!documentText || !prompt) {
            return NextResponse.json<ErrorResponse>({ error: 'Missing required fields' }, { status: 400 });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `You are an expert data extraction assistant. Your job is to extract structured order information from documents and return it as valid JSON. Always return valid JSON even if some information is missing - use empty strings or appropriate defaults for missing data.`
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.1,
            max_tokens: 2000,
        });

        const extractedText: string = completion.choices[0].message.content ?? '';
        
        try {
            const extractedData: unknown = JSON.parse(extractedText);
            
            return NextResponse.json<ExtractOrderDataResponse>({
                success: true,
                extractedData: extractedData
            });
        } catch (parseError) {
            console.error('Failed to parse OpenAI response as JSON:', parseError);
            return NextResponse.json<ErrorResponse>({ 
                error: 'Failed to parse extracted data',
                rawResponse: extractedText
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('OpenAI API Error:', error);
        return NextResponse.json<ErrorResponse>({ 
            error: 'Failed to extract data',
            message: error.message 
        }, { status: 500 });
    }
}