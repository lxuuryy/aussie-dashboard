'use client'
import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown'; 
import { 
  Ship, 
  Send, 
  Loader2, 
  RefreshCw, 
  Bot,
  Anchor,
  MapPin,
  Clock,
  Search,
  Calendar,
  Activity,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Type definitions for tool calls
interface VesselInquiryArgs {
  vesselName: string;
  inquiryType: 'arrival' | 'departure' | 'status' | 'berth' | 'general';
}

interface PortStatusArgs {
  requestType: 'congestion' | 'availability' | 'weather' | 'operations' | 'traffic';
}

interface ScheduleSearchArgs {
  searchType: 'vessel' | 'berth' | 'agent' | 'destination' | 'date';
  searchValue: string;
}

interface VesselAIAssistantProps {
  vesselData?: any; // Current vessel movements data
}

// Custom markdown components
const markdownComponents = {
  p: ({ children, ...props }: any) => <p className="mb-2 leading-relaxed text-sm" {...props}>{children}</p>,
  strong: ({ children, ...props }: any) => <strong className="font-semibold text-slate-900" {...props}>{children}</strong>,
  ul: ({ children, ...props }: any) => <ul className="list-disc list-inside mb-2 space-y-1 text-sm" {...props}>{children}</ul>,
  ol: ({ children, ...props }: any) => <ol className="list-decimal list-inside mb-2 space-y-1 text-sm" {...props}>{children}</ol>,
  li: ({ children, ...props }: any) => <li className="text-sm" {...props}>{children}</li>,
  h3: ({ children, ...props }: any) => <h3 className="text-sm font-medium mb-2 text-slate-700" {...props}>{children}</h3>,
  code: ({ children, ...props }: any) => <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>,
};

export default function VesselScheduleAssistant({ vesselData }: VesselAIAssistantProps) {
  // Refs for UI
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Initialize chat with AI-SDK
  const { messages, input, handleInputChange, handleSubmit, setInput, reload, isLoading } = useChat({
    api: '/api/vessel-schedule-agent',
    body: { vesselData },
    initialMessages: [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: `Hello! I'm your Newcastle Port schedule assistant. I can help you find information about:

🚢 **Vessel Schedules** - Search for specific vessels and their movements
⚓ **Arrival & Departure Times** - Get precise timing information
🏢 **Berth Information** - Check which berths vessels are using
📍 **Agent Details** - Find shipping agents handling vessels
🌏 **Route Information** - Origin and destination details
📊 **Port Traffic** - Current port activity and congestion

Just ask me about any vessel, berth, or schedule information you need!`
      }
    ],
    maxSteps: 3,
    
    // Handle client-side tool execution
    async onToolCall({ toolCall }) {
      console.log("Tool call received:", toolCall);
      
      const typedToolCall = toolCall as any;
      
      switch (typedToolCall.toolName) {
        case 'vesselInquiry': {
          const { vesselName, inquiryType } = typedToolCall.args as VesselInquiryArgs;
          console.log(`Vessel inquiry for: ${vesselName}, type: ${inquiryType}`);
          
          try {
            // Search through vessel data for the requested vessel
            if (vesselData?.raw_movements) {
              const matchingVessels = vesselData.raw_movements.filter((vessel: any) =>
                vessel.vesselName.toLowerCase().includes(vesselName.toLowerCase())
              );
              
              if (matchingVessels.length > 0) {
                const vesselInfo = matchingVessels.map((v: any) => ({
                  name: v.vesselName,
                  movement: v.arrivalDeparture,
                  date: v.date,
                  time: v.time,
                  berth: v.to || v.from,
                  agent: v.agent,
                  type: v.vesselType,
                  status: v.inPort
                }));
                
                return `Found vessel information: ${JSON.stringify(vesselInfo, null, 2)}`;
              } else {
                return `No vessels found matching "${vesselName}". Please check the spelling or try a partial name.`;
              }
            }
            
            return `I'm searching for vessel "${vesselName}" in the current schedule data...`;
          } catch (error) {
            console.error("Error with vessel inquiry:", error);
            return "I encountered an error while looking up vessel information. Please try again.";
          }
        }

        case 'portStatus': {
          const { requestType } = typedToolCall.args as PortStatusArgs;
          console.log(`Port status request: ${requestType}`);
          
          try {
            if (vesselData?.processed_data) {
              const stats = {
                totalMovements: vesselData.processed_data.totalMovements,
                arrivals: vesselData.processed_data.arrivals,
                departures: vesselData.processed_data.departures,
                shifts: vesselData.processed_data.shifts,
                busyBerths: vesselData.processed_data.busyBerths,
                vesselTypes: vesselData.processed_data.vesselTypes
              };
              
              return `Current port status: ${JSON.stringify(stats, null, 2)}`;
            }
            
            return `I'm checking the current port ${requestType} status for Newcastle Harbour...`;
          } catch (error) {
            console.error("Error getting port status:", error);
            return "I encountered an error while checking port status. Please try again.";
          }
        }

        case 'scheduleSearch': {
          const { searchType, searchValue } = typedToolCall.args as ScheduleSearchArgs;
          console.log(`Schedule search: ${searchType} = ${searchValue}`);
          
          try {
            if (vesselData?.raw_movements) {
              let results: any[] = [];
              
              switch (searchType) {
                case 'vessel':
                  results = vesselData.raw_movements.filter((v: any) =>
                    v.vesselName.toLowerCase().includes(searchValue.toLowerCase())
                  );
                  break;
                case 'berth':
                  results = vesselData.raw_movements.filter((v: any) =>
                    v.to.toLowerCase().includes(searchValue.toLowerCase()) ||
                    v.from.toLowerCase().includes(searchValue.toLowerCase())
                  );
                  break;
                case 'agent':
                  results = vesselData.raw_movements.filter((v: any) =>
                    v.agent.toLowerCase().includes(searchValue.toLowerCase())
                  );
                  break;
                case 'destination':
                  results = vesselData.raw_movements.filter((v: any) =>
                    v.to.toLowerCase().includes(searchValue.toLowerCase()) ||
                    v.from.toLowerCase().includes(searchValue.toLowerCase())
                  );
                  break;
                case 'date':
                  results = vesselData.raw_movements.filter((v: any) =>
                    v.date.includes(searchValue)
                  );
                  break;
              }
              
              if (results.length > 0) {
                const searchResults = results.slice(0, 10).map((v: any) => ({
                  vessel: v.vesselName,
                  movement: v.arrivalDeparture,
                  date: v.date,
                  time: v.time,
                  berth: v.to || v.from,
                  agent: v.agent,
                  type: v.vesselType
                }));
                
                return `Search results for ${searchType} "${searchValue}": ${JSON.stringify(searchResults, null, 2)}`;
              } else {
                return `No results found for ${searchType} "${searchValue}". Please try a different search term.`;
              }
            }
            
            return `Searching schedule data for ${searchType}: ${searchValue}...`;
          } catch (error) {
            console.error("Error with schedule search:", error);
            return "I encountered an error while searching the schedule. Please try again.";
          }
        }
          
        default:
          return null;
      }
    },
  });
  
  // Auto scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Bot className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Schedule Assistant</CardTitle>
              <CardDescription>Ask me about vessel movements, berths, and schedules</CardDescription>
            </div>
          </div>
          
          <Button
            onClick={() => reload()}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Chat messages area */}
        <div 
          ref={chatContainerRef} 
          className="h-64 overflow-y-auto mb-4 space-y-3 p-3 bg-slate-50 rounded-lg border"
        >
          {messages.map((message, index) => (
            <motion.div 
              key={message.id} 
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <div 
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white border border-gray-200 text-slate-800'
                }`}
              >
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <ReactMarkdown components={markdownComponents}>
                    {message.content}
                  </ReactMarkdown>
                )}
              
                {/* Tool call indicators */}
                {message.parts?.map((part, i) => {
                  if (part.type === 'tool-invocation' && 
                      part.toolInvocation.state === 'call') {
                    
                    return (
                      <div key={i} className="mt-2 bg-blue-100 p-2 rounded border text-xs">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                          <span className="text-blue-700">
                            {part.toolInvocation.toolName === 'vesselInquiry' && 'Looking up vessel...'}
                            {part.toolInvocation.toolName === 'portStatus' && 'Checking port status...'}
                            {part.toolInvocation.toolName === 'scheduleSearch' && 'Searching schedules...'}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </motion.div>
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <motion.div 
                className="bg-white border border-gray-200 rounded-lg p-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <motion.div 
                      className="w-2 h-2 bg-blue-400 rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                    />
                    <motion.div 
                      className="w-2 h-2 bg-blue-400 rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    />
                    <motion.div 
                      className="w-2 h-2 bg-blue-400 rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    />
                  </div>
                  <span className="text-xs text-gray-600">Assistant is thinking...</span>
                </div>
              </motion.div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input area */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about vessel schedules, berths, or port information..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="sm" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Quick suggestion buttons */}
          <div className="flex flex-wrap gap-2">
            {[
              { text: "Port status", icon: <Activity className="w-3 h-3" /> },
              { text: "Search vessel", icon: <Ship className="w-3 h-3" /> },
              { text: "Berth availability", icon: <Anchor className="w-3 h-3" /> },
              { text: "Today's arrivals", icon: <Clock className="w-3 h-3" /> },
              { text: "Departure schedule", icon: <MapPin className="w-3 h-3" /> }
            ].map((suggestion, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInput(suggestion.text)}
                disabled={isLoading}
                className="text-xs h-7"
              >
                {suggestion.icon}
                <span className="ml-1">{suggestion.text}</span>
              </Button>
            ))}
          </div>
        </form>

        {/* Info about what the assistant can do */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700">
              <p className="font-medium mb-1">I can help you with:</p>
              <ul className="space-y-0.5 text-blue-600">
                <li>• Finding specific vessels and their schedules</li>
                <li>• Checking berth assignments and availability</li>
                <li>• Getting arrival and departure times</li>
                <li>• Port traffic and congestion information</li>
                <li>• Searching by vessel name, agent, or destination</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}