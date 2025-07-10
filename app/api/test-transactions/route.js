// pages/api/test-transactions.js or app/api/test-transactions/route.js

import { NextResponse } from 'next/server';

// For App Router
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  
  if (!accountId) {
    return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
  }

  try {
    // Build query parameters
    const params = new URLSearchParams();
    
    // Optional filters
    if (searchParams.get('oldest-time')) params.append('oldest-time', searchParams.get('oldest-time'));
    if (searchParams.get('newest-time')) params.append('newest-time', searchParams.get('newest-time'));
    if (searchParams.get('min-amount')) params.append('min-amount', searchParams.get('min-amount'));
    if (searchParams.get('max-amount')) params.append('max-amount', searchParams.get('max-amount'));
    if (searchParams.get('page')) params.append('page', searchParams.get('page'));
    if (searchParams.get('page-size')) params.append('page-size', searchParams.get('page-size'));

    const queryString = params.toString();
    const url = `https://secure.api.commbank.com.au/api/cds-au/v1/banking/accounts/${accountId}/transactions${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.COMMBANK_ACCESS_TOKEN}`,
        'x-v': '1',
        'x-min-v': '1',
        'x-fapi-interaction-id': generateInteractionId(),
        'x-fapi-customer-ip-address': request.headers.get('x-forwarded-for') || '127.0.0.1',
        'x-cds-client-headers': Buffer.from(JSON.stringify({
          'User-Agent': request.headers.get('user-agent') || 'Next.js App'
        })).toString('base64')
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        error: 'API request failed',
        status: response.status,
        details: data
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      data: data,
      meta: {
        totalRecords: data.meta?.totalRecords || 0,
        totalPages: data.meta?.totalPages || 0,
        currentPage: data.meta?.currentPage || 1
      }
    });

  } catch (error) {
    console.error('Transaction fetch error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}

// For Pages Router
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, 'oldest-time': oldestTime, 'newest-time': newestTime, 
          'min-amount': minAmount, 'max-amount': maxAmount, 
          page = '1', 'page-size': pageSize = '25' } = req.query;

  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }

  try {
    const params = new URLSearchParams();
    if (oldestTime) params.append('oldest-time', oldestTime);
    if (newestTime) params.append('newest-time', newestTime);
    if (minAmount) params.append('min-amount', minAmount);
    if (maxAmount) params.append('max-amount', maxAmount);
    params.append('page', page);
    params.append('page-size', pageSize);

    const queryString = params.toString();
    const url = `https://secure.api.commbank.com.au/api/cds-au/v1/banking/accounts/${accountId}/transactions?${queryString}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.COMMBANK_ACCESS_TOKEN}`,
        'x-v': '1',
        'x-min-v': '1',
        'x-fapi-interaction-id': generateInteractionId(),
        'x-fapi-customer-ip-address': req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1',
        'x-cds-client-headers': Buffer.from(JSON.stringify({
          'User-Agent': req.headers['user-agent'] || 'Next.js App'
        })).toString('base64')
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'API request failed',
        details: data
      });
    }

    res.status(200).json({
      success: true,
      data: data,
      meta: {
        totalRecords: data.meta?.totalRecords || 0,
        totalPages: data.meta?.totalPages || 0,
        currentPage: data.meta?.currentPage || 1
      }
    });

  } catch (error) {
    console.error('Transaction fetch error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Helper function to generate interaction ID
function generateInteractionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}