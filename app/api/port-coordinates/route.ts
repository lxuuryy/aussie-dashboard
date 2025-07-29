// app/api/port-coordinates/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(request: NextRequest) {
  try {
    const { portName } = await request.json();

    if (!portName || typeof portName !== 'string') {
      return NextResponse.json(
        { error: 'Port name is required and must be a string' },
        { status: 400 }
      );
    }

    console.log(`🌍 Getting coordinates for port: ${portName}`);

    const { text } = await generateText({
      model: openai('gpt-4o'),
      messages: [
        {
          role: 'system',
          content: 'You are a maritime logistics expert. Given a port name, provide its exact coordinates in the format "longitude,latitude" (e.g., "101.3984,3.0064"). Respond with ONLY the coordinates in this exact format with no additional text or explanation.'
        },
        {
          role: 'user',
          content: `What are the coordinates for port: ${portName.trim()}`
        }
      ],
      maxTokens: 20,
      temperature: 0.1
    });

    const coordinates = text.trim();
    
    // Validate coordinate format (longitude,latitude)
    const coordPattern = /^-?\d+\.?\d*,-?\d+\.?\d*$/;
    if (!coordPattern.test(coordinates)) {
      console.warn('⚠️ Invalid coordinate format received:', coordinates);
      return NextResponse.json(
        { error: 'Invalid coordinate format received from AI' },
        { status: 500 }
      );
    }

    // Validate coordinate ranges
    const [lng, lat] = coordinates.split(',').map(Number);
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      console.warn('⚠️ Coordinates out of valid range:', coordinates);
      return NextResponse.json(
        { error: 'Coordinates out of valid range' },
        { status: 500 }
      );
    }

    console.log('✅ Found coordinates for', portName, ':', coordinates);

    return NextResponse.json({
      success: true,
      portName: portName.trim(),
      coordinates,
      longitude: lng,
      latitude: lat
    });

  } catch (error) {
    console.error('❌ Port coordinates API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get port coordinates', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// GET method for testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const portName = searchParams.get('port');

  if (!portName) {
    return NextResponse.json(
      { error: 'Port name query parameter is required' },
      { status: 400 }
    );
  }

  // Reuse POST logic
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ portName }),
    headers: { 'Content-Type': 'application/json' }
  }));
}