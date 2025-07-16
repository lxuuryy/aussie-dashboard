'use client';

import { useState, useEffect } from 'react';

// Use local API route to avoid CORS issues
const API_URL = '/api/visiwise';

const VisiwiseTracker = () => {
  const [trackingData, setTrackingData] = useState({
    reference: '',
    trackingType: 'ContainerTracking',
    shippingLine: '',
    autoDetect: true
  });
  const [availableLines, setAvailableLines] = useState({
    container: [],
    bl: [],
    booking: []
  });
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(false);
  const [tryingShippingLines, setTryingShippingLines] = useState([]);
  const [currentAttempt, setCurrentAttempt] = useState(0);

  // GraphQL queries and mutations
  const GET_AVAILABLE_LINES = `
    query AvailableShippingLines {
      containerTrackingAvailableLines {
        name
        keyname
      }
      bookingTrackingAvailableLines {
        name
        keyname
      }
      blTrackingAvailableLines {
        name
        keyname
      }
    }
  `;

  const CREATE_SHIPMENT = `
    mutation CreateShipment($createShipmentInput: CreateShipmentInput!) {
      createShipment(createShipmentInput: $createShipmentInput) {
        createdShipment {
          id
        }
      }
    }
  `;

  const GET_SHIPMENT = `
    query Shipment($shipmentId: ID!) {
      shipment(id: $shipmentId) {
        id
        trackingReference
        containerTracking {
          id
          number
          trackStatus {
            status
            exception
          }
          shippingLine {
            name
            keyname
          }
          arrivalTime {
            value
            isActual
          }
          lastMovementEventDescription
          portOfLoading {
            unlocodeName
          }
          portOfDischarge {
            unlocodeName
          }
        }
        blTracking {
          id
          number
          trackStatus {
            status
            exception
          }
          shippingLine {
            name
          }
          placeOfReceipt {
            unlocodeName
          }
          portOfLoading {
            unlocodeName
          }
          portOfDischarge {
            unlocodeName
          }
          placeOfDelivery {
            unlocodeName
          }
          containers {
            id
            number
            trackStatus {
              status
            }
            arrivalTime {
              value
              isActual
            }
          }
        }
        bookingTracking {
          id
          trackStatus {
            status
            exception
          }
          shippingLine {
            name
          }
          arrivalTime {
            value
            isActual
          }
        }
      }
    }
  `;

  const UPDATE_SHIPMENT = `
    mutation UpdateShipment($shipmentId: ID!) {
      updateShipment(shipmentId: $shipmentId) {
        success
      }
    }
  `;

  // API call function
  const callAPI = async (query, variables = {}) => {
    try {
      console.log('🚀 Making API call:', { query: query.substring(0, 100) + '...', variables });
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      console.log('📡 API Response status:', response.status);
      
      const result = await response.json();
      console.log('📄 API Response data (detailed):', JSON.stringify(result, null, 2));
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${result.error || result.message || 'Unknown error'}`);
      }
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      return result.data;
    } catch (err) {
      console.error('❌ API call failed:', err);
      throw new Error(`API Error: ${err.message}`);
    }
  };

  // Load available shipping lines on component mount
  useEffect(() => {
    const loadAvailableLines = async () => {
      try {
        console.log('🔄 Loading available shipping lines...');
        const data = await callAPI(GET_AVAILABLE_LINES);
        setAvailableLines({
          container: data.containerTrackingAvailableLines,
          bl: data.blTrackingAvailableLines,
          booking: data.bookingTrackingAvailableLines
        });
        console.log('✅ Successfully loaded shipping lines:', {
          containerLines: data.containerTrackingAvailableLines?.length || 0,
          blLines: data.blTrackingAvailableLines?.length || 0,
          bookingLines: data.bookingTrackingAvailableLines?.length || 0,
          sampleContainerLines: data.containerTrackingAvailableLines?.slice(0, 5)
        });
      } catch (err) {
        console.error('❌ Failed to load shipping lines:', err);
        setError(`Failed to load shipping lines: ${err.message}. This could mean:\n- API token needs activation\n- IP address needs whitelisting\n- Token has expired\n\nContact technical@visiwise.co for assistance.`);
      }
    };
    
    loadAvailableLines();
  }, []);

  // Test function with exact documentation example
  const testWithDocExample = async () => {
    console.log('🧪 Testing with documentation example...');
    try {
      const testQuery = `
        mutation CreateShipment($createShipmentInput: CreateShipmentInput!) {
          createShipment(createShipmentInput: $createShipmentInput) {
            createdShipment {
              id
            }
          }
        }
      `;
      
      const testVariables = {
        "createShipmentInput": {
          "trackingInput": {
            "trackingReference": "DFSU7162007",
            "shippingLine": "MSC",
            "trackingType": "ContainerTracking"
          },
          "withTracking": true
        }
      };
      
      const result = await callAPI(testQuery, testVariables);
      console.log('✅ Documentation example worked!', result);
    } catch (err) {
      console.error('❌ Documentation example failed:', err);
    }
  };

  // Get current available lines based on tracking type
  const getCurrentLines = () => {
    switch (trackingData.trackingType) {
      case 'ContainerTracking':
        return availableLines.container;
      case 'BLTracking':
        return availableLines.bl;
      case 'BookingTracking':
        return availableLines.booking;
      default:
        return [];
    }
  };

  // Create shipment with auto-detection or manual selection
  const createShipment = async () => {
    if (!trackingData.reference) {
      setError('Please enter a tracking reference');
      return;
    }

    if (!trackingData.autoDetect && !trackingData.shippingLine) {
      setError('Please select a shipping line');
      return;
    }

    setLoading(true);
    setError('');
    setShipment(null);
    setCurrentAttempt(0);

    if (trackingData.autoDetect) {
      // Auto-detection mode
      const linesToTry = getCurrentLines();
      setTryingShippingLines(linesToTry);
      await tryShippingLines(linesToTry, 0);
    } else {
      // Manual selection mode
      await createSingleShipment(trackingData.shippingLine);
    }
  };

  // Create shipment with specific shipping line
  const createSingleShipment = async (shippingLineKeyname) => {
    try {
      console.log('🚢 Creating shipment with selected shipping line:', shippingLineKeyname);
      
      const data = await callAPI(CREATE_SHIPMENT, {
        createShipmentInput: {
          trackingInput: {
            trackingReference: trackingData.reference,
            shippingLine: shippingLineKeyname,
            trackingType: trackingData.trackingType
          },
          withTracking: true
        }
      });

      const shipmentId = data.createShipment.createdShipment.id;
      console.log('✅ Shipment created successfully:', shipmentId);
      
      // Start polling for results
      await pollShipmentStatusWithTimeout(shipmentId, 'Selected Line');
      
    } catch (err) {
      console.error('❌ Failed to create shipment:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Try shipping lines one by one
  const tryShippingLines = async (lines, attemptIndex) => {
    if (attemptIndex >= lines.length) {
      setError('Unable to track this reference with any available shipping line. Please verify the tracking number and type.');
      setLoading(false);
      setTryingShippingLines([]);
      return;
    }

    const currentLine = lines[attemptIndex];
    setCurrentAttempt(attemptIndex + 1);

    try {
      const data = await callAPI(CREATE_SHIPMENT, {
        createShipmentInput: {
          trackingInput: {
            trackingReference: trackingData.reference,
            shippingLine: currentLine.keyname,
            trackingType: trackingData.trackingType
          },
          withTracking: true
        }
      });

      const shipmentId = data.createShipment.createdShipment.id;
      
      // Start polling for results
      const success = await pollShipmentStatusWithTimeout(shipmentId, currentLine.name);
      
      if (!success) {
        // Try next shipping line
        setTimeout(() => tryShippingLines(lines, attemptIndex + 1), 1000);
      } else {
        setTryingShippingLines([]);
      }
      
    } catch (err) {
      // If this shipping line fails, try the next one
      setTimeout(() => tryShippingLines(lines, attemptIndex + 1), 1000);
    }
  };

  // Poll shipment status with timeout for auto-detection
  const pollShipmentStatusWithTimeout = async (shipmentId, shippingLineName) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 15; // 45 seconds max per shipping line (increased)
    
    return new Promise((resolve) => {
      const poll = async () => {
        try {
          console.log(`🔄 Polling attempt ${attempts + 1}/${maxAttempts} for shipment: ${shipmentId}`);
          const data = await callAPI(GET_SHIPMENT, { shipmentId });
          const shipmentData = data.shipment;
          
          setShipment(shipmentData);
          
          // Get the appropriate tracking object based on type
          const trackingObj = shipmentData.containerTracking || 
                             shipmentData.blTracking || 
                             shipmentData.bookingTracking;
          
          if (trackingObj && trackingObj.trackStatus) {
            const status = trackingObj.trackStatus.status;
            console.log(`📊 Current tracking status: ${status} (attempt ${attempts + 1})`);
            
            if (status === 'Is-Tracking' && attempts < maxAttempts) {
              attempts++;
              setTimeout(poll, 5000); // Increased to 5 seconds between polls
            } else if (status === 'Track-Succeeded') {
              // Success! Stop trying other shipping lines
              console.log('✅ Tracking completed successfully!');
              setPolling(false);
              setLoading(false);
              resolve(true);
            } else if (status === 'Track-Failed') {
              // Failed - show error and stop polling
              console.log('❌ Tracking failed:', trackingObj.trackStatus.exception);
              setError(`Tracking failed: ${trackingObj.trackStatus.exception || 'Unknown error'}`);
              setPolling(false);
              setLoading(false);
              resolve(false);
            } else {
              // Timeout or other status - try next shipping line (for auto-detect) or stop
              console.log(`⏰ Polling timeout or unknown status: ${status}`);
              setPolling(false);
              if (trackingData.autoDetect) {
                resolve(false); // Try next shipping line
              } else {
                setLoading(false);
                setError(`Tracking timed out with status: ${status}. The shipment may still be processing.`);
                resolve(false);
              }
            }
          } else {
            console.log('❌ No tracking object found');
            setPolling(false);
            resolve(false);
          }
          
        } catch (err) {
          console.error('❌ Polling error:', err);
          attempts++;
          if (attempts >= maxAttempts) {
            setPolling(false);
            setError(`Polling failed after ${maxAttempts} attempts: ${err.message}`);
            setLoading(false);
            resolve(false);
          } else {
            setTimeout(poll, 5000); // Retry on error
          }
        }
      };
      
      poll();
    });
  };

  // Update shipment
  const updateShipment = async () => {
    if (!shipment) return;
    
    setLoading(true);
    setError('');
    
    try {
      await callAPI(UPDATE_SHIPMENT, { shipmentId: shipment.id });
      await pollShipmentStatusWithTimeout(shipment.id, 'Current');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Render tracking results
  const renderTrackingResults = () => {
    if (!shipment) return null;

    const tracking = shipment.containerTracking || shipment.blTracking || shipment.bookingTracking;
    
    if (!tracking) return null;

    const status = tracking.trackStatus?.status;
    const isSuccess = status === 'Track-Succeeded';
    const isFailed = status === 'Track-Failed';
    const isTracking = status === 'Is-Tracking';

    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Tracking Results</h3>
        
        {/* Status */}
        <div className="mb-4">
          <span className="font-medium">Status: </span>
          <span className={`px-2 py-1 rounded text-sm ${
            isSuccess ? 'bg-green-100 text-green-800' :
            isFailed ? 'bg-red-100 text-red-800' :
            isTracking ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {status}
          </span>
          {isTracking && (
            <span className="ml-2 text-sm text-gray-600">
              (Tracking in progress... {polling ? 'Polling...' : ''})
            </span>
          )}
        </div>

        {/* Container Tracking Results */}
        {shipment.containerTracking && isSuccess && (
          <div className="space-y-2">
            <p><strong>Container:</strong> {tracking.number}</p>
            <p><strong>Shipping Line:</strong> {tracking.shippingLine?.name}</p>
            {tracking.arrivalTime && (
              <p><strong>Arrival Time:</strong> {new Date(tracking.arrivalTime.value).toLocaleString()}</p>
            )}
            {tracking.lastMovementEventDescription && (
              <p><strong>Last Movement:</strong> {tracking.lastMovementEventDescription}</p>
            )}
            {tracking.portOfLoading && (
              <p><strong>Port of Loading:</strong> {tracking.portOfLoading.unlocodeName}</p>
            )}
            {tracking.portOfDischarge && (
              <p><strong>Port of Discharge:</strong> {tracking.portOfDischarge.unlocodeName}</p>
            )}
          </div>
        )}

        {/* BL Tracking Results */}
        {shipment.blTracking && isSuccess && (
          <div className="space-y-2">
            <p><strong>BL Number:</strong> {tracking.number}</p>
            <p><strong>Shipping Line:</strong> {tracking.shippingLine?.name}</p>
            {tracking.placeOfReceipt && (
              <p><strong>Place of Receipt:</strong> {tracking.placeOfReceipt.unlocodeName}</p>
            )}
            {tracking.portOfDischarge && (
              <p><strong>Port of Discharge:</strong> {tracking.portOfDischarge.unlocodeName}</p>
            )}
            {tracking.placeOfDelivery && (
              <p><strong>Place of Delivery:</strong> {tracking.placeOfDelivery.unlocodeName}</p>
            )}
            
            {/* Containers in BL */}
            {tracking.containers && tracking.containers.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Containers:</h4>
                {tracking.containers.map((container, index) => (
                  <div key={index} className="ml-4 p-2 bg-white rounded border">
                    <p><strong>Container:</strong> {container.number}</p>
                    <p><strong>Status:</strong> {container.trackStatus?.status}</p>
                    {container.arrivalTime && (
                      <p><strong>Arrival:</strong> {new Date(container.arrivalTime.value).toLocaleString()}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Update Button */}
        {isSuccess && (
          <button
            onClick={updateShipment}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Tracking'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Visiwise Shipment Tracker</h1>
      
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 whitespace-pre-line">{error}</p>
          <button 
            onClick={testWithDocExample}
            className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            🧪 Test with Documentation Example
          </button>
        </div>
      )}

      {/* Tracking Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tracking Reference *
          </label>
          <input
            type="text"
            value={trackingData.reference}
            onChange={(e) => setTrackingData({...trackingData, reference: e.target.value})}
            placeholder="Enter container number, BL number, or booking number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tracking Type *
          </label>
          <select
            value={trackingData.trackingType}
            onChange={(e) => setTrackingData({...trackingData, trackingType: e.target.value, shippingLine: ''})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ContainerTracking">Container Tracking</option>
            <option value="BLTracking">Bill of Lading (BL) Tracking</option>
            <option value="BookingTracking">Booking Tracking</option>
          </select>
        </div>

        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={trackingData.autoDetect}
              onChange={(e) => setTrackingData({...trackingData, autoDetect: e.target.checked, shippingLine: ''})}
              className="rounded"
            />
            <span>Auto-detect shipping line</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            {trackingData.autoDetect 
              ? "System will try all shipping lines automatically" 
              : "You need to select the specific shipping line"
            }
          </p>
        </div>

        {!trackingData.autoDetect && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shipping Line *
            </label>
            <select
              value={trackingData.shippingLine}
              onChange={(e) => setTrackingData({...trackingData, shippingLine: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select shipping line</option>
              {getCurrentLines().map((line) => (
                <option key={line.keyname} value={line.keyname}>
                  {line.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={createShipment}
          disabled={loading || !trackingData.reference || (!trackingData.autoDetect && !trackingData.shippingLine)}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 
            (trackingData.autoDetect ? 'Auto-detecting shipping line...' : 'Tracking...') : 
            'Track Shipment'
          }
        </button>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="mt-4 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 mt-2">
            {polling ? 'Polling for updates...' : 
             trackingData.autoDetect ? 'Auto-detecting shipping line...' : 'Tracking shipment...'}
          </span>
          {trackingData.autoDetect && tryingShippingLines.length > 0 && (
            <div className="mt-2 text-sm text-gray-500">
              Trying: {tryingShippingLines[currentAttempt - 1]?.name || 'Unknown'} 
              ({currentAttempt}/{tryingShippingLines.length})
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {renderTrackingResults()}
    </div>
  );
};

export default VisiwiseTracker;