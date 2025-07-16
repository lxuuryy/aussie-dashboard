// File: app/api/visiwise/route.js (App Router)

import { NextResponse } from 'next/server';

export async function POST(request) {
  const VISIWISE_API_URL = 'https://www.visiwise.co/api-graphql/';
  const API_TOKEN = '303d880f2196dfe75506586209cfc5e534f07384';

  try {
    const body = await request.json();
    
    console.log('📦 Visiwise API Request:', {
      url: VISIWISE_API_URL,
      token: API_TOKEN ? `${API_TOKEN.substring(0, 10)}...` : 'NO TOKEN',
      query: body.query?.substring(0, 100) + '...',
      variables: body.variables
    });
    
    const response = await fetch(VISIWISE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_TOKEN}`,
        'User-Agent': 'NextJS-App/1.0',
      },
      body: JSON.stringify(body),
    });

    console.log('📡 Visiwise API Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    const data = await response.json();
    console.log('📄 Response Data (detailed):', JSON.stringify(data, null, 2));
    
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error) {
    console.error('❌ Visiwise API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to connect to Visiwise API',
      details: error.message 
    }, { status: 500 });
  }
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}