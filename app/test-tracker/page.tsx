'use client';

import { useState, useEffect } from 'react';

interface VesselData {
  event: string;
  time: string;
  port: string;
  vesselName: string;
  vesselLink: string;
  mmsi: string;
  imo: string;
  flag: string;
  vesselType: string;
}

interface ApiResponse {
  success: boolean;
  data?: VesselData[];
  totalResults?: number;
  error?: string;
  timestamp: string;
}

export default function ShipTrackingPage() {
  const [vessels, setVessels] = useState<VesselData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portId, setPortId] = useState('409'); // Sydney port

  const fetchVessels = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/ship-tracking?pid=${portId}`);
      const data: ApiResponse = await response.json();
      
      if (data.success && data.data) {
        setVessels(data.data);
      } else {
        setError(data.error || 'Failed to fetch vessel data');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVessels();
  }, [portId]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Ship Tracking Dashboard</h1>
      
      <div className="mb-4">
        <label htmlFor="port-select" className="block text-sm font-medium mb-2">
          Select Port:
        </label>
        <select
          id="port-select"
          value={portId}
          onChange={(e) => setPortId(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
        >
          <option value="409">Sydney</option>
          {/* Add more ports as needed */}
        </select>
        <button
          onClick={fetchVessels}
          disabled={loading}
          className="ml-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2">Loading vessel data...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Event</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Time</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Vessel Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Type</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">MMSI</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">IMO</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {vessels.map((vessel, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      vessel.event === 'Arrival' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {vessel.event}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">{vessel.time}</td>
                  <td className="px-4 py-2 text-sm">
                    {vessel.vesselLink ? (
                      <a 
                        href={vessel.vesselLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {vessel.vesselName}
                      </a>
                    ) : (
                      vessel.vesselName
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{vessel.vesselType}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{vessel.mmsi || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{vessel.imo || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{vessel.flag}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {vessels.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              No vessel data available
            </div>
          )}
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        Total vessels: {vessels.length}
      </div>
    </div>
  );
}


