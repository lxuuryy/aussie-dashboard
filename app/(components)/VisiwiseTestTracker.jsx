import React, { useState, useEffect } from 'react';
import { Search, Package, Ship, FileText, Clock, CheckCircle, XCircle, AlertCircle, Tag, Plus, Trash2, Code, Server } from 'lucide-react';

const VisiWiseTracker = () => {
  const [activeTab, setActiveTab] = useState('setup');
  const [trackingData, setTrackingData] = useState({
    reference: '',
    shippingLine: '',
    trackingType: 'ContainerTracking'
  });
  const [shipments, setShipments] = useState([]);
  const [shippingLines, setShippingLines] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pollingShipments, setPollingShipments] = useState(new Set());

  // API function that calls our Next.js API routes
  const apiCall = async (endpoint, data = {}) => {
    try {
      const response = await fetch(`/api/visiwise/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  };

  // Load available shipping lines on component mount
  useEffect(() => {
    const loadShippingLines = async () => {
      try {
        const data = await apiCall('shipping-lines');
        setShippingLines(data);
      } catch (err) {
        setError('Failed to load shipping lines: ' + err.message);
      }
    };
    if (activeTab !== 'setup') {
      loadShippingLines();
    }
  }, [activeTab]);

  // Get available lines for current tracking type
  const getAvailableLines = () => {
    const typeMap = {
      'ContainerTracking': 'containerTrackingAvailableLines',
      'BLTracking': 'blTrackingAvailableLines',
      'BookingTracking': 'bookingTrackingAvailableLines'
    };
    return shippingLines[typeMap[trackingData.trackingType]] || [];
  };

  // Create new shipment
  const createShipment = async () => {
    if (!trackingData.reference || !trackingData.shippingLine) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiCall('create-shipment', {
        trackingReference: trackingData.reference,
        shippingLine: trackingData.shippingLine,
        trackingType: trackingData.trackingType
      });
      
      const shipmentId = data.shipmentId;
      
      // Start polling for this shipment
      setPollingShipments(prev => new Set(prev).add(shipmentId));
      pollShipmentStatus(shipmentId);
      
      // Reset form
      setTrackingData({ reference: '', shippingLine: '', trackingType: 'ContainerTracking' });
      
    } catch (err) {
      setError('Failed to create shipment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll shipment status
  const pollShipmentStatus = async (shipmentId) => {
    try {
      const data = await apiCall('get-shipment', { shipmentId });
      const shipment = data.shipment;
      
      // Update shipments list
      setShipments(prev => {
        const existing = prev.find(s => s.id === shipmentId);
        if (existing) {
          return prev.map(s => s.id === shipmentId ? shipment : s);
        } else {
          return [...prev, shipment];
        }
      });

      // Check if still tracking
      const trackingObj = shipment.containerTracking || shipment.blTracking || shipment.bookingTracking;
      if (trackingObj && trackingObj.trackStatus.status === 'Is-Tracking') {
        // Continue polling after 3 seconds
        setTimeout(() => pollShipmentStatus(shipmentId), 3000);
      } else {
        // Stop polling
        setPollingShipments(prev => {
          const newSet = new Set(prev);
          newSet.delete(shipmentId);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Error polling shipment:', err);
      setPollingShipments(prev => {
        const newSet = new Set(prev);
        newSet.delete(shipmentId);
        return newSet;
      });
    }
  };

  // Update existing shipment
  const updateShipment = async (shipmentId) => {
    try {
      await apiCall('update-shipment', { shipmentId });
      setPollingShipments(prev => new Set(prev).add(shipmentId));
      pollShipmentStatus(shipmentId);
    } catch (err) {
      setError('Failed to update shipment: ' + err.message);
    }
  };

  // Add tag to shipment
  const addTag = async (shipmentId, tagName) => {
    if (!tagName.trim()) return;
    
    try {
      await apiCall('add-tag', { shipmentId, tags: [tagName.trim()] });
      pollShipmentStatus(shipmentId); // Refresh shipment data
    } catch (err) {
      setError('Failed to add tag: ' + err.message);
    }
  };

  // Remove tag from shipment
  const removeTag = async (shipmentId, tagName) => {
    try {
      await apiCall('remove-tag', { shipmentId, tags: [tagName] });
      pollShipmentStatus(shipmentId); // Refresh shipment data
    } catch (err) {
      setError('Failed to remove tag: ' + err.message);
    }
  };

  // Status icon component
  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'Track-Succeeded':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'Track-Failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'Is-Tracking':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Setup instructions component
  const SetupInstructions = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Server className="w-5 h-5" />
          API Routes Setup (App Router)
        </h2>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-yellow-800">
            <strong>CORS Issue:</strong> The Visiwise API doesn't allow direct browser calls. You need to set up Next.js API routes.
          </p>
        </div>

        <p className="mb-4">
          Create these API route files in your Next.js App Router project:
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" />
              1. Create: app/api/visiwise/shipping-lines/route.ts
            </h3>
            <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm"><code>{`const VISIWISE_API_URL = 'https://www.visiwise.co/api-graphql/';
const API_TOKEN = '303d880f2196dfe75506586209cfc5e534f07384';

const graphqlQuery = async (query: string, variables = {}) => {
  const response = await fetch(VISIWISE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Token \${API_TOKEN}\`
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data;
};

export async function POST() {
  try {
    const result = await graphqlQuery(\`
      query AvailableShippingLines {
        containerTrackingAvailableLines { name keyname }
        blTrackingAvailableLines { name keyname }
        bookingTrackingAvailableLines { name keyname }
      }
    \`);
    
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}`}</code></pre>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" />
              2. Create: app/api/visiwise/create-shipment/route.ts
            </h3>
            <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm"><code>{`// Copy the same graphqlQuery function from above

export async function POST(request: Request) {
  try {
    const { trackingReference, shippingLine, trackingType } = await request.json();
    
    const result = await graphqlQuery(\`
      mutation CreateShipment($createShipmentInput: CreateShipmentInput!) {
        createShipment(createShipmentInput: $createShipmentInput) {
          createdShipment { id }
        }
      }
    \`, {
      createShipmentInput: {
        trackingInput: { trackingReference, shippingLine, trackingType },
        withTracking: true
      }
    });
    
    return Response.json({ 
      shipmentId: result.createShipment.createdShipment.id 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}`}</code></pre>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" />
              3. Create: app/api/visiwise/get-shipment/route.ts
            </h3>
            <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm"><code>{`// Copy the same graphqlQuery function from above

export async function POST(request: Request) {
  try {
    const { shipmentId } = await request.json();
    
    const result = await graphqlQuery(\`
      query Shipment($shipmentId: ID!) {
        shipment(id: $shipmentId) {
          id trackingReference
          containerTracking {
            id number
            trackStatus { status exception }
            shippingLine { name keyname }
            arrivalTime { value isActual }
            lastMovementEventDescription
            portOfLoading { unlocodeName }
            portOfDischarge { unlocodeName }
          }
          blTracking {
            id number
            trackStatus { status exception }
            shippingLine { name keyname }
            placeOfReceipt { unlocodeName }
            portOfLoading { unlocodeName }
            portOfDischarge { unlocodeName }
            placeOfDelivery { unlocodeName }
            containers {
              id number
              trackStatus { status }
              arrivalTime { value isActual }
            }
          }
          bookingTracking {
            id number
            trackStatus { status exception }
            shippingLine { name keyname }
            arrivalTime { value isActual }
          }
          tags { name }
        }
      }
    \`, { shipmentId });
    
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}`}</code></pre>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" />
              4. Create: app/api/visiwise/update-shipment/route.ts
            </h3>
            <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm"><code>{`// Copy the same graphqlQuery function from above

export async function POST(request: Request) {
  try {
    const { shipmentId } = await request.json();
    
    await graphqlQuery(\`
      mutation UpdateShipment($shipmentId: ID!) {
        updateShipment(shipmentId: $shipmentId) {
          success
        }
      }
    \`, { shipmentId });
    
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}`}</code></pre>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" />
              5. Create: app/api/visiwise/add-tag/route.ts
            </h3>
            <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm"><code>{`// Copy the same graphqlQuery function from above

export async function POST(request: Request) {
  try {
    const { shipmentId, tags } = await request.json();
    
    await graphqlQuery(\`
      mutation AddShipmentTag($shipmentId: ID!, $tags: [String]!) {
        addShipmentTag(shipmentId: $shipmentId, tags: $tags) {
          tags { name }
        }
      }
    \`, { shipmentId, tags });
    
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}`}</code></pre>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" />
              6. Create: app/api/visiwise/remove-tag/route.ts
            </h3>
            <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm"><code>{`// Copy the same graphqlQuery function from above

export async function POST(request: Request) {
  try {
    const { shipmentId, tags } = await request.json();
    
    await graphqlQuery(\`
      mutation RemoveShipmentTag($shipmentId: ID!, $tags: [String]!) {
        removeShipmentTag(shipmentId: $shipmentId, tags: $tags) {
          tags { name }
        }
      }
    \`, { shipmentId, tags });
    
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}`}</code></pre>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              <strong>💡 Tip:</strong> After creating these files, restart your Next.js dev server and switch to the "Track New" tab to start using the app!
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Sample Test Data:</h4>
            <ul className="text-blue-700 text-sm space-y-1">
              <li><strong>Container:</strong> DFSU7162007 (MSC)</li>
              <li><strong>Bill of Lading:</strong> HLCUSS5201107911 (Hapag-Lloyd)</li>
              <li><strong>Booking:</strong> Try any booking reference with supported carriers</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  // Tracking form component
  const TrackingForm = () => (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Search className="w-5 h-5" />
        Track New Shipment
      </h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tracking Type</label>
          <select
            className="w-full p-2 border rounded-md"
            value={trackingData.trackingType}
            onChange={(e) => setTrackingData({...trackingData, trackingType: e.target.value, shippingLine: ''})}
          >
            <option value="ContainerTracking">Container</option>
            <option value="BLTracking">Bill of Lading</option>
            <option value="BookingTracking">Booking</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Reference Number</label>
          <input
            type="text"
            placeholder="Enter tracking reference (e.g., DFSU7162007)"
            className="w-full p-2 border rounded-md"
            value={trackingData.reference}
            onChange={(e) => setTrackingData({...trackingData, reference: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Shipping Line</label>
          <select
            className="w-full p-2 border rounded-md"
            value={trackingData.shippingLine}
            onChange={(e) => setTrackingData({...trackingData, shippingLine: e.target.value})}
          >
            <option value="">Select shipping line</option>
            {getAvailableLines().map(line => (
              <option key={line.keyname} value={line.keyname}>
                {line.name} ({line.keyname})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={createShipment}
          disabled={loading}
          className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Clock className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {loading ? 'Creating...' : 'Track Shipment'}
        </button>
      </div>
    </div>
  );

  // Shipment card component
  const ShipmentCard = ({ shipment }) => {
    const [newTag, setNewTag] = useState('');
    const tracking = shipment.containerTracking || shipment.blTracking || shipment.bookingTracking;
    const isPolling = pollingShipments.has(shipment.id);
    
    const getTrackingIcon = () => {
      if (shipment.containerTracking) return <Package className="w-5 h-5" />;
      if (shipment.blTracking) return <FileText className="w-5 h-5" />;
      return <Ship className="w-5 h-5" />;
    };

    return (
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            {getTrackingIcon()}
            <div>
              <h3 className="font-semibold">{shipment.trackingReference}</h3>
              <p className="text-sm text-gray-600">{tracking?.shippingLine?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <StatusIcon status={tracking?.trackStatus?.status} />
            <span className="text-sm font-medium">{tracking?.trackStatus?.status || 'Unknown'}</span>
          </div>
        </div>

        {/* Tracking Details */}
        <div className="space-y-2 mb-4">
          {tracking?.arrivalTime && (
            <p className="text-sm">
              <strong>Arrival:</strong> {formatDate(tracking.arrivalTime.value)} 
              {tracking.arrivalTime.isActual && <span className="text-green-600 ml-1">(Actual)</span>}
            </p>
          )}
          
          {tracking?.lastMovementEventDescription && (
            <p className="text-sm">
              <strong>Last Event:</strong> {tracking.lastMovementEventDescription}
            </p>
          )}

          {tracking?.portOfLoading && (
            <p className="text-sm">
              <strong>From:</strong> {tracking.portOfLoading.unlocodeName}
            </p>
          )}

          {tracking?.portOfDischarge && (
            <p className="text-sm">
              <strong>To:</strong> {tracking.portOfDischarge.unlocodeName}
            </p>
          )}

          {shipment.blTracking?.containers && shipment.blTracking.containers.length > 0 && (
            <div className="text-sm">
              <strong>Containers:</strong>
              <div className="ml-2 mt-1 space-y-1">
                {shipment.blTracking.containers.map(container => (
                  <div key={container.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                    <span>{container.number}</span>
                    <StatusIcon status={container.trackStatus.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tracking?.trackStatus?.exception && (
            <p className="text-sm text-red-600">
              <strong>Error:</strong> {tracking.trackStatus.exception}
            </p>
          )}
        </div>

        {/* Tags */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4" />
            <span className="text-sm font-medium">Tags:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {shipment.tags?.map(tag => (
              <span
                key={tag.name}
                className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
              >
                {tag.name}
                <button
                  onClick={() => removeTag(shipment.id, tag.name)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="Add tag"
              className="flex-1 text-sm p-1 border rounded"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addTag(shipment.id, newTag);
                  setNewTag('');
                }
              }}
            />
            <button
              onClick={() => {
                addTag(shipment.id, newTag);
                setNewTag('');
              }}
              className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => updateShipment(shipment.id)}
            disabled={isPolling}
            className="flex-1 bg-gray-500 text-white p-2 rounded text-sm hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {isPolling ? <Clock className="w-4 h-4 animate-spin" /> : 'Update'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Visiwise Shipment Tracker</h1>
          <p className="text-gray-600">Track containers, bills of lading, and bookings across multiple shipping lines</p>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button onClick={() => setError('')} className="float-right font-bold">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex mb-6 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'setup' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Setup Instructions
          </button>
          <button
            onClick={() => setActiveTab('track')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'track' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Track New
          </button>
          <button
            onClick={() => setActiveTab('shipments')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'shipments' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            My Shipments ({shipments.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'setup' && <SetupInstructions />}
        {activeTab === 'track' && <TrackingForm />}
        
        {activeTab === 'shipments' && (
          <div className="space-y-4">
            {shipments.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <Ship className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No shipments tracked yet. Start by tracking a new shipment!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {shipments.map(shipment => (
                  <ShipmentCard key={shipment.id} shipment={shipment} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisiWiseTracker;