'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ship, 
  Loader, 
  AlertCircle, 
  Package,
  Waves,
  MapPin,
  Navigation,
  Route,
  Clock,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Script from 'next/script';

const InlineContainerTracker = ({ order }) => {
  const orderId = order?.id || order?.orderId;
  const [shippingContainers, setShippingContainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [journeyData, setJourneyData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [processingRoutes, setProcessingRoutes] = useState(false);

  // API Key
  const GOOGLE_MAPS_API_KEY = 'AIzaSyCtrM0nEB2OOEEfQ7sFG8AURtV3KeyPrRM';

  // Tracking method mapping and labels (same as ShippingTracker)
  const trackingTypeMapping = {
    "BL_TRACKING": "BLTracking",
    "CONTAINER_TRACKING": "ContainerTracking", 
    "BOOKING_TRACKING": "BookingTracking",
    "MASTER_BL": "BLTracking",
    "HOUSE_BL": "BLTracking", 
    "VESSEL_TRACKING": "VesselTracking"
  };

  const trackingMethodLabels = {
    "BL_TRACKING": "Bill of Lading",
    "CONTAINER_TRACKING": "Container Tracking",
    "BOOKING_TRACKING": "Booking Reference",
    "MASTER_BL": "Master Bill of Lading",
    "HOUSE_BL": "House Bill of Lading",
    "VESSEL_TRACKING": "Vessel Tracking"
  };

  // Fetch shipping containers from the order document
  const fetchShippingContainers = async () => {
    if (!orderId) {
      setError('Order ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        const containers = orderData.shippingContainers || [];
        
        setShippingContainers(containers);
        console.log(`Found ${containers.length} shipping containers for order ${orderId}:`, containers);
      } else {
        setError('Order not found');
      }

    } catch (err) {
      console.error('Error fetching shipping containers:', err);
      setError('Failed to load shipping containers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchShippingContainers();
    }
  }, [orderId]);

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setMapLoaded(true);
        return;
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existingScript) {
        if (window.google && window.google.maps) {
          setMapLoaded(true);
        } else {
          existingScript.addEventListener('load', () => setMapLoaded(true));
        }
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapLoaded(true);
      script.onerror = () => console.error('Failed to load Google Maps API');
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // Helper functions (same as ShippingTracker)
  const calculateDistance = (pos1, pos2) => {
    const R = 6371e3;
    const φ1 = pos1.lat * Math.PI/180;
    const φ2 = pos2.lat * Math.PI/180;
    const Δφ = (pos2.lat-pos1.lat) * Math.PI/180;
    const Δλ = (pos2.lng-pos1.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const findClosestPointOnRoute = (vesselPos, journeyData) => {
    let closestPoint = null;
    let minDistance = Infinity;
    let routeType = null;

    if (journeyData.routes.traveled?.features?.[0]?.geometry?.coordinates) {
      const coordinates = journeyData.routes.traveled.features[0].geometry.coordinates;
      coordinates.forEach(coord => {
        const routePoint = { lng: coord[0], lat: coord[1] };
        const distance = calculateDistance(vesselPos, routePoint);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = routePoint;
          routeType = 'traveled';
        }
      });
    }

    if (journeyData.routes.prediction?.features?.[0]?.geometry?.coordinates) {
      const coordinates = journeyData.routes.prediction.features[0].geometry.coordinates;
      coordinates.forEach(coord => {
        const routePoint = { lng: coord[0], lat: coord[1] };
        const distance = calculateDistance(vesselPos, routePoint);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = routePoint;
          routeType = 'prediction';
        }
      });
    }

    return { point: closestPoint, distance: minDistance, routeType: routeType };
  };

  // Get port coordinates (same as ShippingTracker)
  const getPortCoordinates = async (portName) => {
    try {
      const response = await fetch('/api/port-coordinates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portName: portName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get coordinates');
      }

      return data.coordinates;
    } catch (err) {
      console.error('❌ Failed to get coordinates for port:', err);
      return null;
    }
  };

  // Plan route (same as ShippingTracker)
  const planRouteWithSeaRouteTS = async (fromCoords, toCoords, routeType = 'route') => {
    try {
      const [fromLng, fromLat] = fromCoords.split(',').map(Number);
      const [toLng, toLat] = toCoords.split(',').map(Number);

      const origin = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [fromLng, fromLat] }
      };

      const destination = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [toLng, toLat] }
      };

      let routeResult;
      
      try {
        const response = await fetch('/api/searoute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origin, destination, units: 'kilometers' }),
        });

        if (response.ok) {
          const data = await response.json();
          routeResult = data.route;
        } else {
          throw new Error('Server-side route calculation failed');
        }
      } catch (serverError) {
        const { default: seaRoute } = await import('searoute-ts');
        routeResult = seaRoute(origin, destination, 'kilometers');
      }

      return {
        features: [{
          type: 'Feature',
          geometry: routeResult.geometry,
          properties: {
            distance: routeResult.properties.length * 1000,
            duration: routeResult.properties.length * 1000 * 36,
            ...routeResult.properties
          }
        }],
        properties: {
          distance: routeResult.properties.length * 1000,
          duration: routeResult.properties.length * 1000 * 36,
          units: 'kilometers'
        }
      };
    } catch (err) {
      console.error(`❌ ${routeType} route planning failed:`, err);
      throw err;
    }
  };

  // Track container function
  const trackContainer = async (container, index) => {
  // If switching containers, clean up previous map
  if (selectedContainer && selectedContainer.containerNumber !== container.containerNumber) {
    const previousMapContainer = document.getElementById(`container-map-${selectedContainer.containerNumber}`);
    if (previousMapContainer) {
      previousMapContainer.innerHTML = '';
    }
    setMapInitialized(false);
  }

  setSelectedContainer({ ...container, index });
  setTrackingLoading(true);
  setTrackingError('');
  setTrackingData(null);
  setJourneyData(null);
  setShowMap(false);
  setMapInitialized(false); // Reset map initialization

  const trackingMethod = container.trackingMethod || 'BL_TRACKING';
  const apiTrackingType = trackingTypeMapping[trackingMethod] || 'ContainerTracking';
  const displayTrackingMethod = trackingMethodLabels[trackingMethod] || trackingMethod;

  try {
    // Create shipment
    const response = await fetch('/api/visiwise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation CreateShipment($createShipmentInput: CreateShipmentInput!) {
            createShipment(createShipmentInput: $createShipmentInput) {
              createdShipment { id }
            }
          }
        `,
        variables: {
          createShipmentInput: {
            trackingInput: {
              trackingReference: container.containerNumber.trim(),
              shippingLine: container.shippingLine,
              trackingType: apiTrackingType
            },
            withTracking: true
          }
        }
      }),
    });

    const result = await response.json();
    
    if (!response.ok || result.errors) {
      throw new Error(result.errors?.[0]?.message || 'Tracking failed');
    }

    const shipmentId = result.data.createShipment.createdShipment.id;
    await pollShipmentStatus(shipmentId, trackingMethod);
    
  } catch (err) {
    console.error('❌ Tracking error:', err);
    setTrackingError(`${displayTrackingMethod} tracking failed: ${err.message}`);
    setTrackingLoading(false);
  }
};

  // Poll shipment status (simplified version)
  const pollShipmentStatus = async (shipmentId, trackingMethod) => {
    let attempts = 0;
    const maxAttempts = 10;
    
    const poll = async () => {
      try {
        const response = await fetch('/api/visiwise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query Shipment($shipmentId: ID!) {
                shipment(id: $shipmentId) {
                  id
                  trackingReference
                  containerTracking {
                    id
                    number
                    trackStatus { status exception }
                    shippingLine { name keyname }
                    arrivalTime { value isActual }
                    lastMovementEventDescription
                    portOfLoading { unlocodeName }
                    portOfDischarge { unlocodeName }
                    currentVessel {
                      name
                      position { latitude longitude actualSnapTime }
                    }
                  }
                  blTracking {
                    id
                    number
                    trackStatus { status exception }
                    shippingLine { name keyname }
                    portOfLoading { unlocodeName }
                    portOfDischarge { unlocodeName }
                    containers {
                      id
                      number
                      arrivalTime { value isActual }
                      lastMovementEventDescription
                      currentVessel {
                        name
                        position { latitude longitude actualSnapTime }
                      }
                    }
                  }
                }
              }
            `,
            variables: { shipmentId }
          }),
        });

        const result = await response.json();
        const shipmentData = result.data.shipment;
        
        setTrackingData(shipmentData);
        
        // Get tracking data based on method
        let tracking;
        if (trackingMethod === 'CONTAINER_TRACKING') {
          tracking = shipmentData.containerTracking;
        } else if (trackingMethod.includes('BL')) {
          tracking = shipmentData.blTracking;
          if (tracking?.containers?.[0]?.currentVessel) {
            tracking.currentVessel = tracking.containers[0].currentVessel;
          }
        } else {
          tracking = shipmentData.containerTracking;
        }
        
        if (!tracking) {
          setTrackingError('No tracking data found for this reference.');
          setTrackingLoading(false);
          return;
        }
        
        const status = tracking.trackStatus?.status;
        const lastMovement = tracking.lastMovementEventDescription?.toLowerCase() || '';
        
        // Check if completed
        const isCompleted = 
          status === 'Track-Succeeded' || 
          (status === 'Is-Tracking' || status === 'Track-Queued') && tracking.currentVessel?.position ||
          (status === 'Is-Tracking' && (
            lastMovement.includes('discharge from vessel') ||
            lastMovement.includes('delivered') ||
            lastMovement.includes('available for pickup') ||
            lastMovement.includes('empty return') ||
            lastMovement.includes('import gate out') ||
            lastMovement.includes('gate out')
          ));
        
        if (isCompleted) {
          setTrackingLoading(false);
          await processVesselJourney(shipmentData, trackingMethod);
          return;
        } 
        
        if (status === 'Track-Failed') {
          setTrackingError(`Tracking failed: ${tracking.trackStatus.exception || 'Invalid reference'}`);
          setTrackingLoading(false);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setTrackingError('Tracking timeout - please try again');
          setTrackingLoading(false);
        }
        
      } catch (err) {
        console.error('❌ Polling error:', err);
        setTrackingError(`Tracking error: ${err.message}`);
        setTrackingLoading(false);
      }
    };
    
    poll();
  };

  // Process vessel journey (same logic as ShippingTracker)
  const processVesselJourney = async (shipmentData, trackingMethod) => {
    setProcessingRoutes(true);
    try {
      let tracking;
      if (trackingMethod === 'CONTAINER_TRACKING') {
        tracking = shipmentData.containerTracking;
      } else if (trackingMethod.includes('BL')) {
        tracking = shipmentData.blTracking;
        if (tracking?.containers?.[0]?.currentVessel) {
          tracking.currentVessel = tracking.containers[0].currentVessel;
          tracking.lastMovementEventDescription = tracking.containers[0].lastMovementEventDescription || 'Vessel in transit';
          tracking.arrivalTime = tracking.containers[0].arrivalTime;
        }
      } else {
        tracking = shipmentData.containerTracking;
      }
      
      // Check if completed
      let shipmentCompleted = false;
      const lastMovement = tracking?.lastMovementEventDescription?.toLowerCase() || '';
      
      const completedKeywords = [
        'discharge', 'delivered', 'arrived at destination', 
        'available for pickup', 'empty return', 'import gate out', 'gate out'
      ];
      
      const isDischargeFromVessel = lastMovement.includes('discharge from vessel');
      const isImportGateOut = lastMovement.includes('import gate out');
      const isGateOut = lastMovement.includes('gate out');
      
      if (!tracking?.currentVessel?.position && 
          (completedKeywords.some(keyword => lastMovement.includes(keyword)) || 
           isDischargeFromVessel || isImportGateOut)) {
        shipmentCompleted = true;
      }

      const portOfLoading = tracking.portOfLoading;
      const portOfDischarge = tracking.portOfDischarge;
      const containerNumber = tracking.number;
      const shippingLine = tracking.shippingLine;

      let originCoords = null;
      let destinationCoords = null;

      if (portOfLoading?.unlocodeName) {
        originCoords = await getPortCoordinates(portOfLoading.unlocodeName);
      }

      if (portOfDischarge?.unlocodeName) {
        destinationCoords = await getPortCoordinates(portOfDischarge.unlocodeName);
      }

      let routes = {};

      if (shipmentCompleted) {
        // Plan complete route for completed shipments
        if (originCoords && destinationCoords) {
          try {
            routes.completed = await planRouteWithSeaRouteTS(originCoords, destinationCoords, 'completed route');
          } catch (err) {
            console.warn('⚠️ Could not plan complete route:', err.message);
          }
        }

        let completionStatus = 'Shipment Completed';
        let completionDetails = tracking.lastMovementEventDescription || 'Delivered';
        
        if (isDischargeFromVessel) {
          completionStatus = 'Container Discharged';
          completionDetails = 'Discharge From Vessel - Available for pickup';
        } else if (isImportGateOut) {
          completionStatus = 'Container Delivered';
          completionDetails = 'Import Gate Out - En route to final destination';
        } else if (isGateOut) {
          completionStatus = 'Container Delivered';
          completionDetails = 'Gate Out - Container has left terminal';
        }

        const journey = {
          completed: true,
          discharged: isDischargeFromVessel,
          gateOut: isImportGateOut || isGateOut,
          vessel: { name: completionStatus, container: containerNumber, shippingLine: shippingLine },
          ports: {
            loading: { name: portOfLoading?.unlocodeName, coordinates: originCoords },
            discharge: { name: portOfDischarge?.unlocodeName, coordinates: destinationCoords }
          },
          routes: routes,
          tracking: {
            status: tracking.trackStatus?.status,
            lastMovement: completionDetails,
            arrivalTime: tracking.arrivalTime,
            trackingType: trackingMethodLabels[trackingMethod] || 'Container',
            trackingMethod: trackingMethod,
            completedDate: tracking.arrivalTime?.value,
            isDischargedFromVessel: isDischargeFromVessel,
            isImportGateOut: isImportGateOut,
            isGateOut: isGateOut || isImportGateOut
          }
        };

        setJourneyData(journey);
        setShowMap(true);
        return;
      }

      // Active shipment logic
      if (!tracking?.currentVessel?.position) {
        throw new Error('No vessel position available - shipment may be completed or not yet started');
      }

      const vesselPosition = tracking.currentVessel.position;
      const vesselName = tracking.currentVessel.name;
      const currentCoords = `${vesselPosition.longitude},${vesselPosition.latitude}`;
      
      // Calculate routes for active shipment
      if (originCoords && currentCoords) {
        try {
          routes.traveled = await planRouteWithSeaRouteTS(originCoords, currentCoords, 'traveled route');
        } catch (err) {
          console.warn('⚠️ Could not plan traveled route:', err.message);
        }
      }

      if (destinationCoords && currentCoords) {
        try {
          routes.prediction = await planRouteWithSeaRouteTS(currentCoords, destinationCoords, 'prediction route');
        } catch (err) {
          console.warn('⚠️ Could not plan prediction route:', err.message);
        }
      }

      const journey = {
        completed: false,
        discharged: false,
        gateOut: false,
        vessel: { name: vesselName, position: vesselPosition, container: containerNumber, shippingLine: shippingLine },
        ports: {
          loading: { name: portOfLoading?.unlocodeName, coordinates: originCoords },
          discharge: { name: portOfDischarge?.unlocodeName, coordinates: destinationCoords }
        },
        routes: routes,
        tracking: {
          status: tracking.trackStatus?.status,
          lastMovement: tracking.lastMovementEventDescription || 'Vessel in transit',
          arrivalTime: tracking.arrivalTime,
          trackingType: trackingMethodLabels[trackingMethod] || 'Container',
          trackingMethod: trackingMethod,
          isDischargedFromVessel: false,
          isImportGateOut: false,
          isGateOut: false
        }
      };

      setJourneyData(journey);
      setShowMap(true);
      
    } catch (err) {
      console.error('❌ Journey processing failed:', err);
      setTrackingError(`Journey planning failed: ${err.message}`);
    } finally {
      setProcessingRoutes(false);
    }
  };

  // Initialize map (same as ShippingTracker but with unique container ID)
  const initializeMap = useCallback(() => {
  if (!window.google || !window.google.maps || !journeyData || !selectedContainer) {
    return;
  }

  const mapContainerId = `container-map-${selectedContainer.containerNumber}`;
  const mapContainer = document.getElementById(mapContainerId);
  
  if (!mapContainer) {
    console.log('❌ Map container not found:', mapContainerId);
    return;
  }

  // Clean up existing map content
// Clean up existing map content and animations
mapContainer.innerHTML = '';
if (mapContainer.arrowAnimation) {
  clearInterval(mapContainer.arrowAnimation);
  delete mapContainer.arrowAnimation;
}  
  console.log('🗺️ Initializing map for container:', selectedContainer.containerNumber);

  // Dark mode map styles
  const darkMapStyles = [
    { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1426" }] }
  ];

  const map = new window.google.maps.Map(mapContainer, {
    zoom: 4,
    center: { lat: 0, lng: 0 },
    styles: darkMapStyles,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true
  });

  const bounds = new window.google.maps.LatLngBounds();

  // Store map instance for cleanup
  mapContainer.mapInstance = map;

  setTimeout(() => {
    // Add origin marker
    if (journeyData.ports.loading.coordinates) {
      const [originLng, originLat] = journeyData.ports.loading.coordinates.split(',').map(Number);
      const originLatLng = { lat: originLat, lng: originLng };
      
      new window.google.maps.Marker({
        position: originLatLng,
        map: map,
        title: `Origin: ${journeyData.ports.loading.name}`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 0C9.477 0 5 4.477 5 10c0 7.5 10 25 10 25s10-17.5 10-25c0-5.523-4.477-10-10-10z" fill="#22c55e"/>
              <circle cx="15" cy="10" r="6" fill="#ffffff"/>
              <text x="15" y="13" text-anchor="middle" fill="#22c55e" font-size="6" font-weight="bold">POL</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(30, 40),
          anchor: new window.google.maps.Point(15, 40)
        }
      });

      bounds.extend(originLatLng);
    }

    // Add destination marker
    if (journeyData.ports.discharge.coordinates) {
      const [destLng, destLat] = journeyData.ports.discharge.coordinates.split(',').map(Number);
      const destLatLng = { lat: destLat, lng: destLng };
      
      const destColor = journeyData.completed ? '#22c55e' : '#ef4444';
      const destText = journeyData.completed ? '✓' : 'POD';
      
      new window.google.maps.Marker({
        position: destLatLng,
        map: map,
        title: `Destination: ${journeyData.ports.discharge.name}${journeyData.completed ? ' (Arrived)' : ''}`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 0C9.477 0 5 4.477 5 10c0 7.5 10 25 10 25s10-17.5 10-25c0-5.523-4.477-10-10-10z" fill="${destColor}"/>
              <circle cx="15" cy="10" r="6" fill="#ffffff"/>
              <text x="15" y="13" text-anchor="middle" fill="${destColor}" font-size="${journeyData.completed ? '8' : '6'}" font-weight="bold">${destText}</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(30, 40),
          anchor: new window.google.maps.Point(15, 40)
        }
      });

      bounds.extend(destLatLng);
    }


      // Add destination marker
      if (journeyData.ports.discharge.coordinates) {
        const [destLng, destLat] = journeyData.ports.discharge.coordinates.split(',').map(Number);
        const destLatLng = { lat: destLat, lng: destLng };
        
        const destColor = journeyData.completed ? '#22c55e' : '#ef4444';
        const destText = journeyData.completed ? '✓' : 'POD';
        
        new window.google.maps.Marker({
          position: destLatLng,
          map: map,
          title: `Destination: ${journeyData.ports.discharge.name}${journeyData.completed ? ' (Arrived)' : ''}`,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 0C9.477 0 5 4.477 5 10c0 7.5 10 25 10 25s10-17.5 10-25c0-5.523-4.477-10-10-10z" fill="${destColor}"/>
                <circle cx="15" cy="10" r="6" fill="#ffffff"/>
                <text x="15" y="13" text-anchor="middle" fill="${destColor}" font-size="${journeyData.completed ? '8' : '6'}" font-weight="bold">${destText}</text>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(30, 40),
            anchor: new window.google.maps.Point(15, 40)
          }
        });

        bounds.extend(destLatLng);
      }

      // Add routes
      if (journeyData.completed && journeyData.routes.completed?.features?.[0]?.geometry?.coordinates) {
        const coordinates = journeyData.routes.completed.features[0].geometry.coordinates;
        const path = coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));
        
        new window.google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: '#22c55e',
          strokeOpacity: 0.9,
          strokeWeight: 6,
          map: map
        });
        
        path.forEach(point => bounds.extend(point));
      } else {
        // Add traveled route
        if (journeyData.routes.traveled?.features?.[0]?.geometry?.coordinates) {
          const coordinates = journeyData.routes.traveled.features[0].geometry.coordinates;
          const path = coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));
          
          new window.google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#22c55e',
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map: map
          });
          
          path.forEach(point => bounds.extend(point));
        }

        // Add prediction route
        // Add prediction route with moving arrows (away from vessel)
if (journeyData.routes.prediction?.features?.[0]?.geometry?.coordinates) {
  const coordinates = journeyData.routes.prediction.features[0].geometry.coordinates;
  const path = coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));
  
  const predictionPolyline = new window.google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: '#06b6d4',
    strokeOpacity: 1,
    strokeWeight: 4,
    map: map,
    icons: [{
      icon: {
        path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 3,
        strokeColor: '#0891b2',
        fillColor: '#0891b2',
        fillOpacity: 0.8,
      },
      offset: '25%', // Start arrows at 25% along the route (away from vessel)
      repeat: '120px' // Increased spacing between arrows
    }]
  });
  
  // Slow moving animation for the arrows
  let arrowOffset = 25; // Start at 25% to avoid vessel area
  const animateArrows = setInterval(() => {
    arrowOffset += 0.5; // Slow movement (0.5% per interval)
    if (arrowOffset > 100) {
      arrowOffset = 25; // Reset to 25% when reaching end
    }
    
    const icons = predictionPolyline.get('icons');
    if (icons && icons[0]) {
      icons[0].offset = arrowOffset + '%';
      predictionPolyline.set('icons', icons);
    }
  }, 200); // Slower animation (200ms intervals)
  
  // Store cleanup function
  mapContainer.arrowAnimation = animateArrows;
  
  path.forEach(point => bounds.extend(point));
}

        // Add vessel marker
        // Add vessel marker
if (journeyData.vessel.position) {
  const vesselPos = journeyData.vessel.position;
  const actualVesselPos = { lat: vesselPos.latitude, lng: vesselPos.longitude };
  
  let vesselDisplayPos = actualVesselPos;
  
  const closestPoint = findClosestPointOnRoute(actualVesselPos, journeyData);
  if (closestPoint.point) {
    vesselDisplayPos = closestPoint.point;
  }

  new window.google.maps.Marker({
    position: vesselDisplayPos,
    map: map,
    title: `${journeyData.vessel.name} - Current Position`,
    icon: {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
          <!-- Outer pulsating ring -->
          <circle cx="30" cy="30" r="25" fill="#22c55e" fill-opacity="0.2">
            <animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="fill-opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite"/>
          </circle>
          
          <!-- Inner pulsating ring -->
          <circle cx="30" cy="30" r="18" fill="#22c55e" fill-opacity="0.4">
            <animate attributeName="r" values="15;22;15" dur="1.5s" repeatCount="indefinite"/>
            <animate attributeName="fill-opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          
          <!-- Ship body (hull) - GREEN -->
          <path d="M25 38 Q25 33 27 33 L33 33 Q35 33 35 38 L34 42 L26 42 Z" fill="#16a34a"/>
          
          <!-- Main deck - GREEN -->
          <rect x="26" y="29" width="8" height="10" fill="#22c55e" rx="1"/>
          
          <!-- Cabin/Bridge - GREEN -->
          <rect x="27.5" y="25" width="5" height="7" fill="#16a34a" rx="0.5"/>
          
          <!-- Mast - GREEN -->
          <line x1="30" y1="25" x2="30" y2="18" stroke="#16a34a" stroke-width="1.5"/>
          
          <!-- Flag - Keep red for visibility -->
          <polygon points="30,18 35,20 30,22" fill="#ef4444"/>
          
          <!-- Center navigation point - WHITE with GREEN border -->
          <circle cx="30" cy="30" r="2" fill="#ffffff" stroke="#16a34a" stroke-width="1.5"/>
          
          <!-- Cross indicator - WHITE -->
          <line x1="27" y1="30" x2="33" y2="30" stroke="#ffffff" stroke-width="0.8" opacity="0.9"/>
          <line x1="30" y1="27" x2="30" y2="33" stroke="#ffffff" stroke-width="0.8" opacity="0.9"/>
          
          <!-- Moving indicator (rotating) -->
          <circle cx="30" cy="30" r="12" fill="none" stroke="#22c55e" stroke-width="1" stroke-dasharray="2,4" opacity="0.6">
            <animateTransform attributeName="transform" type="rotate" values="0 30 30;360 30 30" dur="3s" repeatCount="indefinite"/>
          </circle>
        </svg>
      `),
      scaledSize: new window.google.maps.Size(60, 60),
      anchor: new window.google.maps.Point(30, 30)
    }
  });

  bounds.extend(vesselDisplayPos);
}
     }

     // Fit map bounds
     if (!bounds.isEmpty()) {
       map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
       
       window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
         if (map.getZoom() > 15) {
           map.setZoom(15);
         }
       });
     }
   }, 100);
 }, [journeyData, selectedContainer, mapInitialized]);

 // Initialize map when ready
 useEffect(() => {
  if (mapLoaded && showMap && journeyData && selectedContainer) {
    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeMap();
      setMapInitialized(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }
}, [mapLoaded, showMap, journeyData, selectedContainer, initializeMap]);

useEffect(() => {
  return () => {
    // Clean up any existing map instances
    if (window.google && window.google.maps) {
      const mapContainers = document.querySelectorAll('[id^="container-map-"]');
      mapContainers.forEach(container => {
        if (container.mapInstance) {
          container.innerHTML = '';
          delete container.mapInstance;
        }
      });
    }
  };
}, []);

 // Format functions
 const formatDate = (dateString) => {
   if (!dateString) return 'N/A';
   try {
     return new Date(dateString).toLocaleDateString('en-AU', {
       day: 'numeric',
       month: 'short',
       year: 'numeric'
     }) + ' LT';
   } catch {
     return 'N/A';
   }
 };

 const formatDistance = (meters) => {
   if (!meters) return 'N/A';
   const km = meters / 1000;
   return `${km.toFixed(0)} km`;
 };

 const formatDuration = (milliseconds) => {
   if (!milliseconds) return 'N/A';
   const hours = milliseconds / (1000 * 60 * 60);
   const days = Math.floor(hours / 24);
   const remainingHours = Math.floor(hours % 24);
   
   if (days > 0) {
     return `${days}d ${remainingHours}h`;
   } else {
     return `${Math.round(hours)}h`;
   }
 };

 // Reset tracking data when closing
const closeTracking = () => {
  setSelectedContainer(null);
  setTrackingData(null);
  setJourneyData(null);
  setShowMap(false);
  setMapInitialized(false);
  setTrackingError('');
  // Clean up existing map instance and animations
  if (window.google && window.google.maps) {
    const existingMapContainer = document.querySelector('[id^="container-map-"]');
    if (existingMapContainer) {
      if (existingMapContainer.arrowAnimation) {
        clearInterval(existingMapContainer.arrowAnimation);
      }
      existingMapContainer.innerHTML = '';
    }
  }
};

 // Loading state
 if (loading) {
   return (
     <div className="flex items-center justify-center p-6 bg-gradient-to-r from-teal-50/80 to-emerald-50/80 rounded-xl border border-teal-200/50 backdrop-blur-sm">
       <div className="flex flex-col items-center gap-3">
         <div className="relative">
           <Loader className="w-6 h-6 text-teal-600 animate-spin" />
           <div className="absolute inset-0 w-6 h-6 border-2 border-teal-200 rounded-full animate-pulse"></div>
         </div>
         <p className="text-teal-700 font-medium text-sm">Loading containers...</p>
       </div>
     </div>
   );
 }

 // Error state
 if (error) {
   return (
     <div className="p-4 bg-gradient-to-r from-red-50/80 to-pink-50/80 border border-red-200/50 rounded-xl backdrop-blur-sm">
       <div className="flex items-center gap-2 text-red-700 mb-3">
         <AlertCircle className="w-5 h-5" />
         <p className="font-medium text-sm">{error}</p>
       </div>
       <button
         onClick={fetchShippingContainers}
         className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
       >
         Retry
       </button>
     </div>
   );
 }

 // No containers found
 if (!shippingContainers || shippingContainers.length === 0) {
   return (
     <div className="p-6 bg-gradient-to-r from-gray-50/80 to-slate-50/80 border border-gray-200/50 rounded-xl text-center backdrop-blur-sm">
       <Package className="w-8 h-8 text-gray-400 mx-auto mb-3" />
       <p className="text-gray-600 font-medium mb-1 text-sm">No shipping containers found</p>
       <p className="text-gray-500 text-xs">This order hasn't been assigned to any containers yet.</p>
     </div>
   );
 }

 return (
   <>
     {/* Load Lottie Web Component Script */}
     <Script 
       src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.6.2/dist/dotlottie-wc.js" 
       type="module"
       strategy="afterInteractive"
     />

     <div className="space-y-4 mt-6">
       {/* Header */}
       <div className="flex items-center justify-between gap-3 pb-3 border-b border-teal-200/30">
         <div className="flex items-center gap-3">
           <div className="p-2 bg-teal-100/60 rounded-lg backdrop-blur-sm">
             <Ship className="w-5 h-5 text-teal-600" />
           </div>
           <div>
             <h4 className="font-semibold text-teal-800 text-lg">Container Tracking</h4>
             <p className="text-teal-600/70 text-xs">
               {shippingContainers.length} container{shippingContainers.length !== 1 ? 's' : ''} available
             </p>
           </div>
         </div>
         
       </div>

       {/* Container Cards Grid */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         {shippingContainers.map((container, index) => (
           <button
             key={`${container.containerNumber}-${index}`}
             onClick={() => trackContainer(container, index)}
             disabled={trackingLoading && selectedContainer?.containerNumber === container.containerNumber}
             className="group cursor-pointer relative bg-gradient-to-br from-teal-400/90 via-teal-500/90 to-emerald-600/90 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border border-teal-300/50 backdrop-blur-sm min-h-[120px] disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {/* Ocean Waves Background */}
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-teal-800/20">
               <svg className="absolute bottom-0 left-0 w-full h-8" viewBox="0 0 400 32" preserveAspectRatio="none">
                 <path
                   d="M0,16 Q100,8 200,16 T400,16 L400,32 L0,32 Z"
                   fill="rgba(255,255,255,0.1)"
                   className="animate-pulse"
                 >
                   <animateTransform
                     attributeName="transform"
                     type="translate"
                     values="0,0; 40,0; 0,0"
                     dur="4s"
                     repeatCount="indefinite"
                   />
                 </path>
               </svg>
             </div>

             {/* Ship Animation */}
             <div className="absolute top-2 right-2 opacity-80 group-hover:opacity-100 transition-opacity">
               <dotlottie-wc 
                 src="https://lottie.host/ba24df0c-5b0e-41f2-a767-03a517f688a4/bJMEnoZZpF.lottie" 
                 style={{
                   width: '60px',
                   height: '60px'
                 }}
                 speed="1.2" 
                 autoplay 
                 loop
               />
             </div>

             {/* Loading indicator for active tracking */}
             {trackingLoading && selectedContainer?.containerNumber === container.containerNumber && (
               <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                 <Loader className="w-6 h-6 animate-spin text-white" />
               </div>
             )}

             {/* Container Information */}
             <div className="relative z-10 p-4 h-full flex flex-col justify-between">
               <div className="text-left">
                 <div className="flex items-center gap-2 mb-2">
                   <div className="w-3 h-3 bg-white/80 rounded-full"></div>
                   <span className="text-white font-bold text-base">
                     Container #{index + 1}
                   </span>
                 </div>
                 
                 <div className="space-y-1">
                   <div className="text-xs font-mono bg-white/20 rounded-md px-2 py-1 backdrop-blur-sm text-white inline-block">
                     {container.containerNumber}
                   </div>
                   
                   <div className="flex items-center gap-1 text-white/90">
                     <Navigation className="w-3 h-3" />
                     <span className="text-xs font-medium">
                       {container.shippingLine}
                     </span>
                   </div>
                   
                   {container.trackingMethod && (
                     <div className="text-xs text-white/75 mt-1">
                       Via {container.trackingMethod.replace('_', ' ')}
                     </div>
                   )}
                 </div>
               </div>

               {/* Track Button Indicator */}
               <div className="text-right">
                 <div className="inline-flex items-center gap-1 text-white/80 text-xs group-hover:text-white transition-colors">
                   <span>Track Now</span>
                   <svg className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                   </svg>
                 </div>
               </div>
             </div>
           </button>
         ))}
       </div>

       {/* Tracking Results */}
       <AnimatePresence>
         {selectedContainer && (
           <motion.div
             initial={{ opacity: 0, height: 0 }}
             animate={{ opacity: 1, height: "auto" }}
             exit={{ opacity: 0, height: 0 }}
             transition={{ duration: 0.3 }}
             className="bg-gray-900 rounded-xl border border-gray-700 shadow-xl overflow-hidden"
           >
             {/* Tracking Header */}
             <div className="flex items-center justify-between p-4 border-b border-gray-700">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-cyan-500/20 rounded-lg">
                   <Ship className="w-5 h-5 text-cyan-400" />
                 </div>
                 <div>
                   <h3 className="text-lg font-semibold text-white">
                     Container #{selectedContainer.index + 1} Tracking
                   </h3>
                   <p className="text-sm text-gray-400">
                     {selectedContainer.containerNumber} • {selectedContainer.shippingLine}
                   </p>
                 </div>
               </div>
               <button
                 onClick={closeTracking}
                 className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
               >
                 <X className="w-5 h-5 text-gray-400" />
               </button>
             </div>

             {/* Tracking Loading State */}
             {trackingLoading && (
               <div className="p-6">
                 <div className="flex items-center justify-center py-8">
                   <div className="flex items-center gap-3">
                     <Loader className="w-5 h-5 animate-spin text-cyan-400" />
                     <span className="text-gray-300">
                       {processingRoutes ? 'Building journey visualization...' : 'Tracking container...'}
                     </span>
                   </div>
                 </div>
               </div>
             )}

             {/* Tracking Error State */}
             {trackingError && (
               <div className="p-6">
                 <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
                   <div className="flex items-center gap-2 mb-2">
                     <AlertCircle className="w-5 h-5 text-red-400" />
                     <span className="text-red-300 font-medium">Tracking Error</span>
                   </div>
                   <p className="text-red-200 text-sm mb-3">{trackingError}</p>
                   <button
                     onClick={() => trackContainer(selectedContainer, selectedContainer.index)}
                     className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                   >
                     Try Again
                   </button>
                 </div>
               </div>
             )}

             {/* Journey Data and Map */}
             {journeyData && (
               <div className="flex flex-col lg:flex-row">
                 {/* Journey Details - Left Side */}
                 <div className="lg:w-1/2 p-6 border-b lg:border-b-0 lg:border-r border-gray-700">
                   <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                     <Route className="w-4 h-4" />
                     Journey Details
                   </h4>
                   
                   <div className="space-y-4">
                     {/* Route timeline */}
                     <div className="space-y-3">
                       {/* Origin */}
                       <div className="flex items-start gap-3">
                         <div className="flex flex-col items-center pt-1">
                           <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                           <div className="w-px h-6 bg-gray-600 mt-1"></div>
                         </div>
                         <div className="flex-1">
                           <p className="text-xs text-gray-400 mb-1">Port of Loading</p>
                           <p className="text-green-400 text-sm font-medium">{journeyData.ports.loading.name}</p>
                         </div>
                       </div>

                       {/* Current Status */}
                       <div className="flex items-start gap-3">
                         <div className="flex flex-col items-center pt-1">
                           <div className={`w-3 h-3 rounded-full ${journeyData.completed ? 'bg-green-500' : 'bg-cyan-500 animate-pulse'}`}></div>
                           <div className="w-px h-6 bg-gray-600 mt-1"></div>
                         </div>
                         <div className="flex-1">
                           <p className="text-xs text-gray-400 mb-1">
                             {journeyData.completed ? 'Final Status' : 'Current Status'}
                           </p>
                           <p className={`text-sm font-medium ${journeyData.completed ? 'text-green-400' : 'text-cyan-400'}`}>
                             {journeyData.tracking.lastMovement}
                           </p>
                           
                           {journeyData.vessel.position && (
                             <p className="text-xs text-gray-500 mt-1">
                               {journeyData.vessel.position.latitude.toFixed(2)}°, {journeyData.vessel.position.longitude.toFixed(2)}°
                             </p>
                           )}
                         </div>
                       </div>

                       {/* Destination */}
                       <div className="flex items-start gap-3">
                         <div className="flex flex-col items-center pt-1">
                           <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                         </div>
                         <div className="flex-1">
                           <p className="text-xs text-gray-400 mb-1">Port of Discharge</p>
                           <p className="text-blue-400 text-sm font-medium">{journeyData.ports.discharge.name}</p>
                           <p className="text-xs text-gray-500 mt-1">
                             ETA: {formatDate(journeyData.tracking.arrivalTime?.value)}
                           </p>
                         </div>
                       </div>
                     </div>

                     {/* Journey Stats */}
                     {(journeyData.routes.traveled || journeyData.routes.prediction) && (
                       <div className="space-y-3 pt-4 border-t border-gray-700">
                         <h5 className="text-white text-sm font-medium">Journey Progress</h5>
                         
                         {journeyData.routes.traveled && (
                           <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3">
                             <p className="text-xs font-medium text-green-400 mb-1">Completed Journey</p>
                             <div className="text-xs text-green-300">
                               <p>{formatDistance(journeyData.routes.traveled.properties?.distance)}</p>
                               <p>{formatDuration(journeyData.routes.traveled.properties?.duration)}</p>
                             </div>
                           </div>
                         )}

                         {journeyData.routes.prediction && (
                           <div className="bg-cyan-900/30 border border-cyan-700/50 rounded-lg p-3">
                             <p className="text-xs font-medium text-cyan-400 mb-1">Remaining Journey</p>
                             <div className="text-xs text-cyan-300">
                               <p>{formatDistance(journeyData.routes.prediction.properties?.distance)}</p>
                               <p>{formatDuration(journeyData.routes.prediction.properties?.duration)}</p>
                             </div>
                           </div>
                         )}
                       </div>
                     )}
                   </div>
                 </div>

                 {/* Map - Right Side */}
                 <div className="lg:w-1/2 relative">
                   {showMap && (
                     <div 
                       id={`container-map-${selectedContainer.containerNumber}`}
                       className="w-full h-96 lg:h-[500px]"
                     ></div>
                   )}
                   
                   {/* Map Legend */}
                   {showMap && mapLoaded && (
                     <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur rounded-lg p-3 border border-gray-700">
                       <div className="space-y-2 text-xs">
                         <div className="flex items-center gap-2">
                           <div className="w-4 h-1 bg-green-500 rounded"></div>
                           <span className="text-gray-300">Completed route</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="w-4 h-1 bg-cyan-500 rounded border-dashed border border-cyan-400"></div>
                           <span className="text-gray-300">Predicted route</span>
                         </div>
                         <div className="flex items-center gap-2">
  <div className="w-4 h-4 flex items-center justify-center">
    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
 
      <circle cx="8" cy="8" r="6" fill="#22c55e" fillOpacity="0.3">
        <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="fill-opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite"/>
      </circle>
      

      <path d="M6 10 Q6 9 6.5 9 L9.5 9 Q10 9 10 10 L9.5 11 L6.5 11 Z" fill="#16a34a"/>
      

      <rect x="6.5" y="8" width="3" height="3" fill="#22c55e" rx="0.3"/>
      
    
      <rect x="7" y="7" width="2" height="2" fill="#16a34a" rx="0.2"/>
      
      
      <line x1="8" y1="7" x2="8" y2="5" stroke="#16a34a" strokeWidth="0.5"/>
     
      <polygon points="8,5 10,5.5 8,6" fill="#ef4444"/>
    </svg>
  </div>
  <span className="text-gray-300">Current vessel</span>
</div>
                       </div>
                     </div>
                   )}
                 </div>
               </div>
             )}
           </motion.div>
         )}
       </AnimatePresence>
     </div>
   </>
 );
};

export default InlineContainerTracker;