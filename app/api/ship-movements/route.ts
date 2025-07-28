// app/api/ship-movements/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

interface ShipMovement {
  vessel: string;
  arrived: string;
  dwt: string;
  grt: string;
  built: string;
  size: string;
  vesselType?: string;
  flag?: string;
}

interface ExpectedArrival {
  mmsi: string;
  vessel: string;
  flag: string;
  port: string;
  estimatedArrival: string;
}

interface PortData {
  port: string;
  lastUpdated: string;
  totalShips: number;
  movements: ShipMovement[];
  expectedArrivals: {
    total: number;
    ships: ExpectedArrival[];
  };
}

async function scrapeInPort(): Promise<{ total: number; ships: ShipMovement[] }> {
  try {
    const response = await fetch('https://www.myshiptracking.com/inport?pid=293', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.myshiptracking.com/',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const movements: ShipMovement[] = [];
    
    // Find the table containing ship data
    $('table').each((tableIndex, table) => {
      const $table = $(table);
      
      // Look for table rows with ship data
      $table.find('tr').each((rowIndex, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 6) {
          // Extract data from each cell
          const vesselCell = $(cells[0]);
          const arrivedCell = $(cells[1]);
          const dwtCell = $(cells[2]);
          const grtCell = $(cells[3]);
          const builtCell = $(cells[4]);
          const sizeCell = $(cells[5]);
          
          // Get vessel name (might be in an img alt or adjacent text)
          let vesselName = vesselCell.text().trim();
          if (!vesselName) {
            // Try to get from img alt attribute
            const img = vesselCell.find('img');
            if (img.length) {
              vesselName = img.attr('alt') || img.attr('title') || 'Unknown Vessel';
            }
          }
          
          const arrived = arrivedCell.text().trim();
          const dwt = dwtCell.text().trim();
          const grt = grtCell.text().trim();
          const built = builtCell.text().trim();
          const size = sizeCell.text().trim();
          
          // Only add if we have meaningful data (at least arrival time)
          if (arrived && arrived.match(/\d{4}-\d{2}-\d{2}/)) {
            movements.push({
              vessel: vesselName || `Vessel ${movements.length + 1}`,
              arrived,
              dwt: dwt || '---',
              grt: grt || '---',
              built: built || '---',
              size: size || '---',
            });
          }
        }
      });
    });

    // If table parsing didn't work, try alternative parsing
    if (movements.length === 0) {
      // Look for specific patterns in the HTML
      const lines = html.split('\n');
      let currentVessel: Partial<ShipMovement> = {};
      
      lines.forEach(line => {
        const cleanLine = line.trim();
        
        // Look for date patterns (arrival times)
        const dateMatch = cleanLine.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
        if (dateMatch) {
          if (currentVessel.arrived) {
            // Save previous vessel if it has data
            if (Object.keys(currentVessel).length > 1) {
              movements.push({
                vessel: currentVessel.vessel || `Vessel ${movements.length + 1}`,
                arrived: currentVessel.arrived || '',
                dwt: currentVessel.dwt || '---',
                grt: currentVessel.grt || '---',
                built: currentVessel.built || '---',
                size: currentVessel.size || '---',
              });
            }
          }
          currentVessel = { arrived: dateMatch[1] };
        }
        
        // Look for tonnage patterns
        const tonnageMatch = cleanLine.match(/(\d{1,3}(?:,\d{3})*)\s*Tons/);
        if (tonnageMatch && currentVessel.arrived) {
          if (!currentVessel.dwt || currentVessel.dwt === '---') {
            currentVessel.dwt = tonnageMatch[1] + ' Tons';
          } else if (!currentVessel.grt || currentVessel.grt === '---') {
            currentVessel.grt = tonnageMatch[1] + ' Tons';
          }
        }
        
        // Look for size patterns
        const sizeMatch = cleanLine.match(/(\d+)\s*m/);
        if (sizeMatch && currentVessel.arrived && (!currentVessel.size || currentVessel.size === '---')) {
          currentVessel.size = sizeMatch[1] + ' m';
        }
        
        // Look for build year
        const yearMatch = cleanLine.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch && currentVessel.arrived && (!currentVessel.built || currentVessel.built === '---')) {
          currentVessel.built = yearMatch[1];
        }
      });
      
      // Don't forget the last vessel
      if (currentVessel.arrived && Object.keys(currentVessel).length > 1) {
        movements.push({
          vessel: currentVessel.vessel || `Vessel ${movements.length + 1}`,
          arrived: currentVessel.arrived || '',
          dwt: currentVessel.dwt || '---',
          grt: currentVessel.grt || '---',
          built: currentVessel.built || '---',
          size: currentVessel.size || '---',
        });
      }
    }

    // Extract total count if available
    let totalShips = movements.length;
    const totalMatch = html.match(/Showing\s+\d+\s*-\s*\d+\s+of\s+(\d+)\s+Results/i);
    if (totalMatch) {
      totalShips = parseInt(totalMatch[1]);
    }

    return { total: totalShips, ships: movements.slice(0, 50) };
  } catch (error) {
    console.error('Error scraping in-port data:', error);
    return { total: 0, ships: [] };
  }
}

async function scrapeExpectedArrivals(): Promise<{ total: number; ships: ExpectedArrival[] }> {
  try {
    const response = await fetch('https://www.myshiptracking.com/estimate?pid=293', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.myshiptracking.com/',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const arrivals: ExpectedArrival[] = [];

    // Look for table rows with expected arrival data
    $('table tr').each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 4) {
        const mmsiCell = $(cells[0]);
        const vesselCell = $(cells[1]);
        const portCell = $(cells[2]);
        const etaCell = $(cells[3]);
        
        const mmsi = mmsiCell.text().trim();
        const vesselText = vesselCell.text().trim();
        const port = portCell.text().trim();
        const eta = etaCell.text().trim();
        
        // Extract vessel name and flag from the vessel cell
        const vesselMatch = vesselText.match(/([A-Z\s]+)\[([A-Z]{2})\]/);
        let vesselName = vesselText;
        let flag = '';
        
        if (vesselMatch) {
          vesselName = vesselMatch[1].trim();
          flag = vesselMatch[2];
        }
        
        if (mmsi && mmsi.match(/^\d+$/)) {
          arrivals.push({
            mmsi,
            vessel: vesselName || 'Unknown Vessel',
            flag: flag || 'Unknown',
            port: port || 'MELBOURNE',
            estimatedArrival: eta || 'Unknown',
          });
        }
      }
    });

    // Alternative parsing if table method doesn't work
    if (arrivals.length === 0) {
      const lines = html.split('\n');
      
      lines.forEach(line => {
        const cleanLine = line.trim();
        
        // Look for MMSI numbers
        const mmsiMatch = cleanLine.match(/(\d{9})/);
        if (mmsiMatch) {
          const mmsi = mmsiMatch[1];
          
          // Try to find vessel name in surrounding context
          const vesselMatch = cleanLine.match(/([A-Z\s]+)\[([A-Z]{2})\]/);
          if (vesselMatch) {
            arrivals.push({
              mmsi,
              vessel: vesselMatch[1].trim(),
              flag: vesselMatch[2],
              port: 'MELBOURNE',
              estimatedArrival: 'TBA',
            });
          }
        }
      });
    }

    // Extract total count
    let total = arrivals.length;
    const totalMatch = html.match(/Showing\s+\d+\s*-\s*\d+\s+of\s+(\d+)\s+Results/i);
    if (totalMatch) {
      total = parseInt(totalMatch[1]);
    }

    return { total, ships: arrivals };
  } catch (error) {
    console.error('Error scraping expected arrivals:', error);
    return { total: 0, ships: [] };
  }
}

export async function GET() {
  try {
    const [inPortData, expectedArrivalsData] = await Promise.all([
      scrapeInPort(),
      scrapeExpectedArrivals()
    ]);

    const portData: PortData = {
      port: 'Port Melbourne (MyShipTracking)',
      lastUpdated: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' }),
      totalShips: inPortData.total,
      movements: inPortData.ships,
      expectedArrivals: expectedArrivalsData,
    };

    if (inPortData.ships.length === 0) {
      return NextResponse.json({
        port: 'Port Melbourne (MyShipTracking)',
        lastUpdated: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' }),
        totalShips: 0,
        movements: [{
          vessel: 'No data available',
          arrived: 'N/A',
          dwt: 'N/A',
          grt: 'N/A',
          built: 'N/A',
          size: 'N/A',
        }],
        expectedArrivals: expectedArrivalsData,
      });
    }

    return NextResponse.json(portData);
  } catch (error) {
    console.error('Error scraping ship data:', error);
    return NextResponse.json({
      port: 'Error',
      lastUpdated: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' }),
      totalShips: 0,
      movements: [{
        vessel: 'Error fetching data',
        arrived: 'N/A',
        dwt: 'N/A',
        grt: 'N/A',
        built: 'N/A',
        size: 'N/A',
      }],
      expectedArrivals: { total: 0, ships: [] },
    }, { status: 500 });
  }
}
