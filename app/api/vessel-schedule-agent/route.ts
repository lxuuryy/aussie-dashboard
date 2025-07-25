// app/api/vessel-schedule-agent/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { messages, vesselData } = await req.json();

  // Create a summary of vessel data for the AI context
  const vesselDataSummary = vesselData ? {
    totalMovements: vesselData.processed_data?.totalMovements || 0,
    arrivals: vesselData.processed_data?.arrivals || 0,
    departures: vesselData.processed_data?.departures || 0,
    shifts: vesselData.processed_data?.shifts || 0,
    lastUpdated: vesselData.scraped_at,
    allVessels: vesselData.raw_movements || [], // Send ALL vessel data, not just sample
    busyBerths: vesselData.processed_data?.busyBerths || [],
    vesselTypes: vesselData.processed_data?.vesselTypes || {}
  } : null;

  const systemPrompt = `You are an AI assistant for Newcastle Harbour vessel scheduling and port operations. Your role is to help users find information about vessel movements, schedules, berths, and port operations based on the current data.

CURRENT PORT DATA:
${vesselDataSummary ? `
- Total Movements: ${vesselDataSummary.totalMovements}
- Arrivals: ${vesselDataSummary.arrivals}
- Departures: ${vesselDataSummary.departures} 
- Shifts: ${vesselDataSummary.shifts}
- Last Updated: ${vesselDataSummary.lastUpdated}
- Busiest Berths: ${vesselDataSummary.busyBerths.join(', ')}
- Common Vessel Types: ${Object.keys(vesselDataSummary.vesselTypes).join(', ')}

ALL CURRENT VESSELS (Complete Dataset):
${JSON.stringify(vesselDataSummary.allVessels, null, 2)}
` : 'No vessel data currently available.'}

YOUR CAPABILITIES:
1. **Vessel Inquiries** - Look up specific vessels by name and provide movement details
2. **Port Status** - Provide current port congestion, traffic, and operational status
3. **Schedule Search** - Search by vessel, berth, agent, destination, or date
4. **Berth Information** - Check berth assignments and availability
5. **Timing Information** - Provide arrival/departure times and schedules
6. **Route Details** - Information about vessel origins and destinations

RESPONSE GUIDELINES:
- Be concise and helpful
- Focus only on scheduling and operational information
- Use the provided vessel data to answer questions accurately
- Count and analyze ALL vessels in the complete dataset when asked for quantities
- If you don't have specific information, explain what data is available
- Provide practical, actionable information for port users
- Format vessel information clearly with key details
- Use tables or lists when presenting multiple vessel results
- When counting vessel types, examine the ENTIRE dataset, not just samples

SEARCH AND INQUIRY TYPES:
- Vessel name searches (partial matches accepted)
- Berth availability and assignments (K1-K10, D1-D5, M1-M7, W1-W4)
- Agent information (WSA, MON, ISS, GAC, etc.)
- Movement types (Arrival, Departure, Shift)
- Date-based searches
- Destination/origin searches
- Vessel type counting and analysis

PORT OPERATIONS CONTEXT:
- Newcastle is a major coal and bulk cargo port
- Main berth areas: Kooragang (K), Dyke (D), Mayfield (M), West Basin (W)
- Common vessel types: Bulk Carriers, Tankers, General Cargo, Container ships
- Peak activity times vary by tide and berth availability

CARGO SHIP CLASSIFICATION:
- "Open Hatch Cargo Ship" = Cargo ship
- "General Cargo Ship" = Cargo ship  
- "Container Ship" = Cargo ship
- "Bulk Carrier" = NOT a cargo ship (bulk commodity transport)
- "Chemical/Products Tanker" = NOT a cargo ship (liquid transport)
- "LPG Tanker" = NOT a cargo ship (gas transport)

When users ask about vessels, always check the COMPLETE current dataset first. If information isn't available in the current dataset, suggest checking with port operations or trying a different search term.

Do not provide quotes, contact human agents, or handle commercial inquiries - focus only on schedule and operational information.`;

  const result = streamText({
    model: openai('gpt-4o'),
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    toolCallStreaming: true,
    tools: {
      // Tool to look up specific vessel information
      vesselInquiry: {
        description: 'Look up information about a specific vessel including arrival/departure times, berth assignments, and current status',
        parameters: z.object({
          vesselName: z.string().describe('Name of the vessel to look up (partial names accepted)'),
          inquiryType: z.enum(['arrival', 'departure', 'status', 'berth', 'general']).describe('Type of information requested about the vessel'),
        }),
      },
      
      // Tool to get port status and traffic information
      portStatus: {
        description: 'Get current port status, congestion levels, and operational information',
        parameters: z.object({
          requestType: z.enum(['congestion', 'availability', 'weather', 'operations', 'traffic']).describe('Type of port status information requested'),
        }),
      },

      // Tool to search schedules by various criteria
      scheduleSearch: {
        description: 'Search vessel schedules by vessel name, berth, agent, destination, or date',
        parameters: z.object({
          searchType: z.enum(['vessel', 'berth', 'agent', 'destination', 'date']).describe('Type of search to perform'),
          searchValue: z.string().describe('Value to search for (vessel name, berth code, agent code, destination, or date)'),
        }),
      },
    },
    maxSteps: 3,
  });

  return result.toDataStreamResponse();
}