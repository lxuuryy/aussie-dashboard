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
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'assigned': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in-progress': return 'bg-green-100 text-green-800 border-green-200';
      case 'resolved': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const assignedCount = requests.filter(r => r.status === 'assigned' && r.assignedAgentId === agentInfo.id).length;
  const inProgressCount = requests.filter(r => r.status === 'in-progress' && r.assignedAgentId === agentInfo.id).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Steel Support Dashboard</h1>
              <p className="text-gray-600">Manage customer requests and live chat support</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Agent Status:</span>
                <select 
                  value={agentStatus}
                  onChange={(e) => setAgentStatus(e.target.value as any)}
                  className="border rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="online">🟢 Online</option>
                  <option value="busy">🟡 Busy</option>
                  <option value="offline">🔴 Offline</option>
                </select>
              </div>
              
              <div className="text-sm text-gray-600">
                Agent: <span className="font-medium">{agentInfo.name}</span>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100">Pending Requests</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-200" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100">Assigned to Me</p>
                  <p className="text-2xl font-bold">{assignedCount}</p>
                </div>
                <UserCheck className="w-8 h-8 text-blue-200" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100">In Progress</p>
                  <p className="text-2xl font-bold">{inProgressCount}</p>
                </div>
                <MessageCircle className="w-8 h-8 text-green-200" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100">Total Today</p>
                  <p className="text-2xl font-bold">{requests.length}</p>
                </div>
                <Zap className="w-8 h-8 text-purple-200" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Requests List */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center space-x-3 mb-4">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 border-0 focus:outline-none text-sm"
                />
              </div>
              
              <div className="flex space-x-2">
                {['all', 'pending', 'assigned', 'in-progress'].map((filterType) => (
                  <button
                    key={filterType}
                    onClick={() => setFilter(filterType as any)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filter === filterType
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Requests */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-blue-500" />
                Customer Requests ({filteredRequests.length})
              </h3>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredRequests.map((request) => (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedRequest?.id === request.id 
                        ? 'border-blue-400 bg-blue-50 shadow-md' 
                        : 'hover:shadow-md hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {request.customerName || 'Anonymous'}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(request.urgency)}`}>
                          {request.urgency}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>{getTimeAgo(request.createdAt)}</span>
                      {request.customerEmail && (
                        <div className="flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          <span className="truncate max-w-24">{request.customerEmail}</span>
                        </div>
                      )}
                    </div>
                    
                    {request.products.length > 0 && (
                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <Package className="w-3 h-3 mr-1" />
                        <span className="truncate">{request.products.join(', ')}</span>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-600 truncate mb-2">
                      {request.reason}
                    </p>
                    
                    {request.status === 'pending' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          acceptRequest(request.id);
                        }}
                        className="w-full mt-2 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded text-sm transition-colors font-medium"
                      >
                        Accept Chat
                      </button>
                    )}
                  </motion.div>
                ))}
                
                {filteredRequests.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No requests found</p>
                    <p className="text-xs mt-1">Requests will appear here when customers need help</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="col-span-12 lg:col-span-8">
            {selectedRequest ? (
              <div className="bg-white rounded-xl shadow-lg h-[650px] flex flex-col">
                {/* Chat Header */}
                <div className="border-b p-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {selectedRequest.customerName?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {selectedRequest.customerName || 'Anonymous Customer'}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        {selectedRequest.customerEmail && (
                          <div className="flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {selectedRequest.customerEmail}
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
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedRequest.status)}`}>
                      {selectedRequest.status}
                    </span>
                    <button 
                      onClick={() => closeRequest(selectedRequest.id)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors font-medium"
                    >
                      ✓ Resolve
                    </button>
                    <button 
                      onClick={() => setSelectedRequest(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Customer Context */}
                {selectedRequest.conversationContext && (
                  <div className="border-b p-4 bg-gray-50 max-h-32 overflow-y-auto">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">🤖 AI Conversation Context:</h4>
                    <p className="text-sm text-gray-600 mb-2">{selectedRequest.conversationContext}</p>
                    {selectedRequest.reason && (
                      <div className="mt-2">
                        <h4 className="text-sm font-medium text-gray-700">❓ Reason for Human Assistance:</h4>
                        <p className="text-sm text-gray-600 font-medium">{selectedRequest.reason}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.senderType === 'agent' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        message.senderType === 'agent' 
                          ? 'bg-blue-500 text-white' 
                          : message.senderType === 'system'
                          ? 'bg-yellow-100 text-yellow-800 text-center text-sm border border-yellow-200'
                          : 'bg-white text-gray-800 border'
                      }`}>
                        {message.senderType === 'customer' && (
                          <div className="text-xs text-gray-500 mb-1">{message.senderName}</div>
                        )}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <div className="text-xs opacity-70 mt-1">
                          {getTimeAgo(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {messages.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-lg font-medium">Start the conversation</p>
                      <p className="text-sm">Send your first message to {selectedRequest.customerName || 'the customer'}</p>
                      <p className="text-xs mt-2 text-gray-400">💡 They will receive your messages in real-time</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                {selectedRequest.status !== 'resolved' && selectedRequest.status !== 'closed' && (
                  <div className="border-t p-4 bg-white">
                    <div className="flex items-center space-x-3 mb-3">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Type your message to the customer..."
                        className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!messageInput.trim()}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white p-2 rounded-lg transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Quick Responses */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[
                        "Hi! I'm here to help you with your steel requirements.",
                        "Let me check that pricing for you right away.",
                        "I'll prepare a detailed quote for your project.",
                        "Is there anything else I can help you with today?"
                      ].map((response, index) => (
                        <button
                          key={index}
                          onClick={() => setMessageInput(response)}
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-full transition-colors"
                        >
                          {response}
                        </button>
                      ))}
                    </div>
                    
                    {/* Agent Notes */}
                    <div className="pt-3 border-t">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        📝 Internal Notes (not visible to customer):
                      </label>
                      <textarea
                        value={selectedRequest.agentNotes || ''}
                        onChange={(e) => updateAgentNotes(selectedRequest.id, e.target.value)}
                        placeholder="Add private notes about this customer, requirements, follow-ups..."
                        className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg h-[650px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MessageCircle className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-medium mb-2">Select a Customer Request</h3>
                  <p className="text-gray-400 mb-4">Choose a request from the list to start helping customers</p>
                  <div className="mt-6 text-sm text-gray-400 space-y-1">
                    <p>💡 <span className="font-medium">Pending requests</span> need immediate attention</p>
                    <p>🔄 <span className="font-medium">Assigned requests</span> are ready for you to chat</p>
                    <p>💬 <span className="font-medium">In-progress</span> are active conversations</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}