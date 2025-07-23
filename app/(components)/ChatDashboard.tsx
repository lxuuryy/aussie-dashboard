'use client'
import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  updateDoc, 
  doc, 
  addDoc,
  serverTimestamp,
  where 
} from 'firebase/firestore';
import { 
  MessageCircle, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Send, 
  Phone, 
  Mail,
  Package,
  Calendar,
  X,
  Play,
  Pause,
  MessageSquare,
  Settings,
  Search,
  Filter,
  Archive,
  Star,
  MoreVertical,
  Eye,
  UserCheck,
  Zap,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// shadcn/ui imports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Import your Firebase instance
import { db } from '@/firebase';

interface HumanRequest {
  id: string;
  customerName: string;
  customerEmail: string;
  reason: string;
  urgency: 'low' | 'normal' | 'high';
  status: 'pending' | 'assigned' | 'in-progress' | 'resolved' | 'closed';
  conversationContext: string;
  products: string[];
  source: string;
  createdAt: any;
  lastUpdated: any;
  assignedAgentId?: string;
  assignedAgentName?: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  priority: string;
  agentNotes: string;
  followUpRequired: boolean;
  customerSatisfaction?: number;
}

interface ChatMessage {
  id: string;
  requestId: string;
  senderId: string;
  senderType: 'customer' | 'agent' | 'system';
  senderName: string;
  content: string;
  timestamp: any;
  read: boolean;
}

export default function ChatDashboard() {
  const [requests, setRequests] = useState<HumanRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<HumanRequest | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [agentStatus, setAgentStatus] = useState<'online' | 'busy' | 'offline'>('online');
  const [filter, setFilter] = useState<'all' | 'pending' | 'assigned' | 'in-progress'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [agentInfo] = useState({
    id: 'agent_steel_001',
    name: 'Steel Agent',
    email: 'agent@aussiesteel.com',
    phone: '04 4952 5928'
  });

  // Real-time listener for human requests from Firebase
  useEffect(() => {
    const requestsQuery = query(
      collection(db, 'humanRequests'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const requestsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HumanRequest[];
      
      setRequests(requestsData);
      setLoading(false);
      setError(null);
    }, (error) => {
      console.error('Error listening to human requests:', error);
      setLoading(false);
      setError('Failed to load requests. Please check your Firebase connection.');
    });

    return unsubscribe;
  }, []);

  // Real-time listener for chat messages when a request is selected
  useEffect(() => {
    if (!selectedRequest?.id) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, 'chatMessages'),
      where('requestId', '==', selectedRequest.id),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      
      setMessages(messagesData);
    }, (error) => {
      console.error('Error listening to chat messages:', error);
    });

    return unsubscribe;
  }, [selectedRequest?.id]);

  const filteredRequests = requests.filter(request => {
    const matchesFilter = filter === 'all' || request.status === filter;
    const matchesSearch = request.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.customerEmail.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const acceptRequest = async (requestId: string) => {
    try {
      // Accept request via API route
      const response = await fetch('/api/accept-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId,
          agentId: agentInfo.id,
          agentName: agentInfo.name
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to accept request');
      }
      
      const request = requests.find(r => r.id === requestId);
      if (request) {
        setSelectedRequest({ 
          ...request, 
          status: 'assigned', 
          assignedAgentId: agentInfo.id, 
          assignedAgentName: agentInfo.name 
        });
      }
      setIsSidebarOpen(false); // Close sidebar on mobile after selection
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Failed to accept request. Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedRequest) return;

    try {
      // Send message via API route
      const response = await fetch('/api/agent-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          senderId: agentInfo.id,
          senderName: agentInfo.name,
          content: messageInput.trim(),
          senderType: 'agent'
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }

      // Update request status to in-progress if it was just assigned
      if (selectedRequest.status === 'assigned') {
        await fetch('/api/update-request-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: selectedRequest.id,
            status: 'in-progress'
          })
        });
      }

      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const closeRequest = async (requestId: string) => {
    try {
      // Close request via API route
      const response = await fetch('/api/close-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId,
          agentId: agentInfo.id
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to close request');
      }

      setSelectedRequest(null);
      setMessages([]);
    } catch (error) {
      console.error('Error closing request:', error);
      alert('Failed to close request. Please try again.');
    }
  };

  const updateAgentNotes = async (requestId: string, notes: string) => {
    try {
      // Update notes via API route
      const response = await fetch('/api/update-agent-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId,
          agentNotes: notes
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        console.error('Failed to update notes:', result.error);
      }
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'normal': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'assigned': return 'secondary';
      case 'in-progress': return 'default';
      case 'resolved': return 'outline';
      default: return 'outline';
    }
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'busy': return '🟡';
      case 'offline': return '🔴';
      default: return '🟢';
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const assignedCount = requests.filter(r => r.status === 'assigned' && r.assignedAgentId === agentInfo.id).length;
  const inProgressCount = requests.filter(r => r.status === 'in-progress' && r.assignedAgentId === agentInfo.id).length;

  const quickResponses = [
    "Hi! I'm here to help you with your steel requirements.",
    "Let me check that pricing for you right away.",
    "I'll prepare a detailed quote for your project.",
    "Is there anything else I can help you with today?"
  ];

  // Sidebar content component
  const SidebarContent = () => (
    <div className="space-y-4 h-full flex flex-col">
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'assigned', 'in-progress'].map((filterType) => (
              <Button
                key={filterType}
                variant={filter === filterType ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(filterType as any)}
                className="text-xs"
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <MessageSquare className="w-4 h-4 mr-2" />
            Requests ({filteredRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] lg:h-[500px]">
            <div className="p-4 space-y-3">
              {filteredRequests.map((request) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
                    selectedRequest?.id === request.id 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    setSelectedRequest(request);
                    setIsSidebarOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">
                      {request.customerName || 'Anonymous'}
                    </span>
                    <div className="flex items-center space-x-1">
                      <Badge variant={getPriorityBadgeVariant(request.urgency)} className="text-xs">
                        {request.urgency}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(request.status)} className="text-xs">
                        {request.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{getTimeAgo(request.createdAt)}</span>
                    {request.customerEmail && (
                      <div className="flex items-center">
                        <Mail className="w-3 h-3 mr-1" />
                        <span className="truncate max-w-20">{request.customerEmail}</span>
                      </div>
                    )}
                  </div>
                  
                  {request.products.length > 0 && (
                    <div className="flex items-center text-xs text-muted-foreground mb-2">
                      <Package className="w-3 h-3 mr-1" />
                      <span className="truncate">{request.products.join(', ')}</span>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {request.reason}
                  </p>
                  
                  {request.status === 'pending' && (
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        acceptRequest(request.id);
                      }}
                      size="sm"
                      className="w-full mt-2"
                    >
                      Accept Chat
                    </Button>
                  )}
                </motion.div>
              ))}
              
              {filteredRequests.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="font-medium">No requests found</p>
                  <p className="text-xs mt-1">Requests will appear here when customers need help</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading chat dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
              <div>
                <CardTitle className="text-2xl lg:text-3xl">Steel Support Dashboard</CardTitle>
                <CardDescription>Manage customer requests and live chat support</CardDescription>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Select value={agentStatus} onValueChange={(value) => setAgentStatus(value as any)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">{getStatusEmoji('online')} Online</SelectItem>
                      <SelectItem value="busy">{getStatusEmoji('busy')} Busy</SelectItem>
                      <SelectItem value="offline">{getStatusEmoji('offline')} Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Agent: <span className="font-medium">{agentInfo.name}</span>
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <Card className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-100 text-sm">Pending</p>
                      <p className="text-2xl font-bold">{pendingCount}</p>
                    </div>
                    <Clock className="w-6 h-6 text-yellow-200" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Assigned</p>
                      <p className="text-2xl font-bold">{assignedCount}</p>
                    </div>
                    <UserCheck className="w-6 h-6 text-blue-200" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">In Progress</p>
                      <p className="text-2xl font-bold">{inProgressCount}</p>
                    </div>
                    <MessageCircle className="w-6 h-6 text-green-200" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">Total Today</p>
                      <p className="text-2xl font-bold">{requests.length}</p>
                    </div>
                    <Zap className="w-6 h-6 text-purple-200" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Mobile Sidebar */}
          <div className="lg:hidden">
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Menu className="w-4 h-4 mr-2" />
                  View Requests ({filteredRequests.length})
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full sm:max-w-md p-0">
                <div className="p-4 h-full">
                  <SidebarContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Sidebar */}
          <div className="hidden lg:block lg:col-span-4">
            <SidebarContent />
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-8">
            {selectedRequest ? (
              <Card className="h-[600px] lg:h-[650px] flex flex-col">
                {/* Chat Header */}
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {selectedRequest.customerName?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {selectedRequest.customerName || 'Anonymous Customer'}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          {selectedRequest.customerEmail && (
                            <div className="flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              <span className="truncate">{selectedRequest.customerEmail}</span>
                            </div>
                          )}
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {getTimeAgo(selectedRequest.createdAt)}
                          </div>
                          <div className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            Session: {selectedRequest.sessionId.slice(-8)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusBadgeVariant(selectedRequest.status)}>
                        {selectedRequest.status}
                      </Badge>
                      <Button 
                        onClick={() => closeRequest(selectedRequest.id)}
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 hidden sm:inline-flex"
                      >
                        ✓ Resolve
                      </Button>
                      <Button 
                        onClick={() => setSelectedRequest(null)}
                        variant="ghost"
                        size="sm"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Customer Context */}
                {selectedRequest.conversationContext && (
                  <div className="border-b bg-muted/20 p-4">
                    <ScrollArea className="h-32">
                      <h4 className="text-sm font-medium mb-1">🤖 AI Conversation Context:</h4>
                      <p className="text-sm text-muted-foreground mb-2">{selectedRequest.conversationContext}</p>
                      {selectedRequest.reason && (
                        <div className="mt-2">
                          <h4 className="text-sm font-medium">❓ Reason for Human Assistance:</h4>
                          <p className="text-sm font-medium">{selectedRequest.reason}</p>
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full p-4">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.senderType === 'agent' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] sm:max-w-[70%] rounded-lg px-4 py-2 ${
                            message.senderType === 'agent' 
                              ? 'bg-primary text-primary-foreground' 
                              : message.senderType === 'system'
                              ? 'bg-muted text-muted-foreground text-center text-sm border'
                              : 'bg-muted text-foreground border'
                          }`}>
                            {message.senderType === 'customer' && (
                              <div className="text-xs text-muted-foreground mb-1">{message.senderName}</div>
                            )}
                            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                            <div className="text-xs opacity-70 mt-1">
                              {getTimeAgo(message.timestamp)}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {messages.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageCircle className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                          <p className="text-lg font-medium">Start the conversation</p>
                          <p className="text-sm">Send your first message to {selectedRequest.customerName || 'the customer'}</p>
                          <p className="text-xs mt-2">💡 They will receive your messages in real-time</p>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>

                {/* Message Input */}
                {selectedRequest.status !== 'resolved' && selectedRequest.status !== 'closed' && (
                  <div className="border-t p-4 space-y-3">
                    <div className="flex items-center space-x-2">
                      <Input
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Type your message to the customer..."
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        className="flex-1"
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!messageInput.trim()}
                        size="sm"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Quick Responses */}
                    <div className="flex flex-wrap gap-2">
                      {quickResponses.map((response, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => setMessageInput(response)}
                          className="text-xs"
                        >
                          {response}
                        </Button>
                      ))}
                    </div>
                    
                    {/* Agent Notes */}
                    <div className="pt-3 border-t">
                      <label className="block text-sm font-medium mb-1">
                        📝 Internal Notes (not visible to customer):
                      </label>
                      <Textarea
                        value={selectedRequest.agentNotes || ''}
                        onChange={(e) => updateAgentNotes(selectedRequest.id, e.target.value)}
                        placeholder="Add private notes about this customer, requirements, follow-ups..."
                        className="text-sm"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="h-[600px] lg:h-[650px] flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground">
                  <MessageCircle className="w-20 h-20 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-xl font-medium mb-2">Select a Customer Request</h3>
                  <p className="text-muted-foreground mb-4">Choose a request from the list to start helping customers</p>
                  <div className="mt-6 text-sm space-y-1">
                    <p>💡 <span className="font-medium">Pending requests</span> need immediate attention</p>
                    <p>🔄 <span className="font-medium">Assigned requests</span> are ready for you to chat</p>
                    <p>💬 <span className="font-medium">In-progress</span> are active conversations</p>
                  </div>
                  <div className="lg:hidden mt-4">
                    <Button onClick={() => setIsSidebarOpen(true)} variant="outline">
                      <Menu className="w-4 h-4 mr-2" />
                      View All Requests
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}