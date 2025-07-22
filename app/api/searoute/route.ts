import { NextResponse } from 'next/server';
import { seaRoute } from 'searoute-ts';
import { Units } from '@turf/helpers';

export async function POST(request: Request) {
  try {
    const { origin, destination, units = 'miles' } = await request.json();
    
    // Validate input
    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'Origin and destination are required' },
        { status: 400 }
      );
    }

    // Validate GeoJSON structure
    if (!origin.geometry?.coordinates || !destination.geometry?.coordinates) {
      return NextResponse.json(
        { error: 'Invalid GeoJSON format. Points must have geometry.coordinates' },
        { status: 400 }
      );
    }

    // Map 'nautical' to 'nmi' to match searoute-ts Units type
    const normalizedUnits = units === 'nautical' ? 'nmi' : units;
    const route = seaRoute(origin, destination, normalizedUnits as Units);
    
    return NextResponse.json({ 
      success: true, 
      route,
      distance: route.properties?.length || 0,
      units: units
    });
    
  } catch (error: any) {
    console.error('Searoute-TS calculation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to calculate sea route', 
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
