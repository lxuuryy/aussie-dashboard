// app/api/scrape-newcastle-vessels/route.ts
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

interface PortCallHistory {
  vessel: string;
  mmsi?: string;
  imo?: string;
  flag: string;
  event: 'arrival' | 'departure';
  timestamp: string;
  vesselType?: string;
  iconType?: string;
}

interface ProcessedNewcastleData {
  totalVessels: number;
  inPortCount: number;
  expectedArrivals: number;
  portCallHistory: number;
  vesselTypes: { [key: string]: number };
  flagDistribution: { [key: string]: number };
  recentArrivals: ShipMovement[];
  upcomingArrivals: ExpectedArrival[];
  largestVessels: ShipMovement[];
  recentPortCalls: PortCallHistory[];
  coalCarriers: ShipMovement[];
  bulkCarriers: ShipMovement[];
  analysis: any;
}

// Convert UTC time to Sydney time (Newcastle is in NSW, same timezone)
const convertToSydneyTime = (utcTimeString: string): string => {
  if (!utcTimeString || !utcTimeString.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)) {
    return utcTimeString;
  }
  
  try {
    const utcDate = new Date(utcTimeString + ' UTC');
    return utcDate.toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
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

// Scrape Newcastle In Port vessels
async function scrapeNewcastleInPortVessels(): Promise<ShipMovement[]> {
  try {
    let allMovements: ShipMovement[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`Scraping Newcastle in-port vessels page ${currentPage}...`);
      
      const url = currentPage === 1 
        ? 'https://www.myshiptracking.com/inport?pid=314'
        : `https://www.myshiptracking.com/inport?sort=TIME&page=${currentPage}&pid=314`;

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
        console.warn(`Failed to fetch Newcastle page ${currentPage}: ${response.status}`);
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
            
            // Convert UTC to Sydney time
            const arrived = convertToSydneyTime(arrivedRaw);
            
            // Determine vessel type based on size and name
            let vesselType = 'General Cargo';
            if (vesselName.toLowerCase().includes('coal') || vesselName.toLowerCase().includes('bulk')) {
              vesselType = 'Bulk Carrier';
            } else if (vesselName.toLowerCase().includes('container')) {
              vesselType = 'Container Ship';
            } else if (vesselName.toLowerCase().includes('tanker')) {
              vesselType = 'Tanker';
            } else if (parseInt(size) > 250) {
              vesselType = 'Large Bulk Carrier';
            } else if (parseInt(size) > 150) {
              vesselType = 'Medium Bulk Carrier';
            }
            
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
        console.log(`Table parsing failed for Newcastle page ${currentPage}, trying line-by-line method...`);
        const lines = html.split('\n');
        let currentVessel: Partial<ShipMovement> = {};
        
        lines.forEach(line => {
          const cleanLine = line.trim();
          
          const dateMatch = cleanLine.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
          if (dateMatch) {
            if (currentVessel.arrived) {
              if (Object.keys(currentVessel).length > 1) {
                foundVesselsOnPage = true;
                pageMovements.push({
                  vessel: currentVessel.vessel || `Vessel ${allMovements.length + pageMovements.length + 1}`,
                  arrived: currentVessel.arrived || '',
                  dwt: currentVessel.dwt || '---',
                  grt: currentVessel.grt || '---',
                  built: currentVessel.built || '---',
                  size: currentVessel.size || '---',
                  vesselType: currentVessel.vesselType || 'General Cargo',
                  status: 'in-port',
                });
              }
            }
            // Convert UTC to Sydney time
            currentVessel = { arrived: convertToSydneyTime(dateMatch[1]) };
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
          pageMovements.push({
            vessel: currentVessel.vessel || `Vessel ${allMovements.length + pageMovements.length + 1}`,
            arrived: currentVessel.arrived || '',
            dwt: currentVessel.dwt || '---',
            grt: currentVessel.grt || '---',
            built: currentVessel.built || '---',
            size: currentVessel.size || '---',
            vesselType: currentVessel.vesselType || 'General Cargo',
            status: 'in-port',
          });
        }
      }

      allMovements = [...allMovements, ...pageMovements];
      console.log(`Found ${pageMovements.length} Newcastle vessels on page ${currentPage}`);

      // Pagination logic
      const hasNextPageButton = $('a[href*="page=' + (currentPage + 1) + '"]').length > 0 ||
                               $('a').filter((i, el) => $(el).text().includes('Next')).length > 0 ||
                               $('a').filter((i, el) => $(el).text().includes('→')).length > 0;
      
      const hasReasonableVesselCount = pageMovements.length > 0;
      
      if (!foundVesselsOnPage || !hasReasonableVesselCount || currentPage >= 10) {
        hasMorePages = false;
        if (currentPage >= 10) {
          console.log('Reached maximum page limit (10) for Newcastle port');
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

    console.log(`Total found ${allMovements.length} Newcastle in-port vessels across ${currentPage - 1} pages`);
    return allMovements;
  } catch (error) {
    console.error('Error scraping Newcastle in-port vessels:', error);
    return [];
  }
}

// Scrape Newcastle Expected Arrivals
async function scrapeNewcastleExpectedArrivals(): Promise<ExpectedArrival[]> {
  try {
    const response = await fetch('https://www.myshiptracking.com/estimate?pid=314', {
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
        
        // Convert UTC ETA to Sydney time
        const eta = convertToSydneyTime(etaRaw);
        
        const vesselMatch = vesselText.match(/([A-Z\s]+)\[([A-Z]{2})\]/);
        let vesselName = vesselText;
        let flag = '';
        
        if (vesselMatch) {
          vesselName = vesselMatch[1].trim();
          flag = vesselMatch[2];
        }
        
        // Determine vessel type for Newcastle (primarily coal/bulk cargo port)
        let vesselType = 'Bulk Carrier';
        if (vesselName.toLowerCase().includes('coal')) {
          vesselType = 'Coal Carrier';
        } else if (vesselName.toLowerCase().includes('container')) {
          vesselType = 'Container Ship';
        } else if (vesselName.toLowerCase().includes('tanker')) {
          vesselType = 'Tanker';
        }
        
        if (mmsi && mmsi.match(/^\d+$/)) {
          arrivals.push({
            mmsi,
            vessel: vesselName || 'Unknown Vessel',
            flag: flag || 'Unknown',
            port: port || 'NEWCASTLE',
            estimatedArrival: eta || 'Unknown',
            vesselType,
          });
        }
      }
    });

    return arrivals;
  } catch (error) {
    console.error('Error scraping Newcastle expected arrivals:', error);
    return [];
  }
}

// Scrape Newcastle Port Call History
// Fixed Port Call History Scraper Function for Newcastle
async function scrapeNewcastlePortCallHistory(): Promise<PortCallHistory[]> {
  try {
    let allPortCalls: PortCallHistory[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages && currentPage <= 5) { // Limit to 5 pages for performance
      console.log(`Scraping Newcastle port call history page ${currentPage}...`);
      
      const url = currentPage === 1 
        ? 'https://www.myshiptracking.com/ports-arrivals-departures/?pid=314'
        : `https://www.myshiptracking.com/ports-arrivals-departures/?pid=314&page=${currentPage}`;

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
        console.warn(`Failed to fetch Newcastle port call history page ${currentPage}: ${response.status}`);
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
          
          // Extract timestamp and convert to Sydney time (Newcastle is in NSW)
          const timestampRaw = timeCell.text().trim();
          if (!timestampRaw.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)) {
            return; // Skip if no valid timestamp
          }
          
          const timestamp = convertToSydneyTime(timestampRaw);
          
          // Extract port information
          const port = portCell.text().trim() || 'NEWCASTLE';
          
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
              let flag = 'AU'; // Default to Australia for Newcastle port
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
              let vesselType = 'Bulk Carrier'; // Newcastle default
              let iconType = '';
              const iconImg = vesselCell.find('img[src*="/icons/icon"]').first();
              if (iconImg.length) {
                const iconSrc = iconImg.attr('src') || '';
                const iconMatch = iconSrc.match(/icon(\d+)_/);
                if (iconMatch) {
                  iconType = iconMatch[1];
                  vesselType = getNewcastleVesselTypeFromIcon(iconSrc);
                }
              }
              
              // Newcastle-specific vessel type detection
              if (vesselText.toLowerCase().includes('coal')) {
                vesselType = 'Coal Carrier';
              } else if (vesselText.toLowerCase().includes('bulk')) {
                vesselType = 'Bulk Carrier';
              } else if (vesselText.toLowerCase().includes('container')) {
                vesselType = 'Container Ship';
              } else if (vesselText.toLowerCase().includes('tanker')) {
                vesselType = 'Tanker';
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
              
              // Newcastle-specific vessel type detection for text content
              let vesselType = 'Bulk Carrier';
              if (vesselText.toLowerCase().includes('coal')) {
                vesselType = 'Coal Carrier';
              } else if (vesselText.toLowerCase().includes('bulk')) {
                vesselType = 'Bulk Carrier';
              } else if (vesselText.toLowerCase().includes('container')) {
                vesselType = 'Container Ship';
              } else if (vesselText.toLowerCase().includes('tanker')) {
                vesselType = 'Tanker';
              }
              
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
              // Newcastle-specific vessel type detection
              let vesselType = 'Bulk Carrier';
              if (vesselName.toLowerCase().includes('coal')) {
                vesselType = 'Coal Carrier';
              } else if (vesselName.toLowerCase().includes('bulk')) {
                vesselType = 'Bulk Carrier';
              } else if (vesselName.toLowerCase().includes('container')) {
                vesselType = 'Container Ship';
              } else if (vesselName.toLowerCase().includes('tanker')) {
                vesselType = 'Tanker';
              }
              
              foundCallsOnPage = true;
              pagePortCalls.push({
                vessel: vesselName,
                mmsi: mmsiMatch ? mmsiMatch[1] : undefined,
                imo: imoMatch ? imoMatch[1] : undefined,
                flag: 'AU',
                event: eventMatch,
                timestamp: convertToSydneyTime(timeMatch[1]),
                port: 'NEWCASTLE',
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

    console.log(`Total collected ${finalPortCalls.length} unique Newcastle port calls across ${currentPage - 1} pages`);
    return finalPortCalls;
    
  } catch (error) {
    console.error('Error scraping Newcastle port call history:', error);
    return [];
  }
}

// Helper function to get vessel type from icon (Newcastle-specific)
function getNewcastleVesselTypeFromIcon(iconSrc: string): string {
  if (!iconSrc) return 'Bulk Carrier';
  
  // Map icon numbers to vessel types based on MyShipTracking patterns
  // Newcastle specializes in coal and bulk cargo
  if (iconSrc.includes('icon0_')) return 'Ferry/Passenger';
  if (iconSrc.includes('icon1_')) return 'Bulk Carrier';
  if (iconSrc.includes('icon2_')) return 'Tanker';
  if (iconSrc.includes('icon3_')) return 'Service Vessel/Tug';
  if (iconSrc.includes('icon4_')) return 'Passenger/Ferry';
  if (iconSrc.includes('icon5_')) return 'Cruise Ship';
  if (iconSrc.includes('icon6_')) return 'Small Passenger Vessel';
  if (iconSrc.includes('icon7_')) return 'Container/Cargo Ship';
  if (iconSrc.includes('icon8_')) return 'Tanker';
  if (iconSrc.includes('icon9_')) return 'Coal/Bulk Carrier';
  if (iconSrc.includes('icon10_')) return 'Yacht/Pleasure Craft';
  
  return 'Bulk Carrier'; // Default for Newcastle
}

// Update the PortCallHistory interface to include the port field
interface PortCallHistory {
  vessel: string;
  mmsi?: string;
  imo?: string;
  flag: string;
  event: 'arrival' | 'departure';
  timestamp: string;
  port?: string; // Added port field
  vesselType?: string;
  iconType?: string;
}
function processNewcastleData(
  inPortVessels: ShipMovement[], 
  expectedArrivals: ExpectedArrival[], 
  portCallHistory: PortCallHistory[]
): ProcessedNewcastleData {
  // Classify vessel types with Newcastle specialization
  const vesselTypes: { [key: string]: number } = {};
  
  inPortVessels.forEach(vessel => {
    const size = parseInt(vessel.size);
    let type = vessel.vesselType || 'Unknown';
    
    // Newcastle-specific classification
    if (vessel.vessel.toLowerCase().includes('coal')) {
      type = 'Coal Carrier';
    } else if (vessel.vessel.toLowerCase().includes('bulk')) {
      type = 'Bulk Carrier';
    } else if (size > 300) {
      type = 'Large Bulk Carrier';
    } else if (size > 200) {
      type = 'Medium Bulk Carrier';
    } else if (size > 100) {
      type = 'General Cargo';
    } else if (size > 50) {
      type = 'Coastal Vessel';
    } else {
      type = 'Small Craft';
    }
    
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

  // Newcastle-specific: Coal and Bulk carriers
  const coalCarriers = inPortVessels
    .filter(v => v.vesselType?.includes('Coal') || v.vessel.toLowerCase().includes('coal'))
    .slice(0, 10);

  const bulkCarriers = inPortVessels
    .filter(v => v.vesselType?.includes('Bulk') || v.vessel.toLowerCase().includes('bulk'))
    .slice(0, 10);

  return {
    totalVessels: inPortVessels.length + expectedArrivals.length,
    inPortCount: inPortVessels.length,
    expectedArrivals: expectedArrivals.length,
    portCallHistory: portCallHistory.length,
    vesselTypes,
    flagDistribution,
    recentArrivals,
    upcomingArrivals: expectedArrivals.slice(0, 10),
    largestVessels,
    recentPortCalls,
    coalCarriers,
    bulkCarriers,
    analysis: null,
  };
}

async function analyzeNewcastlePortData(
  processedData: ProcessedNewcastleData,
  inPortVessels: ShipMovement[],
  expectedArrivals: ExpectedArrival[],
  portCallHistory: PortCallHistory[]
) {
  try {
    const prompt = `
      Analyze this comprehensive vessel data for Port of Newcastle:

      PORT OF NEWCASTLE OVERVIEW:
      - Total Vessels Tracked: ${processedData.totalVessels}
      - Currently In Port: ${processedData.inPortCount}
      - Expected Arrivals: ${processedData.expectedArrivals}
      - Port Call History Records: ${processedData.portCallHistory}
      
      VESSEL DISTRIBUTION:
      - Vessel Types: ${JSON.stringify(processedData.vesselTypes, null, 2)}
      - Flag States: ${JSON.stringify(processedData.flagDistribution, null, 2)}
      - Coal Carriers: ${processedData.coalCarriers.length}
      - Bulk Carriers: ${processedData.bulkCarriers.length}
      
      OPERATIONAL DATA:
      Recent In-Port Vessels: ${JSON.stringify(processedData.recentArrivals.slice(0, 5), null, 2)}
      Upcoming Arrivals: ${JSON.stringify(processedData.upcomingArrivals.slice(0, 5), null, 2)}
      Largest Vessels: ${JSON.stringify(processedData.largestVessels.slice(0, 5), null, 2)}
      Recent Port Calls: ${JSON.stringify(processedData.recentPortCalls.slice(0, 10), null, 2)}

      NEWCASTLE CONTEXT:
      Newcastle is Australia's largest coal export port and a major bulk commodity port. Focus analysis on:
      - Coal export operations and capacity
      - Bulk carrier efficiency
      - Supply chain optimization
      - Environmental and sustainability considerations

      Provide comprehensive analysis in JSON format focusing on Newcastle's unique characteristics as a coal and bulk commodity port:
      {
        "port_activity_analysis": {
          "activity_level": "low/moderate/high/very_high",
          "capacity_utilization": "assessment of port capacity usage",
          "traffic_patterns": "analysis of vessel arrival/departure patterns",
          "operational_efficiency": "assessment of port operations",
          "coal_export_performance": "specific analysis of coal operations"
        },
        "vessel_composition": {
          "dominant_vessel_types": ["most common vessel categories"],
          "size_distribution": "analysis of vessel sizes",
          "flag_state_analysis": "insights about vessel origins",
          "coal_bulk_ratio": "ratio of coal carriers to other bulk vessels",
          "cargo_specialization": "analysis of cargo types and specialization"
        },
        "trade_insights": {
          "primary_trade_routes": ["main shipping routes identified"],
          "cargo_flow_patterns": "analysis of cargo movements",
          "coal_export_trends": "trends in coal export activity",
          "bulk_commodity_flows": "analysis of other bulk commodities",
          "economic_indicators": "port performance indicators"
        },
        "strategic_recommendations": {
          "operational_improvements": ["actionable recommendations"],
          "efficiency_gains": ["opportunities for optimization"],
          "environmental_initiatives": ["sustainability recommendations"],
          "capacity_expansion": ["growth and expansion opportunities"],
          "competitive_position": "assessment vs other Australian coal ports"
        },
        "newcastle_insights": {
          "unique_characteristics": "what makes Newcastle port distinctive",
          "coal_port_strengths": ["key strengths as coal export port"],
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
          content: "You are a maritime operations expert specializing in Australian bulk commodity ports, particularly coal export operations. Provide detailed analysis for Newcastle port operations focusing on coal and bulk cargo efficiency."
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
    console.error('Newcastle analysis error:', error);
    return {
      error: 'Failed to analyze Newcastle port data',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analyze = searchParams.get('analyze') === 'true';

    console.log('Scraping Port of Newcastle vessel data...');

    // Scrape all Newcastle data sources in parallel
    const [inPortVessels, expectedArrivals, portCallHistory] = await Promise.all([
      scrapeNewcastleInPortVessels(),
      scrapeNewcastleExpectedArrivals(),
      scrapeNewcastlePortCallHistory()
    ]);

    console.log(`Scraped Newcastle: ${inPortVessels.length} in-port, ${expectedArrivals.length} expected, ${portCallHistory.length} port calls`);

    // Fallback data if scraping fails
    if (inPortVessels.length === 0 && expectedArrivals.length === 0 && portCallHistory.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          scraped_at: new Date().toISOString(),
          port: 'Port of Newcastle',
          data_sources: [
            'MyShipTracking (In Port)', 
            'MyShipTracking (Expected Arrivals)', 
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
              vesselType: 'Bulk Carrier',
              status: 'in-port' as const,
            }],
            expected_arrivals: [],
            port_call_history: []
          },
          processed_data: {
            totalVessels: 0,
            inPortCount: 0,
            expectedArrivals: 0,
            portCallHistory: 0,
            vesselTypes: {},
            flagDistribution: {},
            recentArrivals: [],
            upcomingArrivals: [],
            largestVessels: [],
            recentPortCalls: [],
            coalCarriers: [],
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

    // Process the Newcastle data
    const processedData = processNewcastleData(inPortVessels, expectedArrivals, portCallHistory);
    
    let analysis = null;
    
    // Add AI analysis if requested
    if (analyze && (inPortVessels.length > 0 || expectedArrivals.length > 0 || portCallHistory.length > 0)) {
      console.log('Analyzing Newcastle port data with OpenAI...');
      analysis = await analyzeNewcastlePortData(
        processedData,
        inPortVessels,
        expectedArrivals,
        portCallHistory
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        scraped_at: new Date().toISOString(),
        port: 'Port of Newcastle',
        data_sources: [
          'MyShipTracking (In Port)',
          'MyShipTracking (Expected Arrivals)',
          'MyShipTracking (Port Call History)'
        ],
        raw_data: {
          in_port_vessels: inPortVessels,
          expected_arrivals: expectedArrivals,
          port_call_history: portCallHistory
        },
        processed_data: {
          ...processedData,
          analysis
        },
        summary: {
          total_data_points: inPortVessels.length + expectedArrivals.length + portCallHistory.length,
          sources_active: [
            inPortVessels.length > 0 ? 'In Port' : null,
            expectedArrivals.length > 0 ? 'Expected Arrivals' : null,
            portCallHistory.length > 0 ? 'Port Call History' : null
          ].filter(Boolean)
        }
      },
    });

  } catch (error) {
    console.error('Newcastle API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape Newcastle vessel data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { filters } = await request.json();
    
    // Scrape all Newcastle data sources
    const [inPortVessels, expectedArrivals, portCallHistory] = await Promise.all([
      scrapeNewcastleInPortVessels(),
      scrapeNewcastleExpectedArrivals(),
      scrapeNewcastlePortCallHistory()
    ]);
    
    // Apply filters if provided
    let filteredInPort = inPortVessels;
    let filteredArrivals = expectedArrivals;
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

      // Newcastle-specific filters
      if (filters.cargoType) {
        if (filters.cargoType === 'coal') {
          filteredInPort = filteredInPort.filter(v => 
            v.vessel.toLowerCase().includes('coal') || v.vesselType?.includes('Coal')
          );
          filteredArrivals = filteredArrivals.filter(a => 
            a.vessel.toLowerCase().includes('coal') || a.vesselType?.includes('Coal')
          );
          filteredPortCalls = filteredPortCalls.filter(pc => 
            pc.vessel.toLowerCase().includes('coal') || pc.vesselType?.includes('Coal')
          );
        } else if (filters.cargoType === 'bulk') {
          filteredInPort = filteredInPort.filter(v => 
            v.vessel.toLowerCase().includes('bulk') || v.vesselType?.includes('Bulk')
          );
          filteredArrivals = filteredArrivals.filter(a => 
            a.vessel.toLowerCase().includes('bulk') || a.vesselType?.includes('Bulk')
          );
          filteredPortCalls = filteredPortCalls.filter(pc => 
            pc.vessel.toLowerCase().includes('bulk') || pc.vesselType?.includes('Bulk')
          );
        }
      }
    }

    const processedData = processNewcastleData(filteredInPort, filteredArrivals, filteredPortCalls);
    
    // Always analyze for POST requests
    const analysis = await analyzeNewcastlePortData(
      processedData,
      filteredInPort,
      filteredArrivals,
      filteredPortCalls
    );

    return NextResponse.json({
      success: true,
      data: {
        scraped_at: new Date().toISOString(),
        filters_applied: filters,
        port: 'Port of Newcastle',
        total_found: {
          in_port: inPortVessels.length,
          expected: expectedArrivals.length,
          port_calls: portCallHistory.length
        },
        filtered_results: {
          in_port: filteredInPort.length,
          expected: filteredArrivals.length,
          port_calls: filteredPortCalls.length
        },
        raw_data: {
          in_port_vessels: filteredInPort,
          expected_arrivals: filteredArrivals,
          port_call_history: filteredPortCalls
        },
        processed_data: {
          ...processedData,
          analysis
        }
      },
    });

  } catch (error) {
    console.error('Newcastle POST API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process Newcastle vessel data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}