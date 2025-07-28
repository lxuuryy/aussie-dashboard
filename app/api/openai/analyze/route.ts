import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Input validation helper
const validateInput = (body: any) => {
  if (!body.messages || !Array.isArray(body.messages)) {
    throw new Error('Messages array is required');
  }
  
  if (body.messages.length === 0) {
    throw new Error('At least one message is required');
  }

  if (!body.messages.every((msg: any) => msg.role && msg.content)) {
    throw new Error('Each message must have role and content');
  }

  return true;
};

export async function POST(request: NextRequest) {
  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      error: 'OpenAI API key not configured',
      message: 'Please set OPENAI_API_KEY in environment variables'
    }, { status: 500 });
  }

  try {
    // Parse request body
    const body = await request.json().catch(() => null);
    
    if (!body) {
      return NextResponse.json({
        error: 'Invalid request body',
        message: 'Please provide valid JSON in request body'
      }, { status: 400 });
    }

    // Validate input
    validateInput(body);

    const { 
      messages, 
      model = 'gpt-4o',
      temperature = 0.1,
      max_tokens = 4000
    } = body;

    // Validate model
    const allowedModels = ['gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    if (!allowedModels.includes(model)) {
      return NextResponse.json({
        error: 'Invalid model',
        message: `Model must be one of: ${allowedModels.join(', ')}`
      }, { status: 400 });
    }

    // Validate temperature
    if (temperature < 0 || temperature > 2) {
      return NextResponse.json({
        error: 'Invalid temperature',
        message: 'Temperature must be between 0 and 2'
      }, { status: 400 });
    }

    // Validate max_tokens
    if (max_tokens < 1 || max_tokens > 8000) {
      return NextResponse.json({
        error: 'Invalid max_tokens',
        message: 'Max tokens must be between 1 and 8000'
      }, { status: 400 });
    }

    // Make OpenAI API call with timeout
    const completion = await Promise.race([
      openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      )
    ]) as OpenAI.Chat.Completions.ChatCompletion;

    // Validate response
    if (!completion || !completion.choices || completion.choices.length === 0) {
      return NextResponse.json({
        error: 'Invalid OpenAI response',
        message: 'OpenAI returned an invalid response'
      }, { status: 500 });
    }

    return NextResponse.json(completion);

  } catch (error) {
    console.error('OpenAI API error:', error);

    // Handle specific OpenAI errors
    if (error instanceof Error) {
      // Rate limit error
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again in a moment.'
        }, { status: 429 });
      }

      // Authentication error
      if (error.message.includes('authentication') || error.message.includes('401')) {
        return NextResponse.json({
          error: 'Authentication failed',
          message: 'Invalid OpenAI API key'
        }, { status: 401 });
      }

      // Quota exceeded
      if (error.message.includes('quota') || error.message.includes('billing')) {
        return NextResponse.json({
          error: 'Quota exceeded',
          message: 'OpenAI API quota exceeded. Please check your billing.'
        }, { status: 402 });
      }

      // Content policy violation
      if (error.message.includes('content policy') || error.message.includes('safety')) {
        return NextResponse.json({
          error: 'Content policy violation',
          message: 'The request violated OpenAI content policy'
        }, { status: 400 });
      }

      // Timeout error
      if (error.message.includes('timeout')) {
        return NextResponse.json({
          error: 'Request timeout',
          message: 'The request took too long to process. Please try again.'
        }, { status: 408 });
      }

      // Input validation errors
      if (error.message.includes('required') || error.message.includes('must have')) {
        return NextResponse.json({
          error: 'Validation error',
          message: error.message
        }, { status: 400 });
      }
    }

    // Generic error response
    return NextResponse.json({
      error: 'OpenAI API error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json({
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests'
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests'
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests'
  }, { status: 405 });
}