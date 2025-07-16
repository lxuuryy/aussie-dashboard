'use client'
import React, { useState } from 'react';
import { Search, Ship, MapPin, Clock, Package, AlertCircle, Navigation, Globe } from 'lucide-react';

interface TrackingData {
  status: string;
  message: string;
  data: {
    metadata: {
      type: string;
      number: string;
      sealine: string;
      sealine_name: string;
      status: string;
      is_status_from_sealine: boolean;
      updated_at: string;
      api_calls: {
        total: number;
        used: number;
        remaining: number;
      };
    };
    locations: Array<{
      id: number;
      name: string;
      state: string;
      country: string;
      country_code: string;
      locode: string;
      lat: number;
      lng: number;
      timezone: string;
    }>;
    vessels: Array<{
      id: number;
      name: string;
      imo: number;
      call_sign: string;
      mmsi: number;
      flag: string;
    }>;
    route: {
      prepol: { location: number; date: string; actual: boolean };
      pol: { location: number; date: string; actual: boolean };
      pod: { location: number; date: string; actual: boolean };
      postpod: { location: number; date: string; actual: boolean };
    };
    containers?: Array<{
      number: string;
      iso_code: string;
      size_type: string;
      status: string;
      events: Array<{
        order_id: number;
        description: string;
        date: string;
        actual: boolean;
        location: number;
      }>;
    }>;
    route_data?: {
      ais: {
        status: string;
        data: {
          vessel: {
            name: string;
            imo: number;
          };
          last_vessel_position: {
            lat: number;
            lng: number;
            updated_at: string;
          };
          discharge_port: {
            name: string;
            country_code: string;
            date: string;
            date_label: string;
          };
        };
      };
    };
  };
}

const EnhancedContainerTracker = () => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingType, setTrackingType] = useState('CT');
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!trackingNumber.trim()) return;

    setLoading(true);
    setError('');
    setTrackingData(null);

    try {
      const response = await fetch(`/api/track?number=${encodeURIComponent(trackingNumber)}&type=${trackingType}&route=true&ais=true`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tracking data');
      }

      setTrackingData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getLocationById = (locationId: number) => {
    return trackingData?.data.locations.find(loc => loc.id === locationId);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_transit': return 'text-blue-600';
      case 'delivered': return 'text-green-600';
      case 'delayed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const RouteTimeline = () => {
    if (!trackingData?.data.route) return null;

    const routeSteps = [
      { key: 'prepol', label: 'Pre-Port of Loading', icon: '🏭' },
      { key: 'pol', label: 'Port of Loading', icon: '🚢' },
      { key: 'pod', label: 'Port of Discharge', icon: '🏗️' },
      { key: 'postpod', label: 'Post-Port of Discharge', icon: '🚛' }
    ];

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Navigation className="text-blue-600" size={24} />
          Route Timeline
        </h3>
        
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
          
          <div className="space-y-6">
            {routeSteps.map((step, index) => {
              const routeData = trackingData.data.route[step.key as keyof typeof trackingData.data.route];
              const location = getLocationById(routeData.location);
              const isCompleted = routeData.actual;
              
              return (
                <div key={step.key} className="relative flex items-start">
                  {/* Timeline dot */}
                  <div className={`absolute left-6 w-4 h-4 rounded-full border-2 ${
                    isCompleted ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'
                  }`}></div>
                  
                  {/* Content */}
                  <div className="ml-16 bg-gray-50 p-4 rounded-lg w-full">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-lg flex items-center gap-2">
                        <span>{step.icon}</span>
                        {step.label}
                      </h4>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                        isCompleted 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {isCompleted ? 'Completed' : 'Estimated'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium text-gray-700">Location</p>
                        <p className="text-gray-600">
                          {location?.name}, {location?.country}
                        </p>
                        <p className="text-sm text-gray-500">
                          Code: {location?.locode} | {location?.country_code}
                        </p>
                      </div>
                      
                      <div>
                        <p className="font-medium text-gray-700">Date & Time</p>
                        <p className="text-gray-600">{formatDate(routeData.date)}</p>
                        <p className="text-sm text-gray-500">
                          Timezone: {location?.timezone}
                        </p>
                      </div>
                    </div>
                    
                    {location?.lat && location?.lng && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-500">
                          Coordinates: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const VesselPosition = () => {
    if (!trackingData?.data.route_data?.ais?.data?.last_vessel_position) return null;

    const vesselData = trackingData.data.route_data.ais.data;
    
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Globe className="text-red-600" size={24} />
          Live Vessel Tracking
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Current Position</h4>
              <div className="space-y-2">
                <p><span className="font-medium">Latitude:</span> {vesselData.last_vessel_position.lat}</p>
                <p><span className="font-medium">Longitude:</span> {vesselData.last_vessel_position.lng}</p>
                <p><span className="font-medium">Last Updated:</span> {formatDate(vesselData.last_vessel_position.updated_at)}</p>
              </div>
            </div>
            
            {vesselData.vessel && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">Vessel Details</h4>
                <p><span className="font-medium">Name:</span> {vesselData.vessel.name}</p>
                <p><span className="font-medium">IMO:</span> {vesselData.vessel.imo}</p>
              </div>
            )}
          </div>
          
          {vesselData.discharge_port && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">Next Destination</h4>
              <p className="text-lg font-bold">{vesselData.discharge_port.name}</p>
              <p className="text-sm text-gray-600">({vesselData.discharge_port.country_code})</p>
              <div className="mt-3 pt-3 border-t border-green-200">
                <p><span className="font-medium">{vesselData.discharge_port.date_label}:</span></p>
                <p>{formatDate(vesselData.discharge_port.date)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Enhanced Container Route Tracker</h1>
        <p className="text-gray-600">Track your shipments with detailed route and vessel information</p>
      </div>

      {/* Search Section */}
      <div className="mb-8 bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tracking Number
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter container, B/L, or booking number"
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <select
              value={trackingType}
              onChange={(e) => setTrackingType(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="CT">Container</option>
              <option value="BL">Bill of Lading</option>
              <option value="BK">Booking</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium"
            >
              <Search size={20} />
              {loading ? 'Tracking...' : 'Track Route'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="text-red-500" size={20} />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Results */}
      {trackingData && (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-semibold text-gray-700">Tracking Number</h3>
                <p className="text-xl font-bold text-blue-800">{trackingData.data.metadata.number}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">Status</h3>
                <p className={`text-xl font-bold ${getStatusColor(trackingData.data.metadata.status)}`}>
                  {trackingData.data.metadata.status.replace('_', ' ')}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">Shipping Line</h3>
                <p className="text-xl font-bold text-blue-800">{trackingData.data.metadata.sealine_name || 'Unknown'}</p>
              </div>
            </div>
          </div>

          {/* Route Timeline */}
          <RouteTimeline />

          {/* Vessel Position */}
          <VesselPosition />

          {/* Vessel Information */}
          {trackingData.data.vessels && trackingData.data.vessels.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Ship className="text-blue-600" size={24} />
                Vessel Information
              </h3>
              {trackingData.data.vessels.map((vessel) => (
                <div key={vessel.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <span className="font-semibold">Name:</span>
                    <p>{vessel.name}</p>
                  </div>
                  <div>
                    <span className="font-semibold">IMO:</span>
                    <p>{vessel.imo}</p>
                  </div>
                  <div>
                    <span className="font-semibold">Call Sign:</span>
                    <p>{vessel.call_sign}</p>
                  </div>
                  <div>
                    <span className="font-semibold">Flag:</span>
                    <p>{vessel.flag}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Container Events */}
          {trackingData.data.containers && trackingData.data.containers.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Package className="text-purple-600" size={24} />
                Container Events
              </h3>
              {trackingData.data.containers.map((container) => (
                <div key={container.number} className="mb-6">
                  <h4 className="font-semibold mb-3">Container: {container.number} ({container.size_type})</h4>
                  <div className="space-y-3">
                    {container.events.slice(0, 5).map((event) => {
                      const location = getLocationById(event.location);
                      return (
                        <div key={event.order_id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-md">
                          <div className="flex-shrink-0">
                            <Clock className="text-gray-400" size={16} />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{event.description}</p>
                                <p className="text-sm text-gray-600">
                                  {location?.name}, {location?.country}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{formatDate(event.date)}</p>
                                <span className={`inline-block px-2 py-1 text-xs rounded-full ${event.actual ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                  {event.actual ? 'Actual' : 'Estimated'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* API Usage */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">API Usage</h4>
            <p className="text-sm text-gray-600">
              Used: {trackingData.data.metadata.api_calls.used} / {trackingData.data.metadata.api_calls.total} 
              (Remaining: {trackingData.data.metadata.api_calls.remaining})
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {formatDate(trackingData.data.metadata.updated_at)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedContainerTracker;