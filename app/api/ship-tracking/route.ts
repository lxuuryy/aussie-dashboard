import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

interface VesselData {
  event: string;
  time: string;
  port: string;
  vesselName: string;
  vesselLink: string;
  mmsi: string;
  imo: string;
  flag: string;
  vesselType: string;
}

interface ApiResponse {
  success: boolean;
  data?: VesselData[];
  totalResults?: number;
  error?: string;
  timestamp: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const portId = searchParams.get('pid') || '409'; // Default to Sydney port
    
    const url = `https://www.myshiptracking.com/ports-arrivals-departures/?pid=${portId}`;
    
    console.log(`Fetching data from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const vessels: VesselData[] = [];
    
    // Look for the table structure - the data appears to be in a table format
    $('table tr').each((index, element) => {
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 4) {
        const eventCell = $(cells[0]);
        const timeCell = $(cells[1]);
        const portCell = $(cells[2]);
        const vesselCell = $(cells[3]);
        
        const event = eventCell.text().trim();
        const time = timeCell.text().trim();
        const port = portCell.text().trim();
        
        // Extract vessel information
        const vesselLink = vesselCell.find('a').first();
        const vesselName = vesselLink.text().trim();
        const vesselHref = vesselLink.attr('href') || '';
        
        // Extract MMSI and IMO from the vessel link
        const mmsiMatch = vesselHref.match(/mmsi-(\d+)/);
        const imoMatch = vesselHref.match(/imo-(\d+)/);
        
        const mmsi = mmsiMatch ? mmsiMatch[1] : '';
        const imo = imoMatch ? imoMatch[1] : '';
        
        // Extract flag information
        const flagImg = vesselCell.find('img[src*="flags"]');
        const flagSrc = flagImg.attr('src') || '';
        const flagMatch = flagSrc.match(/\/([A-Z]{2})\.png$/);
        const flag = flagMatch ? flagMatch[1] : '';
        
        // Extract vessel type from icon
        const typeIcon = vesselCell.find('img[src*="icon"]');
        const typeIconSrc = typeIcon.attr('src') || '';
        const vesselType = getVesselTypeFromIcon(typeIconSrc);
        
        // Only add if we have valid data
        if (event && time && vesselName && (event === 'Arrival' || event === 'Departure')) {
          vessels.push({
            event,
            time,
            port: port || 'SYDNEY',
            vesselName,
            vesselLink: vesselHref ? `https://www.myshiptracking.com${vesselHref}` : '',
            mmsi,
            imo,
            flag,
            vesselType
          });
        }
      }
    });
    
    // Alternative parsing method if table structure is different
    if (vessels.length === 0) {
      // Look for individual vessel entries in the content
      const content = $.root().text();
      const lines = content.split('\n').filter(line => line.trim());
      
      let currentEvent = '';
      let currentTime = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === 'Arrival' || line === 'Departure') {
          currentEvent = line;
          // Next line should be the time
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
              currentTime = nextLine;
            }
          }
        }
        
        // Look for vessel links in the HTML
        $('a[href*="/vessels/"]').each((index, element) => {
          const $link = $(element);
          const vesselName = $link.text().trim();
          const vesselHref = $link.attr('href') || '';
          
          if (vesselName) {
            const mmsiMatch = vesselHref.match(/mmsi-(\d+)/);
            const imoMatch = vesselHref.match(/imo-(\d+)/);
            
            vessels.push({
              event: currentEvent || 'Arrival',
              time: currentTime || new Date().toISOString().slice(0, 16).replace('T', ' '),
              port: 'SYDNEY',
              vesselName,
              vesselLink: `https://www.myshiptracking.com${vesselHref}`,
              mmsi: mmsiMatch ? mmsiMatch[1] : '',
              imo: imoMatch ? imoMatch[1] : '',
              flag: 'AU',
              vesselType: 'Unknown'
            });
          }
        });
      }
    }
    
    // Remove duplicates based on vessel name and time
    const uniqueVessels = vessels.filter((vessel, index, self) => 
      index === self.findIndex(v => v.vesselName === vessel.vesselName && v.time === vessel.time)
    );
    
    // Sort by time (most recent first)
    uniqueVessels.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    
    // Extract total results count if available
    const totalResultsText = $('body').text();
    const totalMatch = totalResultsText.match(/Showing \d+ - \d+ of (\d+) Results/);
    const totalResults = totalMatch ? parseInt(totalMatch[1]) : uniqueVessels.length;
    
    console.log(`Successfully scraped ${uniqueVessels.length} vessels`);
    
    return NextResponse.json({
      success: true,
      data: uniqueVessels,
      totalResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error scraping ship tracking data:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const { portId = '409' } = body;
    
    // Instead of redirect, return a JSON response with the new URL for client-side navigation
    const url = new URL(request.url);
    url.searchParams.set('pid', portId.toString());

    return NextResponse.json({
      success: true,
      data: [],
      totalResults: 0,
      timestamp: new Date().toISOString(),
      error: undefined
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Invalid request body',
      timestamp: new Date().toISOString()
    });
  }
}

function getVesselTypeFromIcon(iconSrc: string): string {
  if (!iconSrc) return 'Unknown';
  
  // Map icon numbers to vessel types based on common patterns
  if (iconSrc.includes('icon0_')) return 'Ferry';
  if (iconSrc.includes('icon1_')) return 'Cargo Ship';
  if (iconSrc.includes('icon2_')) return 'Tanker';
  if (iconSrc.includes('icon3_')) return 'Container Ship';
  if (iconSrc.includes('icon4_')) return 'Bulk Carrier';
  if (iconSrc.includes('icon5_')) return 'Cruise Ship';
  if (iconSrc.includes('icon6_')) return 'Passenger Vessel';
  if (iconSrc.includes('icon7_')) return 'Fishing Vessel';
  if (iconSrc.includes('icon8_')) return 'Tugboat';
  if (iconSrc.includes('icon9_')) return 'Military Vessel';
  if (iconSrc.includes('icon10_')) return 'Yacht';
  
  return 'Other';
}