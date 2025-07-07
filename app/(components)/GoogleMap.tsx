'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { db } from '@/firebase'; // Import your initialized Firestore instance
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, serverTimestamp, getDoc } from "firebase/firestore";

// --- Component Configuration ---
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';
const MAP_ID = 'DEMO_MAP_ID';
const DEFAULT_CENTER = { lat: -37.8136, lng: 144.9631 }; // Melbourne
const DEFAULT_ZOOM = 15;
const MAP_CLASS_NAME = "w-full h-[600px] rounded-lg shadow-md";
const MAX_TRAIL_POINTS = 500; // Increased for longer sessions
const TRACKING_INTERVAL = 5000; // 5 seconds
const MIN_MOVEMENT_DISTANCE = 10; // Minimum meters to move before storing a new point

// Define the structure for a location point
interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: any; // Can be a Date or Firestore Timestamp
  accuracy?: number;
  speed?: number | null; // Allow null for speed
  heading?: number | null; // Allow null for heading
}

/**
 * Generates a readable unique ID
 */
const generateReadableId = (): string => {
  const adjectives = ['swift', 'brave', 'calm', 'bright', 'clever', 'bold', 'quick', 'smart', 'cool', 'fast'];
  const animals = ['tiger', 'eagle', 'wolf', 'lion', 'hawk', 'bear', 'fox', 'shark', 'deer', 'owl'];
  const numbers = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  
  return `${adjective}-${animal}-${numbers}`;
};

/**
 * A React component to display and save the user's live location and historical trail.
 */
export default function LiveLocationTracker() {
  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const currentMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const trailPathRef = useRef<google.maps.Polyline | null>(null);
  const historyMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const unsubscribeDbRef = useRef<() => void | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [trackingId, setTrackingId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);
  const [viewMode, setViewMode] = useState<'track' | 'lookup'>('track');

  // Simulation route - a walking path around Melbourne CBD
  const simulationRoute = [
    { lat: -37.8136, lng: 144.9631 }, // Starting point
    { lat: -37.8140, lng: 144.9635 }, // Move northeast
    { lat: -37.8145, lng: 144.9640 }, // Continue northeast
    { lat: -37.8150, lng: 144.9645 }, // More northeast
    { lat: -37.8155, lng: 144.9640 }, // Turn west
    { lat: -37.8160, lng: 144.9635 }, // Continue west
    { lat: -37.8165, lng: 144.9630 }, // More west
    { lat: -37.8170, lng: 144.9625 }, // Southwest
    { lat: -37.8175, lng: 144.9620 }, // Continue southwest
    { lat: -37.8180, lng: 144.9615 }, // More southwest
    { lat: -37.8175, lng: 144.9610 }, // Turn north
    { lat: -37.8170, lng: 144.9605 }, // Continue north
    { lat: -37.8165, lng: 144.9600 }, // More north
    { lat: -37.8160, lng: 144.9595 }, // Northwest
    { lat: -37.8155, lng: 144.9590 }, // Continue northwest
    { lat: -37.8150, lng: 144.9595 }, // Turn east
    { lat: -37.8145, lng: 144.9600 }, // Continue east
    { lat: -37.8140, lng: 144.9605 }, // More east
    { lat: -37.8135, lng: 144.9610 }, // Northeast
    { lat: -37.8130, lng: 144.9615 }, // Continue northeast
    { lat: -37.8125, lng: 144.9620 }, // More northeast
    { lat: -37.8130, lng: 144.9625 }, // Return path
    { lat: -37.8135, lng: 144.9630 }, // Getting closer to start
    { lat: -37.8136, lng: 144.9631 }  // Back to start
  ];

  /**
   * Calculates distance between two points.
   */
  const calculateDistance = useCallback((p1: LocationPoint, p2: LocationPoint): number => {
    const R = 6371e3;
    const phi1 = p1.lat * Math.PI / 180;
    const phi2 = p2.lat * Math.PI / 180;
    const deltaPhi = (p2.lat - p1.lat) * Math.PI / 180;
    const deltaLambda = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  /**
   * Saves a location point to Firestore
   */
  const saveLocationToFirestore = useCallback(async (newPoint: LocationPoint) => {
    if (!trackingId) return;

    try {
      const docRef = doc(db, "orderCoordinates", trackingId);
      await updateDoc(docRef, {
        current: newPoint,
        history: arrayUnion(newPoint),
        lastUpdated: serverTimestamp()
      });
    } catch (err: any) {
      if (err.code === 'not-found') {
        const docRef = doc(db, "orderCoordinates", trackingId);
        await setDoc(docRef, {
          current: newPoint,
          history: [newPoint],
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          trackingId: trackingId
        });
      } else {
        console.error("Error updating Firestore:", err);
        setError("Could not save location to database.");
      }
    }
  }, [trackingId]);

  /**
   * Handles successful geolocation updates from the browser.
   */
  const handleLocationUpdate = useCallback(async (position: GeolocationPosition) => {
    const clientTimestamp = new Date();
    const newPoint: LocationPoint = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: clientTimestamp,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed ?? null,
      heading: position.coords.heading ?? null,
    };

    // Check if the user has moved significantly
    const lastPoint = locationHistory[locationHistory.length - 1];
    if (lastPoint) {
      const distance = calculateDistance(lastPoint, newPoint);
      if (distance < MIN_MOVEMENT_DISTANCE) {
        setCurrentLocation(newPoint);
        return;
      }
    }

    await saveLocationToFirestore(newPoint);
  }, [locationHistory, calculateDistance, saveLocationToFirestore]);

  /**
   * Simulates movement along the predefined route
   */
  const simulateMovement = useCallback(async () => {
    if (!isSimulating || simulationStep >= simulationRoute.length) {
      setIsSimulating(false);
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      return;
    }

    const currentRoutePoint = simulationRoute[simulationStep];
    const clientTimestamp = new Date();
    
    // Add some randomness to make it more realistic
    const randomOffset = 0.0001; // About 10 meters
    const newPoint: LocationPoint = {
      lat: currentRoutePoint.lat + (Math.random() - 0.5) * randomOffset,
      lng: currentRoutePoint.lng + (Math.random() - 0.5) * randomOffset,
      timestamp: clientTimestamp,
      accuracy: Math.random() * 10 + 5, // Random accuracy between 5-15 meters
      speed: Math.random() * 2 + 1, // Random speed between 1-3 m/s (walking speed)
      heading: Math.random() * 360, // Random heading
    };

    // Check movement distance (same logic as real GPS)
    const lastPoint = locationHistory[locationHistory.length - 1];
    if (lastPoint) {
      const distance = calculateDistance(lastPoint, newPoint);
      if (distance < MIN_MOVEMENT_DISTANCE) {
        setCurrentLocation(newPoint);
        setSimulationStep(prev => prev + 1);
        return;
      }
    }

    await saveLocationToFirestore(newPoint);
    setSimulationStep(prev => prev + 1);
  }, [isSimulating, simulationStep, locationHistory, calculateDistance, saveLocationToFirestore]);

  /**
   * Starts movement simulation
   */
  const startSimulation = useCallback(() => {
    if (!trackingId) {
      setError('Please start tracking first');
      return;
    }
    
    setIsSimulating(true);
    setSimulationStep(0);
    setError(null);
    
    // Simulate movement every 2 seconds
    simulationIntervalRef.current = setInterval(simulateMovement, 2000);
  }, [trackingId, simulateMovement]);

  /**
   * Stops movement simulation
   */
  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  }, []);

  /**
   * Looks up a previous tracking session by ID
   */
  const lookupTrackingSession = useCallback(async () => {
    if (!lookupId.trim()) {
      setError('Please enter a valid tracking ID');
      return;
    }

    setError(null);
    setIsViewing(true);

    try {
      const docRef = doc(db, "orderCoordinates", lookupId.trim());
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setLocationHistory(data.history || []);
        setCurrentLocation(data.current || null);
        setTrackingId(lookupId.trim());
        
        // Center map on the first point if available
        if (data.history && data.history.length > 0 && mapInstanceRef.current) {
          const firstPoint = data.history[0];
          mapInstanceRef.current.panTo({ lat: firstPoint.lat, lng: firstPoint.lng });
          mapInstanceRef.current.setZoom(15);
        }
      } else {
        setError('Tracking session not found. Please check the ID and try again.');
        setIsViewing(false);
      }
    } catch (err) {
      console.error("Error looking up tracking session:", err);
      setError('Failed to load tracking session.');
      setIsViewing(false);
    }
  }, [lookupId]);

  /**
   * Clears the current view and returns to tracking mode
   */
  const clearView = useCallback(() => {
    setIsViewing(false);
    setLocationHistory([]);
    setCurrentLocation(null);
    setTrackingId('');
    setLookupId('');
    setError(null);
    
    // Clear map elements
    if (trailPathRef.current) trailPathRef.current.setPath([]);
    if (currentMarkerRef.current) currentMarkerRef.current.map = null;
    currentMarkerRef.current = null;
    
    // Reset map to default position
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(DEFAULT_CENTER);
      mapInstanceRef.current.setZoom(DEFAULT_ZOOM);
    }
  }, []);

  // Effect to handle simulation
  useEffect(() => {
    if (isSimulating) {
      simulateMovement();
    }
  }, [simulationStep, isSimulating, simulateMovement]);
  
  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    let message = 'An unknown location error occurred.';
    switch (error.code) {
      case error.PERMISSION_DENIED: message = 'Location access was denied.'; break;
      case error.POSITION_UNAVAILABLE: message = 'Location information is unavailable.'; break;
      case error.TIMEOUT: message = 'The request to get user location timed out.'; break;
    }
    setError(message);
    setIsTracking(false);
  }, []);

  // Create refs for the callbacks to avoid stale closures
  const handleLocationUpdateRef = useRef(handleLocationUpdate);
  useEffect(() => {
    handleLocationUpdateRef.current = handleLocationUpdate;
  }, [handleLocationUpdate]);

  const handleLocationErrorRef = useRef(handleLocationError);
  useEffect(() => {
    handleLocationErrorRef.current = handleLocationError;
  }, [handleLocationError]);

  /**
   * Starts both GPS watching and listening to Firestore.
   */
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    
    const newId = generateReadableId();
    setTrackingId(newId);
    
    // Clear previous tracking data
    historyMarkersRef.current.forEach(marker => marker.map = null);
    historyMarkersRef.current = [];
    if (trailPathRef.current) trailPathRef.current.setPath([]);
    if (currentMarkerRef.current) currentMarkerRef.current.map = null;
    currentMarkerRef.current = null;
    
    setLocationHistory([]);
    setCurrentLocation(null);
    setError(null);
    setIsTracking(true);
    setIsViewing(false);
    setSimulationStep(0);

    // Listen to Firestore for changes to draw the trail
    const docRef = doc(db, "orderCoordinates", newId);
    unsubscribeDbRef.current = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLocationHistory(data.history || []);
        setCurrentLocation(data.current || null);
      }
    });

    // Start watching the device's GPS, using the refs to call the latest callbacks
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => handleLocationUpdateRef.current(position),
      (error) => handleLocationErrorRef.current(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: TRACKING_INTERVAL / 2 }
    );
  }, []);

  /**
   * Stops both GPS watching and the Firestore listener.
   */
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (unsubscribeDbRef.current) {
        unsubscribeDbRef.current();
        unsubscribeDbRef.current = null;
    }
    stopSimulation();
    setIsTracking(false);
  }, [stopSimulation]);

  // --- Map Initialization ---
  useEffect(() => {
    const loader = new Loader({
        apiKey: API_KEY, version: "weekly", libraries: ["maps", "marker", "geometry"],
    });

    const initMap = async () => {
      try {
        const google = await loader.load();
        if (mapRef.current) {
          const map = new google.maps.Map(mapRef.current, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, mapId: MAP_ID });
          mapInstanceRef.current = map;
          trailPathRef.current = new google.maps.Polyline({ map, path: [], strokeColor: '#4285F4', strokeWeight: 4 });
          setIsMapLoaded(true);
        }
      } catch (e) {
        console.error("Error loading Google Maps:", e);
        setError('Failed to load Google Maps.');
      }
    };

    if (API_KEY && API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY') initMap(); else setError('API key missing.');
    return () => stopTracking();
  }, [stopTracking]);

  // --- Map Element Updates ---
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    
    if (currentLocation) {
        const position = { lat: currentLocation.lat, lng: currentLocation.lng };
        if (currentMarkerRef.current) {
            currentMarkerRef.current.position = position;
        } else {
            const liveMarkerIcon = document.createElement('div');
            liveMarkerIcon.innerHTML = isViewing ? '🔍' : '📍';
            liveMarkerIcon.className = isViewing ? 'text-3xl' : 'text-3xl animate-bounce';
            currentMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({ 
              map, 
              position, 
              content: liveMarkerIcon, 
              title: isViewing ? "Last Known Location" : "My Location" 
            });
        }
        if (locationHistory.length === 1 && !isViewing) map.panTo(position);
    }
    
    if (trailPathRef.current) {
        const trailCoordinates = locationHistory.map(p => ({ lat: p.lat, lng: p.lng }));
        trailPathRef.current.setPath(trailCoordinates);
        trailPathRef.current.setOptions({ 
          strokeColor: isViewing ? '#9333EA' : '#4285F4',
          strokeWeight: isViewing ? 3 : 4 
        });
    }

  }, [isMapLoaded, currentLocation, locationHistory, isViewing]);

  return (
    <div className="bg-gray-100 p-4 rounded-lg shadow-inner w-full font-sans">
      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Live Location Tracker</h2>
        
        {/* Mode Toggle */}
        <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('track')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${viewMode === 'track' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}
          >
            📍 Track Location
          </button>
          <button
            onClick={() => setViewMode('lookup')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${viewMode === 'lookup' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600'}`}
          >
            🔍 View Previous
          </button>
        </div>

        {viewMode === 'track' ? (
          <>
            {/* Tracking Mode */}
            {isTracking && trackingId && (
                <div className="mb-4 p-3 bg-indigo-50 rounded-md">
                    <p className="text-sm font-medium text-indigo-800 mb-1">Your Tracking ID:</p>
                    <div className="flex items-center justify-between bg-white rounded px-3 py-2">
                      <p className="text-sm text-indigo-600 font-mono">{trackingId}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(trackingId)}
                        className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-indigo-600 mt-1">Share this ID with others to let them view your location!</p>
                </div>
            )}
            
            <div className="space-y-3">
              {/* Main tracking button */}
              <button
                  onClick={isTracking ? stopTracking : startTracking}
                  disabled={!isMapLoaded || isViewing}
                  className={`w-full px-5 py-3 font-semibold text-white rounded-lg transition-all ${isTracking ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:bg-gray-400`}
              >
                  {isTracking ? '■ Stop Tracking' : '▶ Start New Tracking Session'}
              </button>

              {/* Simulation buttons */}
              {isTracking && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={isSimulating ? stopSimulation : startSimulation}
                    disabled={!trackingId}
                    className={`px-4 py-2 font-semibold text-white rounded-lg transition-all ${isSimulating ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} disabled:bg-gray-400`}
                  >
                    {isSimulating ? '⏹ Stop Demo' : '🎯 Demo Walk'}
                  </button>
                  
                  {isSimulating && (
                    <div className="px-4 py-2 bg-yellow-100 rounded-lg text-center">
                      <p className="text-xs text-yellow-800 font-medium">
                        Step {simulationStep + 1}/{simulationRoute.length}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Lookup Mode */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Tracking ID:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupId}
                    onChange={(e) => setLookupId(e.target.value)}
                    placeholder="e.g., swift-tiger-123"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && lookupTrackingSession()}
                  />
                  <button
                    onClick={lookupTrackingSession}
                    disabled={!lookupId.trim() || !isMapLoaded}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-all"
                  >
                    🔍 View
                  </button>
                </div>
              </div>

              {isViewing && (
                <div className="p-3 bg-purple-50 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-800">Viewing Session:</p>
                      <p className="text-sm text-purple-600 font-mono">{trackingId}</p>
                      <p className="text-xs text-purple-600">{locationHistory.length} location points</p>
                    </div>
                    <button
                      onClick={clearView}
                      className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1 rounded transition-colors"
                    >
                      Clear View
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-3 text-xs text-center text-gray-500 min-h-[1.25rem]">
            {error && <p className="text-red-600">{error}</p>}
            {isSimulating && !error && <p className="text-orange-600 animate-pulse">Simulating movement around Melbourne CBD...</p>}
            {isTracking && !isSimulating && !error && <p className="text-green-600 animate-pulse">Tracking live location...</p>}
            {isViewing && !error && <p className="text-purple-600">Viewing previous tracking session</p>}
            {!isTracking && !isViewing && !error && <p>Start tracking or view a previous session</p>}
        </div>
      </div>
      <div ref={mapRef} className={MAP_CLASS_NAME} />
    </div>
  );
}