
'use client'
import { useState } from 'react';
const SeaRouteCalculator = () => {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useClientSide, setUseClientSide] = useState(false);

  const calculateRouteServerSide = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const origin= {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [132.5390625, 21.616579336740603] // Japan area
        }
      };

      const destination= {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [-71.3671875, 75.05035357407698] // Arctic area
        }
      };

      const response = await fetch('/api/searoute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin,
          destination,
          units: 'miles'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate route');
      }

      setRoute(data.route);
      
    } catch (error) {
      console.error('Error calculating route:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateRouteClientSide = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Dynamic import for client-side usage
      const { default: seaRoute } = await import('searoute-ts');
      
      const origin = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [132.5390625, 21.616579336740603] // Japan area
        }
      };

      const destination = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [-71.3671875, 75.05035357407698] // Arctic area
        }
      };

      // Calculate route directly on client
      const routeResult = seaRoute(origin, destination, 'miles');
      setRoute(routeResult);
      
    } catch (error) {
      console.error('Error calculating route client-side:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateRoute = useClientSide ? calculateRouteClientSide : calculateRouteServerSide;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Sea Route Calculator (searoute-ts)</h2>
      
      <div className="mb-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={useClientSide}
            onChange={(e) => setUseClientSide(e.target.checked)}
            className="rounded"
          />
          <span>Use client-side calculation</span>
        </label>
        <p className="text-sm text-gray-600 mt-1">
          {useClientSide 
            ? "Route calculated in browser (may be slower on first load)"
            : "Route calculated on server (recommended)"
          }
        </p>
      </div>
      
      <button 
        onClick={calculateRoute}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Calculating Sea Route...' : 'Calculate Sea Route'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p><strong>Error:</strong> {error}</p>
          {!useClientSide && (
            <p className="text-sm mt-2">
              Try switching to client-side calculation if server-side fails.
            </p>
          )}
        </div>
      )}

      {route && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold">Route Information:</h3>
          
          <div className="bg-gray-100 p-4 rounded">
            <p><strong>Distance:</strong> {route.properties.length.toFixed(2)} miles</p>
            <p><strong>Route Type:</strong> {route.geometry.type}</p>
            <p><strong>Number of Points:</strong> {route.geometry.coordinates.length}</p>
            <p><strong>Calculation:</strong> {useClientSide ? 'Client-side' : 'Server-side'}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <h4 className="font-semibold mb-2">GeoJSON Route Data:</h4>
            <pre className="text-xs overflow-auto max-h-40 bg-white p-2 border rounded">
              {JSON.stringify(route, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeaRouteCalculator;

// Advanced component with custom coordinate