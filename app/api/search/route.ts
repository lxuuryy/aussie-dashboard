// app/api/search/route.ts
import { generateText } from 'ai';
import { perplexity } from '@ai-sdk/perplexity';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    const { text, sources } = await generateText({
      model: perplexity('sonar-pro'),
      prompt: `Provide a comprehensive analysis of: ${query}. Include detailed information, key insights, and relevant context.`,
    });

    return NextResponse.json({
      success: true,
      response: text,
      sources: sources || [],
      mode: 'perplexity',
    });
    
  } catch (error: any) {
    console.error('Perplexity API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}

// Optional: Add GET method for health check
export async function GET() {
  return NextResponse.json({ 
    message: 'Perplexity Search API is running',
    status: 'healthy' 
  });
}