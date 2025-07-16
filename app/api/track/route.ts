// app/api/track/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = 'K-F6A989D1-67FB-457A-B2F9-D8B420E914E6';
const BASE_URL = 'https://tracking.searates.com';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const number = searchParams.get('number');
    const type = searchParams.get('type') || 'CT'; // Default to Container
    const sealine = searchParams.get('sealine') || 'auto';
    const route = searchParams.get('route') || 'true';
    const ais = searchParams.get('ais') || 'true';

    if (!number) {
      return NextResponse.json(
        { error: 'Container/BL/Booking number is required' },
        { status: 400 }
      );
    }

    // Build the API URL
    const apiUrl = new URL(`${BASE_URL}/tracking`);
    apiUrl.searchParams.append('api_key', API_KEY);
    apiUrl.searchParams.append('number', number);
    apiUrl.searchParams.append('type', type);
    apiUrl.searchParams.append('sealine', sealine);
    apiUrl.searchParams.append('route', route);
    apiUrl.searchParams.append('ais', ais);

    console.log('Fetching from:', apiUrl.toString());

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch tracking information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { number, type = 'CT', sealine = 'auto', route = true, ais = true } = body;

    if (!number) {
      return NextResponse.json(
        { error: 'Container/BL/Booking number is required' },
        { status: 400 }
      );
    }

    const apiUrl = new URL(`${BASE_URL}/tracking`);
    apiUrl.searchParams.append('api_key', API_KEY);
    apiUrl.searchParams.append('number', number);
    apiUrl.searchParams.append('type', type);
    apiUrl.searchParams.append('sealine', sealine);
    apiUrl.searchParams.append('route', route.toString());
    apiUrl.searchParams.append('ais', ais.toString());

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch tracking information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}