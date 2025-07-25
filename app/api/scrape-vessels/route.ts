// app/api/scrape-vessels/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface VesselMovement {
  date: string;
  time: string;
  expected: string;
  arrivalDeparture: string;
  vesselName: string;
  vesselType: string;
  agent: string;
  from: string;
  to: string;
  inPort: string;
}

interface ProcessedVesselData {
  totalMovements: number;
  arrivals: number;
  departures: number;
  shifts: number;
  vesselTypes: { [key: string]: number };
  busyBerths: string[];
  upcomingArrivals: VesselMovement[];
  recentDepartures: VesselMovement[];
  analysis: any;
}

// Scrape Newcastle vessel movements
async function scrapeNewcastleVessels(): Promise<VesselMovement[]> {
  try {
    const response = await fetch(
      'https://www.portauthoritynsw.com.au/port-operations/newcastle-harbour/newcastle-harbour-daily-vessel-movements',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const movements: VesselMovement[] = [];
    
    $('table tr').each((index, row) => {
      if (index === 0) return; // Skip header row
      
      const cells = $(row).find('td');
      if (cells.length >= 9) {
        const dateTime = $(cells[0]).text().trim();
        const [datePart, timePart] = dateTime.split(' ');
        
        const movement: VesselMovement = {
          date: datePart || '',
          time: timePart || '',
          expected: $(cells[1]).text().trim(),
          arrivalDeparture: $(cells[2]).text().trim(),
          vesselName: $(cells[3]).text().trim(),
          vesselType: $(cells[4]).text().trim(),
          agent: $(cells[5]).text().trim(),
          from: $(cells[6]).text().trim(),
          to: $(cells[7]).text().trim(),
          inPort: $(cells[8]).text().trim(),
        };
        
        if (movement.vesselName && movement.arrivalDeparture) {
          movements.push(movement);
        }
      }
    });

    return movements;
  } catch (error) {
    console.error('Error scraping Newcastle vessels:', error);
    throw new Error(`Failed to scrape Newcastle vessel data: ${error}`);
  }
}

// Scrape Sydney Harbour vessel movements
async function scrapeSydneyVessels(): Promise<VesselMovement[]> {
  try {
    const response = await fetch(
      'https://www.portauthoritynsw.com.au/port-operations/sydney-harbour/sydney-harbour-daily-vessel-movements',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const movements: VesselMovement[] = [];
    
    $('table tr').each((index, row) => {
      if (index === 0) return; // Skip header row
      
      const cells = $(row).find('td');
      if (cells.length >= 9) {
        const dateTime = $(cells[0]).text().trim();
        const [datePart, timePart] = dateTime.split(' ');
        
        const movement: VesselMovement = {
          date: datePart || '',
          time: timePart || '',
          expected: $(cells[1]).text().trim(),
          arrivalDeparture: $(cells[2]).text().trim(),
          vesselName: $(cells[3]).text().trim(),
          vesselType: $(cells[4]).text().trim(),
          agent: $(cells[5]).text().trim(),
          from: $(cells[6]).text().trim(),
          to: $(cells[7]).text().trim(),
          inPort: $(cells[8]).text().trim(),
        };
        
        if (movement.vesselName && movement.arrivalDeparture) {
          movements.push(movement);
        }
      }
    });

    return movements;
  } catch (error) {
    console.error('Error scraping Sydney vessels:', error);
    throw new Error(`Failed to scrape Sydney vessel data: ${error}`);
  }
}

function processVesselData(movements: VesselMovement[]): ProcessedVesselData {
  const arrivals = movements.filter(m => m.arrivalDeparture.toLowerCase().includes('arrival'));
  const departures = movements.filter(m => m.arrivalDeparture.toLowerCase().includes('departure'));
  const shifts = movements.filter(m => m.arrivalDeparture.toLowerCase().includes('shift'));
  
  // Count vessel types
  const vesselTypes: { [key: string]: number } = {};
  movements.forEach(movement => {
    const type = movement.vesselType || 'Unknown';
    vesselTypes[type] = (vesselTypes[type] || 0) + 1;
  });
  
  // Find busy berths/terminals
  const berthCounts: { [key: string]: number } = {};
  movements.forEach(movement => {
    // Extract berth codes from parentheses for Newcastle (K8, D2, etc.)
    // Extract terminal names for Sydney (Overseas Passenger Terminal, etc.)
    const berth = movement.to.match(/\(([^)]+)\)/)?.[1] || 
                 movement.from.match(/\(([^)]+)\)/)?.[1] ||
                 movement.to || movement.from;
    if (berth) {
      berthCounts[berth] = (berthCounts[berth] || 0) + 1;
    }
  });
  
  const busyBerths = Object.entries(berthCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([berth]) => berth);
  
  const upcomingArrivals = arrivals.slice(0, 10);
  const recentDepartures = departures.slice(-10);

  return {
    totalMovements: movements.length,
    arrivals: arrivals.length,
    departures: departures.length,
    shifts: shifts.length,
    vesselTypes,
    busyBerths,
    upcomingArrivals,
    recentDepartures,
    analysis: null,
  };
}

async function analyzePortData(newcastleData: ProcessedVesselData, sydneyData: ProcessedVesselData, newcastleMovements: VesselMovement[], sydneyMovements: VesselMovement[]) {
  try {
    const prompt = `
      Analyze this vessel movement data for Newcastle and Sydney Harbour ports:

      NEWCASTLE HARBOUR:
      - Total Movements: ${newcastleData.totalMovements}
      - Arrivals: ${newcastleData.arrivals}
      - Departures: ${newcastleData.departures}
      - Shifts: ${newcastleData.shifts}
      - Vessel Types: ${JSON.stringify(newcastleData.vesselTypes, null, 2)}
      - Busiest Berths: ${newcastleData.busyBerths.join(', ')}
      
      SYDNEY HARBOUR:
      - Total Movements: ${sydneyData.totalMovements}
      - Arrivals: ${sydneyData.arrivals}
      - Departures: ${sydneyData.departures}
      - Shifts: ${sydneyData.shifts}
      - Vessel Types: ${JSON.stringify(sydneyData.vesselTypes, null, 2)}
      - Busiest Terminals: ${sydneyData.busyBerths.join(', ')}
      
      Sample Newcastle Movements: ${JSON.stringify(newcastleMovements.slice(0, 10), null, 2)}
      Sample Sydney Movements: ${JSON.stringify(sydneyMovements.slice(0, 10), null, 2)}

      Provide analysis in JSON format with these keys:
      {
        "newcastle_analysis": {
          "port_activity_level": "low/moderate/high/very_high",
          "dominant_vessel_type": "most common vessel type",
          "busiest_berths_analysis": "analysis of berth utilization",
          "trade_routes": ["main origin/destination countries"],
          "operational_insights": ["key operational observations"],
          "cargo_focus": "primary cargo types handled"
        },
        "sydney_analysis": {
          "port_activity_level": "low/moderate/high/very_high", 
          "dominant_vessel_type": "most common vessel type",
          "busiest_terminals_analysis": "analysis of terminal usage",
          "trade_routes": ["main origin/destination locations"],
          "operational_insights": ["key operational observations"],
          "port_characteristics": "unique characteristics of Sydney operations"
        },
        "comparative_analysis": {
          "activity_comparison": "comparison of activity levels between ports",
          "vessel_type_differences": "differences in vessel types between ports",
          "operational_differences": "key operational differences",
          "strategic_insights": ["strategic insights about NSW port operations"],
          "recommendations": ["recommendations for both ports"]
        }
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a maritime operations expert analyzing vessel movements across multiple ports. Provide detailed comparative analysis."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2500,
      temperature: 0.1,
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Analysis error:', error);
    return {
      error: 'Failed to analyze port data',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analyze = searchParams.get('analyze') === 'true';
    const port = searchParams.get('port') || 'both'; // 'newcastle', 'sydney', or 'both'

    let newcastleData: VesselMovement[] = [];
    let sydneyData: VesselMovement[] = [];

    // Scrape based on port parameter
    if (port === 'newcastle' || port === 'both') {
      console.log('Scraping Newcastle vessel movements...');
      newcastleData = await scrapeNewcastleVessels();
    }

    if (port === 'sydney' || port === 'both') {
      console.log('Scraping Sydney vessel movements...');
      sydneyData = await scrapeSydneyVessels();
    }
    
    if (newcastleData.length === 0 && sydneyData.length === 0) {
      return NextResponse.json({
        error: 'No vessel movement data found. The website structure may have changed.',
      }, { status: 404 });
    }

    // Process the data
    const processedNewcastle = newcastleData.length > 0 ? processVesselData(newcastleData) : null;
    const processedSydney = sydneyData.length > 0 ? processVesselData(sydneyData) : null;
    
    let combinedAnalysis = null;
    
    // Add AI analysis if requested
    if (analyze && processedNewcastle && processedSydney) {
      console.log('Analyzing port data with OpenAI...');
      combinedAnalysis = await analyzePortData(
        processedNewcastle, 
        processedSydney, 
        newcastleData, 
        sydneyData
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        scraped_at: new Date().toISOString(),
        ports_included: port,
        newcastle: processedNewcastle ? {
          source: 'Port Authority NSW - Newcastle Harbour',
          raw_movements: newcastleData,
          processed_data: { 
            ...processedNewcastle, 
            analysis: combinedAnalysis?.newcastle_analysis || null 
          }
        } : null,
        sydney: processedSydney ? {
          source: 'Port Authority NSW - Sydney Harbour',
          raw_movements: sydneyData,
          processed_data: { 
            ...processedSydney, 
            analysis: combinedAnalysis?.sydney_analysis || null 
          }
        } : null,
        comparative_analysis: combinedAnalysis?.comparative_analysis || null
      },
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape vessel data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { filters, port = 'both' } = await request.json();
    
    let newcastleData: VesselMovement[] = [];
    let sydneyData: VesselMovement[] = [];

    // Scrape based on port parameter
    if (port === 'newcastle' || port === 'both') {
      newcastleData = await scrapeNewcastleVessels();
    }

    if (port === 'sydney' || port === 'both') {
      sydneyData = await scrapeSydneyVessels();
    }
    
    // Apply filters if provided
    let filteredNewcastle = newcastleData;
    let filteredSydney = sydneyData;
    
    if (filters) {
      if (filters.vesselType) {
        if (filteredNewcastle.length > 0) {
          filteredNewcastle = filteredNewcastle.filter(m => 
            m.vesselType.toLowerCase().includes(filters.vesselType.toLowerCase())
          );
        }
        if (filteredSydney.length > 0) {
          filteredSydney = filteredSydney.filter(m => 
            m.vesselType.toLowerCase().includes(filters.vesselType.toLowerCase())
          );
        }
      }
      
      if (filters.movementType) {
        if (filteredNewcastle.length > 0) {
          filteredNewcastle = filteredNewcastle.filter(m => 
            m.arrivalDeparture.toLowerCase().includes(filters.movementType.toLowerCase())
          );
        }
        if (filteredSydney.length > 0) {
          filteredSydney = filteredSydney.filter(m => 
            m.arrivalDeparture.toLowerCase().includes(filters.movementType.toLowerCase())
          );
        }
      }
      
      if (filters.agent) {
        if (filteredNewcastle.length > 0) {
          filteredNewcastle = filteredNewcastle.filter(m => 
            m.agent.toLowerCase().includes(filters.agent.toLowerCase())
          );
        }
        if (filteredSydney.length > 0) {
          filteredSydney = filteredSydney.filter(m => 
            m.agent.toLowerCase().includes(filters.agent.toLowerCase())
          );
        }
      }
      
      if (filters.destination) {
        if (filteredNewcastle.length > 0) {
          filteredNewcastle = filteredNewcastle.filter(m => 
            m.from.toLowerCase().includes(filters.destination.toLowerCase()) ||
            m.to.toLowerCase().includes(filters.destination.toLowerCase())
          );
        }
        if (filteredSydney.length > 0) {
          filteredSydney = filteredSydney.filter(m => 
            m.from.toLowerCase().includes(filters.destination.toLowerCase()) ||
            m.to.toLowerCase().includes(filters.destination.toLowerCase())
          );
        }
      }
    }

    const processedNewcastle = filteredNewcastle.length > 0 ? processVesselData(filteredNewcastle) : null;
    const processedSydney = filteredSydney.length > 0 ? processVesselData(filteredSydney) : null;
    
    // Always analyze for POST requests if we have data for both ports
    let combinedAnalysis = null;
    if (processedNewcastle && processedSydney) {
      combinedAnalysis = await analyzePortData(
        processedNewcastle, 
        processedSydney, 
        filteredNewcastle, 
        filteredSydney
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        scraped_at: new Date().toISOString(),
        filters_applied: filters,
        ports_included: port,
        total_found: {
          newcastle: newcastleData.length,
          sydney: sydneyData.length
        },
        filtered_results: {
          newcastle: filteredNewcastle.length,
          sydney: filteredSydney.length
        },
        newcastle: processedNewcastle ? {
          source: 'Port Authority NSW - Newcastle Harbour',
          movements: filteredNewcastle,
          analysis: { 
            ...processedNewcastle, 
            analysis: combinedAnalysis?.newcastle_analysis || null 
          }
        } : null,
        sydney: processedSydney ? {
          source: 'Port Authority NSW - Sydney Harbour',
          movements: filteredSydney,
          analysis: { 
            ...processedSydney, 
            analysis: combinedAnalysis?.sydney_analysis || null 
          }
        } : null,
        comparative_analysis: combinedAnalysis?.comparative_analysis || null
      },
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process vessel data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}