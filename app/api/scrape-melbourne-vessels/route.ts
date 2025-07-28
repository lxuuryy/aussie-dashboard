// app/api/scrape-melbourne-vessels/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ShipMovement {
  vessel: string;
  arrived: string;
  dwt: string;
  grt: string;
  built: string;
  size: string;
  vesselType?: string;
  flag?: string;
  mmsi?: string;
  status: 'in-port' | 'expected';
}

interface ExpectedArrival {
  mmsi: string;
  vessel: string;
  flag: string;
  port: string;
  estimatedArrival: string;
  vesselType?: string;
}

interface VicPortsMovement {
  vessel: string;
  voyage: string;
  flag: string;
  agent: string;
  berth: string;
  eta: string;
  etd: string;
  status: string;
  portType: 'melbourne' | 'geelong';
}

interface PortCallHistory {
  vessel: string;
  mmsi?: string;
  imo?: string;
  flag: string;
  event: 'arrival' | 'departure';
  timestamp: string;
  port?: string;
  vesselType?: string;
  iconType?: string;
}

interface ProcessedMelbourneData {
  totalVessels: number;
  inPortCount: number;
  expectedArrivals: number;
  vicPortsMovements: number;
  portCallHistory: number;
  vesselTypes: { [key: string]: number };
  flagDistribution: { [key: string]: number };
  busyBerths: string[];
  recentArrivals: ShipMovement[];
  upcomingArrivals: ExpectedArrival[];
  largestVessels: ShipMovement[];
  recentPortCalls: PortCallHistory[];
  containerShips: ShipMovement[];
  bulkCarriers: ShipMovement[];
  analysis: any;
}

// Convert UTC time to Melbourne time
const convertToMelbourneTime = (utcTimeString: string): string => {
  if (!utcTimeString || !utcTimeString.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)) {
    return utcTimeString;
  }
  
  try {
    const utcDate = new Date(utcTimeString + ' UTC');
    return utcDate.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/, '$3-$1-$2 $4:$5');
  } catch (e) {
    console.log('Time conversion failed for:', utcTimeString);
    return utcTimeString;
  }
};

// Determine vessel type based on name and characteristics (Melbourne specialization)
const determineMelbourneVesselType = (vesselName: string, size: string, dwt: string): string => {
  const name = vesselName.toLowerCase();
  const sizeNum = parseInt(size) || 0;
  const dwtNum = parseInt(dwt.replace(/[^\d]/g, '')) || 0;

  // Container ship detection (Melbourne is major container port)
  if (name.includes('container') || name.includes('express') || name.includes('maersk') || 
      name.includes('msc') || name.includes('cma') || name.includes('cosco') || 
      name.includes('evergreen') || name.includes('hapag') || name.includes('yang ming') ||
      name.includes('oocl') || name.includes('mol') || name.includes('one') ||
      (sizeNum > 200 && dwtNum > 50000 && dwtNum < 250000)) {
    return 'Container Ship';
  }

  // Automotive carriers (Melbourne is major car import port)
  if (name.includes('car') || name.includes('vehicle') || name.includes('auto') || 
      name.includes('highway') || name.includes('morning') || name.includes('glovis')) {
    return 'Car Carrier';
  }

  // Bulk carriers
  if (name.includes('bulk') || name.includes('coal') || name.includes('ore') || 
      name.includes('grain') || name.includes('cape') || (sizeNum > 250 && dwtNum > 150000)) {
    return 'Bulk Carrier';
  }

  // Tankers
  if (name.includes('tanker') || name.includes('chemical') || name.includes('product') || 
      name.includes('gas') || name.includes('lpg') || name.includes('lng')) {
    return 'Tanker';
  }

  // Cruise ships (Melbourne has cruise terminal)
  if (name.includes('cruise') || name.includes('princess') || name.includes('celebrity') || 
      name.includes('royal') || name.includes('pacific') || name.includes('spirit')) {
    return 'Cruise Ship';
  }

  // Service vessels
  if (name.includes('tug') || name.includes('pilot') || name.includes('service') || 
      name.includes('supply') || sizeNum < 50) {
    return 'Service Vessel';
  }

  // General cargo classification by size
  if (sizeNum > 300) {
    return 'Large Container Ship';
  } else if (sizeNum > 200) {
    return 'Medium Container Ship';
  } else if (sizeNum > 100) {
    return 'General Cargo';
  } else if (sizeNum > 50) {
    return 'Coastal Vessel';
  }

  return 'General Cargo';
};

// Scrape Melbourne In Port vessels
async function scrapeMelbourneInPortVessels(): Promise<ShipMovement[]> {
  try {
    let allMovements: ShipMovement[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`Scraping Melbourne in-port vessels page ${currentPage}...`);
      
      const url = currentPage === 1 
        ? 'https://www.myshiptracking.com/inport?pid=293'
        : `https://www.myshiptracking.com/inport?sort=TIME&page=${currentPage}&pid=293`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.myshiptracking.com/',
        },
        next: { revalidate: 300 },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch Melbourne page ${currentPage}: ${response.status}`);
        break;
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const pageMovements: ShipMovement[] = [];
      let foundVesselsOnPage = false;

      // First try table parsing method
      $('table').each((tableIndex, table) => {
        const $table = $(table);
        
        $table.find('tr').each((rowIndex, row) => {
          const $row = $(row);
          const cells = $row.find('td');
          
          if (cells.length >= 6) {
            foundVesselsOnPage = true;
            
            const vesselCell = $(cells[0]);
            const arrivedCell = $(cells[1]);
            const dwtCell = $(cells[2]);
            const grtCell = $(cells[3]);
            const builtCell = $(cells[4]);
            const sizeCell = $(cells[5]);
            
            let vesselName = vesselCell.text().trim();
            if (!vesselName) {
              const img = vesselCell.find('img');
              if (img.length) {
                vesselName = img.attr('alt') || img.attr('title') || 'Unknown Vessel';
              }
            }
            
            const arrivedRaw = arrivedCell.text().trim();
            const dwt = dwtCell.text().trim();
            const grt = grtCell.text().trim();
            const built = builtCell.text().trim();
            const size = sizeCell.text().trim();
            
            // Convert UTC to Melbourne time
            const arrived = convertToMelbourneTime(arrivedRaw);
            
            // Determine vessel type using Melbourne-specific logic
            const vesselType = determineMelbourneVesselType(vesselName, size, dwt);
            
            if (arrivedRaw && arrivedRaw.match(/\d{4}-\d{2}-\d{2}/)) {
              pageMovements.push({
                vessel: vesselName || `Vessel ${allMovements.length + pageMovements.length + 1}`,
                arrived,
                dwt: dwt || '---',
                grt: grt || '---',
                built: built || '---',
                size: size || '---',
                vesselType,
                status: 'in-port',
              });
            }
          }
        });
      });

      // Fallback line-by-line parsing
      if (pageMovements.length === 0) {
        console.log(`Table parsing failed for Melbourne page ${currentPage}, trying line-by-line method...`);
        const lines = html.split('\n');
        let currentVessel: Partial<ShipMovement> = {};
        
        lines.forEach(line => {
          const cleanLine = line.trim();
          
          const dateMatch = cleanLine.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
          if (dateMatch) {
            if (currentVessel.arrived) {
              if (Object.keys(currentVessel).length > 1) {
                foundVesselsOnPage = true;
                const vesselType = determineMelbourneVesselType(
                  currentVessel.vessel || '', 
                  currentVessel.size || '', 
                  currentVessel.dwt || ''
                );
                pageMovements.push({
                  vessel: currentVessel.vessel || `Vessel ${allMovements.length + pageMovements.length + 1}`,
                  arrived: currentVessel.arrived || '',
                  dwt: currentVessel.dwt || '---',
                  grt: currentVessel.grt || '---',
                  built: currentVessel.built || '---',
                  size: currentVessel.size || '---',
                  vesselType,
                  status: 'in-port',
                });
              }
            }
            // Convert UTC to Melbourne time
            currentVessel = { arrived: convertToMelbourneTime(dateMatch[1]) };
          }
          
          const tonnageMatch = cleanLine.match(/(\d{1,3}(?:,\d{3})*)\s*Tons/);
          if (tonnageMatch && currentVessel.arrived) {
            if (!currentVessel.dwt || currentVessel.dwt === '---') {
              currentVessel.dwt = tonnageMatch[1] + ' Tons';
            } else if (!currentVessel.grt || currentVessel.grt === '---') {
              currentVessel.grt = tonnageMatch[1] + ' Tons';
            }
          }
          
          const sizeMatch = cleanLine.match(/(\d+)\s*m/);
          if (sizeMatch && currentVessel.arrived && (!currentVessel.size || currentVessel.size === '---')) {
            currentVessel.size = sizeMatch[1] + ' m';
          }
          
          const yearMatch = cleanLine.match(/\b(19\d{2}|20\d{2})\b/);
          if (yearMatch && currentVessel.arrived && (!currentVessel.built || currentVessel.built === '---')) {
            currentVessel.built = yearMatch[1];
          }
        });
        
        if (currentVessel.arrived && Object.keys(currentVessel).length > 1) {
          foundVesselsOnPage = true;
          const vesselType = determineMelbourneVesselType(
            currentVessel.vessel || '', 
            currentVessel.size || '', 
            currentVessel.dwt || ''
          );
          pageMovements.push({
            vessel: currentVessel.vessel || `Vessel ${allMovements.length + pageMovements.length + 1}`,
            arrived: currentVessel.arrived || '',
            dwt: currentVessel.dwt || '---',
            grt: currentVessel.grt || '---',
            built: currentVessel.built || '---',
            size: currentVessel.size || '---',
            vesselType,
            status: 'in-port',
          });
        }
      }

      allMovements = [...allMovements, ...pageMovements];
      console.log(`Found ${pageMovements.length} Melbourne vessels on page ${currentPage}`);

      // Pagination logic
      const hasNextPageButton = $('a[href*="page=' + (currentPage + 1) + '"]').length > 0 ||
                               $('a').filter((i, el) => $(el).text().includes('Next')).length > 0 ||
                               $('a').filter((i, el) => $(el).text().includes('→')).length > 0;
      
      const hasReasonableVesselCount = pageMovements.length > 0;
      
      if (!foundVesselsOnPage || !hasReasonableVesselCount || currentPage >= 10) {
        hasMorePages = false;
        if (currentPage >= 10) {
          console.log('Reached maximum page limit (10) for Melbourne port');
        }
      } else if (!hasNextPageButton && currentPage > 1) {
        if (currentPage === 2) {
          currentPage++;
        } else {
          hasMorePages = false;
        }
      } else {
        currentPage++;
      }

      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Total found ${allMovements.length} Melbourne in-port vessels across ${currentPage - 1} pages`);
    return allMovements;
  } catch (error) {
    console.error('Error scraping Melbourne in-port vessels:', error);
    return [];
  }
}

// Scrape Melbourne Expected Arrivals
async function scrapeMelbourneExpectedArrivals(): Promise<ExpectedArrival[]> {
  try {
    const response = await fetch('https://www.myshiptracking.com/estimate?pid=293', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.myshiptracking.com/',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const arrivals: ExpectedArrival[] = [];

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
        const etaRaw = etaCell.text().trim();
        
        // Convert UTC ETA to Melbourne time
        const eta = convertToMelbourneTime(etaRaw);
        
        const vesselMatch = vesselText.match(/([A-Z\s]+)\[([A-Z]{2})\]/);
        let vesselName = vesselText;
        let flag = '';
        
        if (vesselMatch) {
          vesselName = vesselMatch[1].trim();
          flag = vesselMatch[2];
        }
        
        // Determine vessel type for Melbourne
        const vesselType = determineMelbourneVesselType(vesselName, '', '');
        
        if (mmsi && mmsi.match(/^\d+$/)) {
          arrivals.push({
            mmsi,
            vessel: vesselName || 'Unknown Vessel',
            flag: flag || 'Unknown',
            port: port || 'MELBOURNE',
            estimatedArrival: eta || 'Unknown',
            vesselType,
          });
        }
      }
    });

    return arrivals;
  } catch (error) {
    console.error('Error scraping Melbourne expected arrivals:', error);
    return [];
  }
}

// Scrape VicPorts vessel movements (optional additional data source)
async function scrapeVicPortsVessels(): Promise<VicPortsMovement[]> {
  try {
    const response = await fetch('https://www.vicports.vic.gov.au/operations/Pages/ship-movements.aspx', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.warn(`VicPorts failed to fetch: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const movements: VicPortsMovement[] = [];

    // Look for tables or structured data containing ship movements
    $('table').each((index, table) => {
      const $table = $(table);
      const headers: string[] = [];
      
      // Extract headers
      $table.find('thead tr th, tr:first-child th, tr:first-child td').each((i, th) => {
        headers.push($(th).text().trim());
      });

      // Skip if no meaningful headers found
      if (headers.length < 3) return;

      // Extract data rows
      $table.find('tbody tr, tr').each((i, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 3) {
          const movement: any = {};
          
          cells.each((cellIndex, cell) => {
            const cellText = $(cell).text().trim();
            const headerKey = headers[cellIndex] || `column_${cellIndex}`;
            
            // Map common column names
            if (headerKey.toLowerCase().includes('vessel') || headerKey.toLowerCase().includes('ship')) {
              movement.vessel = cellText;
            } else if (headerKey.toLowerCase().includes('voyage')) {
              movement.voyage = cellText;
            } else if (headerKey.toLowerCase().includes('flag')) {
              movement.flag = cellText;
            } else if (headerKey.toLowerCase().includes('agent')) {
              movement.agent = cellText;
            } else if (headerKey.toLowerCase().includes('berth')) {
              movement.berth = cellText;
            } else if (headerKey.toLowerCase().includes('eta')) {
              movement.eta = cellText;
            } else if (headerKey.toLowerCase().includes('etd')) {
              movement.etd = cellText;
            } else if (headerKey.toLowerCase().includes('status')) {
              movement.status = cellText;
            }
          });
          
          // Only add if we have meaningful data
          if (movement.vessel && Object.keys(movement).length > 2) {
            movements.push({
              vessel: movement.vessel || 'N/A',
              voyage: movement.voyage || 'N/A',
              flag: movement.flag || 'N/A',
              agent: movement.agent || 'N/A',
              berth: movement.berth || 'N/A',
              eta: movement.eta || 'N/A',
              etd: movement.etd || 'N/A',
              status: movement.status || 'N/A',
              portType: index === 0 ? 'melbourne' : 'geelong' as 'melbourne' | 'geelong',
            });
          }
        }
      });
    });

    console.log(`Found ${movements.length} VicPorts movements`);
    return movements;
  } catch (error) {
    console.error('Error scraping VicPorts vessels:', error);
    return [];
  }
}

// Scrape Melbourne Port Call History
async function scrapeMelbournePortCallHistory(): Promise<PortCallHistory[]> {
  try {
    let allPortCalls: PortCallHistory[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages && currentPage <= 5) { // Limit to 5 pages for performance
      console.log(`Scraping Melbourne port call history page ${currentPage}...`);
      
      const url = currentPage === 1 
        ? 'https://www.myshiptracking.com/ports-arrivals-departures/?pid=293'
        : `https://www.myshiptracking.com/ports-arrivals-departures/?pid=293&page=${currentPage}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        next: { revalidate: 300 },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch Melbourne port call history page ${currentPage}: ${response.status}`);
        break;
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const pagePortCalls: PortCallHistory[] = [];
      let foundCallsOnPage = false;

      // Method 1: Parse table structure (Event | Time | Port | Vessel columns)
      $('table tr').each((rowIndex, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 4) {
          const eventCell = $(cells[0]);
          const timeCell = $(cells[1]);
          const portCell = $(cells[2]);
          const vesselCell = $(cells[3]);
          
          // Extract event type
          const eventText = eventCell.text().trim().toLowerCase();
          if (!eventText.includes('arrival') && !eventText.includes('departure')) {
            return; // Skip header rows or invalid data
          }
          
          const event = eventText.includes('arrival') ? 'arrival' : 'departure';
          
          // Extract timestamp and convert to Melbourne time
          const timestampRaw = timeCell.text().trim();
          if (!timestampRaw.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)) {
            return; // Skip if no valid timestamp
          }
          
          const timestamp = convertToMelbourneTime(timestampRaw);
          
          // Extract port information
          const port = portCell.text().trim() || 'MELBOURNE';
          
          // Process all vessel links in the vessel cell
          const vesselLinks = vesselCell.find('a[href*="/vessels/"]');
          
          if (vesselLinks.length > 0) {
            vesselLinks.each((linkIndex, link) => {
              const $link = $(link);
              const href = $link.attr('href') || '';
              const vesselText = $link.text().trim();
              
              if (!vesselText) return; // Skip empty vessel names
              
              // Extract MMSI and IMO from URL
              const mmsiMatch = href.match(/mmsi-(\d+)/);
              const imoMatch = href.match(/imo-(\d+)/);
              
              // Extract flag from vessel cell (look for flag images)
              let flag = 'AU'; // Default to Australia for Melbourne port
              const flagImg = vesselCell.find('img[src*="/flags2/"]').first();
              if (flagImg.length) {
                const flagSrc = flagImg.attr('src') || '';
                const flagMatch = flagSrc.match(/\/([A-Z]{2})\.png/);
                if (flagMatch) {
                  flag = flagMatch[1];
                }
              }
              
              // Also check for flag notation in text [AU]
              const flagTextMatch = vesselText.match(/\[([A-Z]{2})\]/);
              if (flagTextMatch) {
                flag = flagTextMatch[1];
              }
              
              // Extract vessel type from icon
              let vesselType = 'General Cargo'; // Melbourne default
              let iconType = '';
              const iconImg = vesselCell.find('img[src*="/icons/icon"]').first();
              if (iconImg.length) {
                const iconSrc = iconImg.attr('src') || '';
                const iconMatch = iconSrc.match(/icon(\d+)_/);
                if (iconMatch) {
                  iconType = iconMatch[1];
                  vesselType = getMelbourneVesselTypeFromIcon(iconSrc);
                }
              }
              
              // Melbourne-specific vessel type detection using the existing function
              const detectedType = determineMelbourneVesselType(vesselText, '', '');
              if (detectedType !== 'General Cargo') {
                vesselType = detectedType;
              }
              
              // Clean vessel name (remove flag notation)
              const cleanVesselName = vesselText.replace(/\s*\[[A-Z]{2}]\s*$/, '').trim();
              
              if (cleanVesselName) {
                foundCallsOnPage = true;
                pagePortCalls.push({
                  vessel: cleanVesselName,
                  mmsi: mmsiMatch ? mmsiMatch[1] : undefined,
                  imo: imoMatch ? imoMatch[1] : undefined,
                  flag: flag,
                  event: event,
                  timestamp: timestamp,
                  port: port,
                  vesselType: vesselType,
                  iconType: iconType,
                });
              }
            });
          } else {
            // Fallback: extract vessel name from text content
            const vesselText = vesselCell.text().trim();
            if (vesselText) {
              let flag = 'AU';
              const flagMatch = vesselText.match(/\[([A-Z]{2})\]/);
              if (flagMatch) {
                flag = flagMatch[1];
              }
              
              // Melbourne-specific vessel type detection for text content
              const vesselType = determineMelbourneVesselType(vesselText, '', '');
              
              const cleanVesselName = vesselText.replace(/\s*\[[A-Z]{2}]\s*$/, '').trim();
              
              if (cleanVesselName) {
                foundCallsOnPage = true;
                pagePortCalls.push({
                  vessel: cleanVesselName,
                  flag: flag,
                  event: event,
                  timestamp: timestamp,
                  port: port,
                  vesselType: vesselType,
                });
              }
            }
          }
        }
      });

      // Method 2: Alternative parsing if table method fails
      if (pagePortCalls.length === 0) {
        console.log(`Table parsing failed for page ${currentPage}, trying alternative method...`);
        
        // Look for vessel links directly
        $('a[href*="/vessels/"]').each((index, element) => {
          const $link = $(element);
          const href = $link.attr('href') || '';
          const vesselName = $link.text().trim();
          
          if (vesselName) {
            const mmsiMatch = href.match(/mmsi-(\d+)/);
            const imoMatch = href.match(/imo-(\d+)/);
            
            // Try to find associated timestamp and event
            const $parent = $link.closest('tr, div');
            const parentText = $parent.text();
            
            const timeMatch = parentText.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
            const eventMatch = parentText.toLowerCase().includes('arrival') ? 'arrival' : 'departure';
            
            if (timeMatch) {
              // Melbourne-specific vessel type detection
              const vesselType = determineMelbourneVesselType(vesselName, '', '');
              
              foundCallsOnPage = true;
              pagePortCalls.push({
                vessel: vesselName,
                mmsi: mmsiMatch ? mmsiMatch[1] : undefined,
                imo: imoMatch ? imoMatch[1] : undefined,
                flag: 'AU',
                event: eventMatch,
                timestamp: convertToMelbourneTime(timeMatch[1]),
                port: 'MELBOURNE',
                vesselType: vesselType,
              });
            }
          }
        });
      }

      // Remove duplicates based on vessel name and timestamp
      const uniquePageCalls = pagePortCalls.filter((call, index, self) =>
        index === self.findIndex(c => 
          c.vessel === call.vessel && 
          c.timestamp === call.timestamp && 
          c.event === call.event
        )
      );

      allPortCalls = [...allPortCalls, ...uniquePageCalls];
      console.log(`Found ${uniquePageCalls.length} unique port calls on page ${currentPage}`);

      // Check for pagination
      const hasNextPage = $('a[href*="page=' + (currentPage + 1) + '"]').length > 0 ||
                         $('a').filter((i, el) => $(el).text().trim().toLowerCase().includes('next')).length > 0;
      
      if (!foundCallsOnPage || !hasNextPage || currentPage >= 5) {
        hasMorePages = false;
      } else {
        currentPage++;
        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final deduplication across all pages
    const finalPortCalls = allPortCalls.filter((call, index, self) =>
      index === self.findIndex(c => 
        c.vessel === call.vessel && 
        c.timestamp === call.timestamp && 
        c.event === call.event
      )
    );

    console.log(`Total collected ${finalPortCalls.length} unique Melbourne port calls across ${currentPage - 1} pages`);
    return finalPortCalls;
    
  } catch (error) {
    console.error('Error scraping Melbourne port call history:', error);
    return [];
  }
}

// Helper function to get vessel type from icon (Melbourne-specific)
function getMelbourneVesselTypeFromIcon(iconSrc: string): string {
  if (!iconSrc) return 'General Cargo';
  
  // Map icon numbers to vessel types based on MyShipTracking patterns
  // Melbourne specializes in containers, automotive, and general cargo
  if (iconSrc.includes('icon0_')) return 'Ferry/Passenger';
  if (iconSrc.includes('icon1_')) return 'General Cargo';
  if (iconSrc.includes('icon2_')) return 'Tanker';
  if (iconSrc.includes('icon3_')) return 'Service Vessel/Tug';
  if (iconSrc.includes('icon4_')) return 'Passenger/Ferry';
  if (iconSrc.includes('icon5_')) return 'Cruise Ship';
  if (iconSrc.includes('icon6_')) return 'Small Passenger Vessel';
  if (iconSrc.includes('icon7_')) return 'Container Ship';
  if (iconSrc.includes('icon8_')) return 'Tanker';
  if (iconSrc.includes('icon9_')) return 'Bulk Carrier';
  if (iconSrc.includes('icon10_')) return 'Yacht/Pleasure Craft';
  
  return 'General Cargo'; // Default for Melbourne
}

function processMelbourneData(
  inPortVessels: ShipMovement[], 
  expectedArrivals: ExpectedArrival[], 
  vicPortsMovements: VicPortsMovement[],
  portCallHistory: PortCallHistory[]
): ProcessedMelbourneData {
  // Classify vessel types with Melbourne specialization
  const vesselTypes: { [key: string]: number } = {};
  
  inPortVessels.forEach(vessel => {
    const type = vessel.vesselType || 'Unknown';
    vesselTypes[type] = (vesselTypes[type] || 0) + 1;
  });

  portCallHistory.forEach(call => {
    if (call.vesselType && call.vesselType !== 'Unknown') {
      vesselTypes[call.vesselType] = (vesselTypes[call.vesselType] || 0) + 1;
    }
  });

  // Flag distribution
  const flagDistribution: { [key: string]: number } = {};
  
  expectedArrivals.forEach(arrival => {
    const flag = arrival.flag || 'Unknown';
    flagDistribution[flag] = (flagDistribution[flag] || 0) + 1;
  });

  portCallHistory.forEach(call => {
    const flag = call.flag || 'Unknown';
    if (flag !== 'Unknown') {
      flagDistribution[flag] = (flagDistribution[flag] || 0) + 1;
    }
  });

  // Find busy berths from VicPorts data
  const berthCounts: { [key: string]: number } = {};
  vicPortsMovements.forEach(movement => {
    const berth = movement.berth || 'Unknown';
    if (berth !== 'N/A' && berth !== 'Unknown') {
      berthCounts[berth] = (berthCounts[berth] || 0) + 1;
    }
  });

  const busyBerths = Object.entries(berthCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([berth]) => berth);

  // Recent arrivals
  const recentArrivals = inPortVessels
    .sort((a, b) => new Date(b.arrived).getTime() - new Date(a.arrived).getTime())
    .slice(0, 10);

  // Largest vessels
  const largestVessels = inPortVessels
    .filter(v => v.size !== '---')
    .sort((a, b) => parseInt(b.size) - parseInt(a.size))
    .slice(0, 10);

  // Recent port calls
  const recentPortCalls = portCallHistory
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15);

  // Melbourne-specific: specialized vessel categories
  const containerShips = inPortVessels
    .filter(v => v.vesselType?.includes('Container') || v.vessel.toLowerCase().includes('container'))
    .slice(0, 10);

  const bulkCarriers = inPortVessels
    .filter(v => v.vesselType?.includes('Bulk') || v.vessel.toLowerCase().includes('bulk'))
    .slice(0, 10);

  return {
    totalVessels: inPortVessels.length + expectedArrivals.length,
    inPortCount: inPortVessels.length,
    expectedArrivals: expectedArrivals.length,
    vicPortsMovements: vicPortsMovements.length,
    portCallHistory: portCallHistory.length,
    vesselTypes,
    flagDistribution,
    busyBerths,
    recentArrivals,
    upcomingArrivals: expectedArrivals.slice(0, 10),
    largestVessels,
    recentPortCalls,
    containerShips,
    bulkCarriers,
    analysis: null,
  };
}

async function analyzeMelbournePortData(
  processedData: ProcessedMelbourneData,
  inPortVessels: ShipMovement[],
  expectedArrivals: ExpectedArrival[],
  vicPortsMovements: VicPortsMovement[],
  portCallHistory: PortCallHistory[]
) {
  try {
    const prompt = `
      Analyze this comprehensive vessel data for Port of Melbourne:

      PORT OF MELBOURNE OVERVIEW:
      - Total Vessels Tracked: ${processedData.totalVessels}
      - Currently In Port: ${processedData.inPortCount}
      - Expected Arrivals: ${processedData.expectedArrivals}
      - VicPorts Scheduled Movements: ${processedData.vicPortsMovements}
      - Port Call History Records: ${processedData.portCallHistory}
      
      VESSEL DISTRIBUTION:
      - Vessel Types: ${JSON.stringify(processedData.vesselTypes, null, 2)}
      - Flag States: ${JSON.stringify(processedData.flagDistribution, null, 2)}
      - Busiest Berths: ${processedData.busyBerths.join(', ')}
      - Container Ships: ${processedData.containerShips.length}
      - Bulk Carriers: ${processedData.bulkCarriers.length}
      
      OPERATIONAL DATA:
      Recent In-Port Vessels: ${JSON.stringify(processedData.recentArrivals.slice(0, 5), null, 2)}
      Upcoming Arrivals: ${JSON.stringify(processedData.upcomingArrivals.slice(0, 5), null, 2)}
      Largest Vessels: ${JSON.stringify(processedData.largestVessels.slice(0, 5), null, 2)}
      Recent Port Calls: ${JSON.stringify(processedData.recentPortCalls.slice(0, 10), null, 2)}
      VicPorts Sample: ${JSON.stringify(vicPortsMovements.slice(0, 5), null, 2)}

      MELBOURNE CONTEXT:
      Melbourne is Australia's largest container port and major automotive import hub, specializing in:
      - Container shipping (largest container terminal in Australia)
      - Automotive imports (major car carrier operations)
      - General cargo and break-bulk
      - Cruise ship operations
      - Bulk commodities
      
      Focus analysis on:
      - Container terminal efficiency and capacity
      - Automotive import operations
      - Multi-modal transport connectivity
      - Infrastructure utilization across different terminals
      - Supply chain optimization

      Provide comprehensive analysis in JSON format focusing on Melbourne's unique characteristics as Australia's premier container and automotive port:
      {
        "port_activity_analysis": {
          "activity_level": "low/moderate/high/very_high",
          "capacity_utilization": "assessment of port capacity usage",
          "traffic_patterns": "analysis of vessel arrival/departure patterns",
          "operational_efficiency": "assessment of port operations",
          "container_performance": "specific analysis of container operations",
          "automotive_performance": "specific analysis of automotive import operations",
          "historical_trends": "analysis of port call history patterns"
        },
        "vessel_composition": {
          "dominant_vessel_types": ["most common vessel categories"],
          "size_distribution": "analysis of vessel sizes",
          "flag_state_analysis": "insights about vessel origins",
          "container_ship_analysis": "specific analysis of container vessel operations",
          "car_carrier_analysis": "specific analysis of automotive vessel operations",
          "cargo_types": "inferred cargo types from vessel data",
          "service_vessel_activity": "analysis of tugs, ferries, and service vessels"
        },
        "infrastructure_analysis": {
          "berth_utilization": "analysis of berth usage patterns",
          "terminal_efficiency": "assessment of terminal operations",
          "container_terminal_performance": "specific container terminal analysis",
          "automotive_terminal_performance": "specific automotive terminal analysis",
          "capacity_constraints": "potential bottlenecks identified",
          "infrastructure_recommendations": ["suggestions for improvement"]
        },
        "trade_insights": {
          "primary_trade_routes": ["main shipping routes identified"],
          "cargo_flow_patterns": "analysis of cargo movements",
          "container_trade_trends": "trends in container shipping",
          "automotive_import_trends": "trends in car carrier activity",
          "seasonal_trends": "observable patterns in shipping",
          "economic_indicators": "port performance indicators",
          "arrival_departure_balance": "analysis of vessel movement patterns"
        },
        "strategic_recommendations": {
          "operational_improvements": ["actionable recommendations"],
          "container_optimization": ["container terminal improvements"],
          "automotive_optimization": ["automotive terminal improvements"],
          "capacity_planning": ["suggestions for future capacity"],
          "efficiency_gains": ["opportunities for optimization"],
          "infrastructure_investments": ["recommended infrastructure upgrades"],
          "competitive_position": "assessment vs other Australian ports"
        },
        "melbourne_insights": {
          "unique_characteristics": "what makes Melbourne port distinctive",
          "container_hub_strengths": ["key strengths as container port"],
          "automotive_gateway_advantages": ["advantages as automotive import gateway"],
          "infrastructure_advantages": ["infrastructure and operational advantages"],
          "challenges": ["operational challenges identified"],
          "sustainability_opportunities": ["environmental and sustainability opportunities"],
          "growth_opportunities": ["areas for expansion/improvement"]
        }
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a maritime operations expert specializing in Australian container ports and automotive import terminals. Provide detailed strategic analysis including container terminal operations, automotive logistics, and multi-modal connectivity."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 3000,
      temperature: 0.1,
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Melbourne analysis error:', error);
    return {
      error: 'Failed to analyze Melbourne port data',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analyze = searchParams.get('analyze') === 'true';

    console.log('Scraping Port of Melbourne vessel data...');

    // Scrape all Melbourne data sources in parallel
    const [inPortVessels, expectedArrivals, vicPortsMovements, portCallHistory] = await Promise.all([
      scrapeMelbourneInPortVessels(),
      scrapeMelbourneExpectedArrivals(),
      scrapeVicPortsVessels(),
      scrapeMelbournePortCallHistory()
    ]);

    console.log(`Scraped Melbourne: ${inPortVessels.length} in-port, ${expectedArrivals.length} expected, ${vicPortsMovements.length} VicPorts, ${portCallHistory.length} port calls`);

    // Fallback data if scraping fails
    if (inPortVessels.length === 0 && expectedArrivals.length === 0 && vicPortsMovements.length === 0 && portCallHistory.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          scraped_at: new Date().toISOString(),
          port: 'Port of Melbourne',
          data_sources: [
            'MyShipTracking (In Port)', 
            'MyShipTracking (Expected Arrivals)', 
            'VicPorts (Scheduled Movements)',
            'MyShipTracking (Port Call History)'
          ],
          raw_data: {
            in_port_vessels: [{
              vessel: 'Data temporarily unavailable',
              arrived: new Date().toISOString(),
              dwt: 'N/A',
              grt: 'N/A',
              built: 'N/A',
              size: 'N/A',
              vesselType: 'Container Ship',
              status: 'in-port' as const,
            }],
            expected_arrivals: [],
            vicports_movements: [],
            port_call_history: []
          },
          processed_data: {
            totalVessels: 0,
            inPortCount: 0,
            expectedArrivals: 0,
            vicPortsMovements: 0,
            portCallHistory: 0,
            vesselTypes: {},
            flagDistribution: {},
            busyBerths: [],
            recentArrivals: [],
            upcomingArrivals: [],
            largestVessels: [],
            recentPortCalls: [],
            containerShips: [],
            bulkCarriers: [],
            analysis: null,
          },
          summary: {
            total_data_points: 0,
            sources_active: ['Scraping temporarily unavailable']
          }
        },
      });
    }

    // Process the Melbourne data
    const processedData = processMelbourneData(inPortVessels, expectedArrivals, vicPortsMovements, portCallHistory);
    
    let analysis = null;
    
    // Add AI analysis if requested
    if (analyze && (inPortVessels.length > 0 || expectedArrivals.length > 0 || portCallHistory.length > 0)) {
      console.log('Analyzing Melbourne port data with OpenAI...');
      analysis = await analyzeMelbournePortData(
        processedData,
        inPortVessels,
        expectedArrivals,
        vicPortsMovements,
        portCallHistory
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        scraped_at: new Date().toISOString(),
        port: 'Port of Melbourne',
        data_sources: [
          'MyShipTracking (In Port)',
          'MyShipTracking (Expected Arrivals)',
          'VicPorts (Scheduled Movements)',
          'MyShipTracking (Port Call History)'
        ],
        raw_data: {
          in_port_vessels: inPortVessels,
          expected_arrivals: expectedArrivals,
          vicports_movements: vicPortsMovements,
          port_call_history: portCallHistory
        },
        processed_data: {
          ...processedData,
          analysis
        },
        summary: {
          total_data_points: inPortVessels.length + expectedArrivals.length + vicPortsMovements.length + portCallHistory.length,
          sources_active: [
            inPortVessels.length > 0 ? 'In Port' : null,
            expectedArrivals.length > 0 ? 'Expected Arrivals' : null,
            vicPortsMovements.length > 0 ? 'VicPorts' : null,
            portCallHistory.length > 0 ? 'Port Call History' : null
          ].filter(Boolean)
        }
      },
    });

  } catch (error) {
    console.error('Melbourne API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape Melbourne vessel data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { filters } = await request.json();
    
    // Scrape all Melbourne data sources
    const [inPortVessels, expectedArrivals, vicPortsMovements, portCallHistory] = await Promise.all([
      scrapeMelbourneInPortVessels(),
      scrapeMelbourneExpectedArrivals(),
      scrapeVicPortsVessels(),
      scrapeMelbournePortCallHistory()
    ]);
    
    // Apply filters if provided
    let filteredInPort = inPortVessels;
    let filteredArrivals = expectedArrivals;
    let filteredVicPorts = vicPortsMovements;
    let filteredPortCalls = portCallHistory;
    
    if (filters) {
      if (filters.vesselSize) {
        filteredInPort = filteredInPort.filter(v => {
          const size = parseInt(v.size);
          if (filters.vesselSize === 'large') return size > 200;
          if (filters.vesselSize === 'medium') return size >= 100 && size <= 200;
          if (filters.vesselSize === 'small') return size < 100;
          return true;
        });
      }
      
      if (filters.flag) {
        filteredArrivals = filteredArrivals.filter(a => 
          a.flag.toLowerCase().includes(filters.flag.toLowerCase())
        );
        filteredPortCalls = filteredPortCalls.filter(pc => 
          pc.flag.toLowerCase().includes(filters.flag.toLowerCase())
        );
      }
      
      if (filters.vesselName) {
        filteredInPort = filteredInPort.filter(v => 
          v.vessel.toLowerCase().includes(filters.vesselName.toLowerCase())
        );
        filteredArrivals = filteredArrivals.filter(a => 
          a.vessel.toLowerCase().includes(filters.vesselName.toLowerCase())
        );
        filteredVicPorts = filteredVicPorts.filter(v => 
          v.vessel.toLowerCase().includes(filters.vesselName.toLowerCase())
        );
        filteredPortCalls = filteredPortCalls.filter(pc => 
          pc.vessel.toLowerCase().includes(filters.vesselName.toLowerCase())
        );
      }

      if (filters.vesselType) {
        filteredInPort = filteredInPort.filter(v => 
          v.vesselType?.toLowerCase().includes(filters.vesselType.toLowerCase())
        );
        filteredArrivals = filteredArrivals.filter(a => 
          a.vesselType?.toLowerCase().includes(filters.vesselType.toLowerCase())
        );
        filteredPortCalls = filteredPortCalls.filter(pc => 
          pc.vesselType?.toLowerCase().includes(filters.vesselType.toLowerCase())
        );
      }

      if (filters.eventType) {
        filteredPortCalls = filteredPortCalls.filter(pc => 
          pc.event === filters.eventType
        );
      }
    }

    const processedData = processMelbourneData(filteredInPort, filteredArrivals, filteredVicPorts, filteredPortCalls);
    
    // Always analyze for POST requests
    const analysis = await analyzeMelbournePortData(
      processedData,
      filteredInPort,
      filteredArrivals,
      filteredVicPorts,
      filteredPortCalls
    );

    return NextResponse.json({
      success: true,
      data: {
        scraped_at: new Date().toISOString(),
        filters_applied: filters,
        port: 'Port of Melbourne',
        total_found: {
          in_port: inPortVessels.length,
          expected: expectedArrivals.length,
          vicports: vicPortsMovements.length,
          port_calls: portCallHistory.length
        },
        filtered_results: {
          in_port: filteredInPort.length,
          expected: filteredArrivals.length,
          vicports: filteredVicPorts.length,
          port_calls: filteredPortCalls.length
        },
        raw_data: {
          in_port_vessels: filteredInPort,
          expected_arrivals: filteredArrivals,
          vicports_movements: filteredVicPorts,
          port_call_history: filteredPortCalls
        },
        processed_data: {
          ...processedData,
          analysis
        }
      },
    });

  } catch (error) {
    console.error('Melbourne POST API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process Melbourne vessel data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}