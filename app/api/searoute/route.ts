// app/api/searoute/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { seaRoute } from 'searoute-ts';
import { Units } from '@turf/helpers';

// Supported units mapping
const SUPPORTED_UNITS: Record<string, Units> = {
  'miles': 'miles',
  'kilometers': 'kilometers',
  'km': 'kilometers',
  'nautical': 'nauticalmiles',
  'nmi': 'nauticalmiles',
  'nauticalmiles': 'nauticalmiles'
};

// Validate coordinates are within valid ranges
function validateCoordinates(coords: number[]): boolean {
  const [lng, lat] = coords;
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

// Validate GeoJSON Point structure
function validateGeoJSONPoint(point: any): boolean {
  return (
    point &&
    point.type === 'Feature' &&
    point.geometry &&
    point.geometry.type === 'Point' &&
    Array.isArray(point.geometry.coordinates) &&
    point.geometry.coordinates.length === 2 &&
    typeof point.geometry.coordinates[0] === 'number' &&
    typeof point.geometry.coordinates[1] === 'number'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, destination, units = 'kilometers' } = body;

    console.log('🗺️ Searoute API request:', {
      origin: origin?.geometry?.coordinates,
      destination: destination?.geometry?.coordinates,
      units
    });

    // Validate required fields
    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'Origin and destination are required' },
        { status: 400 }
      );
    }

    // Validate GeoJSON structure
    if (!validateGeoJSONPoint(origin)) {
      return NextResponse.json(
        { 
          error: 'Invalid origin format. Expected GeoJSON Point Feature',
          example: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: {}
          }
        },
        { status: 400 }
      );
    }

    if (!validateGeoJSONPoint(destination)) {
      return NextResponse.json(
        { 
          error: 'Invalid destination format. Expected GeoJSON Point Feature',
          example: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: {}
          }
        },
        { status: 400 }
      );
    }

    // Validate coordinates
    if (!validateCoordinates(origin.geometry.coordinates)) {
      return NextResponse.json(
        { 
          error: 'Invalid origin coordinates. Longitude must be -180 to 180, latitude must be -90 to 90',
          received: origin.geometry.coordinates
        },
        { status: 400 }
      );
    }

    if (!validateCoordinates(destination.geometry.coordinates)) {
      return NextResponse.json(
        { 
          error: 'Invalid destination coordinates. Longitude must be -180 to 180, latitude must be -90 to 90',
          received: destination.geometry.coordinates
        },
        { status: 400 }
      );
    }

    // Normalize and validate units
    const normalizedUnits = SUPPORTED_UNITS[units.toLowerCase()];
    if (!normalizedUnits) {
      return NextResponse.json(
        { 
          error: 'Unsupported units. Supported: miles, kilometers, nautical',
          supported: Object.keys(SUPPORTED_UNITS),
          received: units
        },
        { status: 400 }
      );
    }

    // Calculate route
    console.log('🚢 Calculating sea route...');
    const startTime = Date.now();
    
    const route = seaRoute(origin, destination, normalizedUnits);
    
    const calculationTime = Date.now() - startTime;
    console.log(`✅ Route calculated in ${calculationTime}ms`);

    // Validate route result
    if (!route) {
      return NextResponse.json(
        { error: 'Failed to calculate route - no route returned' },
        { status: 500 }
      );
    }

    if (!route.geometry || !route.geometry.coordinates) {
      return NextResponse.json(
        { error: 'Invalid route geometry returned' },
        { status: 500 }
      );
    }

    // Extract route information
    const routeLength = route.properties?.length || 0;
    const coordinateCount = route.geometry.coordinates?.length || 0;

    console.log('📊 Route details:', {
      length: routeLength,
      units: normalizedUnits,
      coordinates: coordinateCount,
      calculationTime: `${calculationTime}ms`
    });

    return NextResponse.json({
      success: true,
      route,
      metadata: {
        distance: routeLength,
        units: normalizedUnits,
        originalUnits: units,
        coordinateCount,
        calculationTime,
        origin: origin.geometry.coordinates,
        destination: destination.geometry.coordinates
      }
    });

  } catch (error: any) {
    console.error('❌ Searoute calculation error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Handle specific searoute-ts errors
    if (error.message?.includes('Invalid coordinates')) {
      return NextResponse.json(
        {
          error: 'Invalid coordinates provided',
          details: error.message,
          hint: 'Ensure coordinates are in [longitude, latitude] format with valid ranges'
        },
        { status: 400 }
      );
    }

    if (error.message?.includes('No route found')) {
      return NextResponse.json(
        {
          error: 'No sea route found between the specified points',
          details: error.message,
          hint: 'The points may be on land or too close to coastlines'
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to calculate sea route',
        details: error.message || 'Unknown error occurred',
        type: error.name || 'UnknownError'
      },
      { status: 500 }
    );
  }
}

// GET method for testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Example: /api/searoute?from=103.8198,1.3521&to=100.3161,5.4164&units=kilometers
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const units = searchParams.get('units') || 'kilometers';

  if (!from || !to) {
    return NextResponse.json(
      { 
        error: 'Missing parameters',
        usage: '/api/searoute?from=lng,lat&to=lng,lat&units=kilometers',
        example: '/api/searoute?from=103.8198,1.3521&to=100.3161,5.4164&units=kilometers'
      },
      { status: 400 }
    );
  }

  try {
    const [fromLng, fromLat] = from.split(',').map(Number);
    const [toLng, toLat] = to.split(',').map(Number);

    if (isNaN(fromLng) || isNaN(fromLat) || isNaN(toLng) || isNaN(toLat)) {
      return NextResponse.json(
        { error: 'Invalid coordinate format. Use: lng,lat' },
        { status: 400 }
      );
    }

    const origin = {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [fromLng, fromLat]
      },
      properties: {}
    };

    const destination = {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [toLng, toLat]
      },
      properties: {}
    };

    // Reuse POST logic
    return POST(new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ origin, destination, units }),
      headers: { 'Content-Type': 'application/json' }
    }));

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: error.message },
      { status: 400 }
    );
  }
}