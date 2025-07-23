'use client';

import { useState, useEffect } from 'react';

// API URLs and Keys
const API_URL = '/api/visiwise';
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ;

// Embedded API Keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CompleteVisiwiseTracker = () => {
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
  const [journeyData, setJourneyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [processingRoutes, setProcessingRoutes] = useState(false);
  const [showForm, setShowForm] = useState(true);

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMaps = () => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps) {
        setMapLoaded(true);
        return;
      }

      // Check if script is already being loaded or exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existingScript) {
        // Script already exists, wait for it to load
        if (window.google && window.google.maps) {
          setMapLoaded(true);
        } else {
          // Wait for the existing script to load
          existingScript.addEventListener('load', () => setMapLoaded(true));
        }
        return;
      }

      // Load the script only if it doesn't exist
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapLoaded(true);
      script.onerror = () => console.error('Failed to load Google Maps API');
      
      // Add a unique identifier to prevent duplicate loading
      script.setAttribute('data-google-maps', 'true');
      
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // Add this useEffect after your existing useEffects:
  useEffect(() => {
    const handleResize = () => {
      if (mapLoaded && showMap && journeyData) {
        setTimeout(() => {
          const mapContainer = document.getElementById('journey-map');
          if (mapContainer && window.google) {
            window.google.maps.event.trigger(window.google.maps, 'resize');
          }
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mapLoaded, showMap, journeyData]);

  // Get coordinates for port name using OpenAI
  const getPortCoordinates = async (portName) => {
    try {
      console.log(`🌍 Getting coordinates for port: ${portName}`);

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a maritime logistics expert. Given a port name, provide its exact coordinates in the format "longitude,latitude" (e.g., "101.3984,3.0064"). Respond with ONLY the coordinates in this exact format with no additional text. For compound port names like "Northport/Pt Klang", use the main port coordinates.'
            },
            {
              role: 'user',
              content: `What are the coordinates for port: ${portName}`
            }
          ],
          max_tokens: 20,
          temperature: 0.1
        })
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const coordinates = openaiData.choices[0]?.message?.content?.trim();
      
      console.log('🔍 Found coordinates for', portName, ':', coordinates);
      return coordinates;
      
    } catch (err) {
      console.error('❌ Failed to get coordinates for port:', err);
      return null;
    }
  };

  // Plan route using searoute-ts package (replacing Searoutes API)
  const planRouteWithSearchouteTS = async (fromCoords, toCoords, routeType = 'route') => {
    try {
      console.log(`🗺️ Planning ${routeType} from ${fromCoords} to ${toCoords} using searoute-ts`);

      // Parse coordinates
      const [fromLng, fromLat] = fromCoords.split(',').map(Number);
      const [toLng, toLat] = toCoords.split(',').map(Number);

      // Create GeoJSON points for searoute-ts
      const origin = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [fromLng, fromLat]
        }
      };

      const destination = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [toLng, toLat]
        }
      };

      // Use the sea route calculation (either client-side or server-side)
      let routeResult;
      
      try {
        // Try server-side first
        const response = await fetch('/api/searoute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            origin,
            destination,
            units: 'kilometers'
          }),
        });

        if (response.ok) {
          const data = await response.json();
          routeResult = data.route;
        } else {
          throw new Error('Server-side route calculation failed');
        }
      } catch (serverError) {
        console.log('Server-side failed, trying client-side:', serverError.message);
        
        // Fallback to client-side calculation
        const { default: seaRoute } = await import('searoute-ts');
        routeResult = seaRoute(origin, destination, 'kilometers');
      }

      // Convert to format similar to the original Searoutes API response
      const formattedRoute = {
        features: [
          {
            type: 'Feature',
            geometry: routeResult.geometry,
            properties: {
              distance: routeResult.properties.length * 1000, // Convert km to meters
              duration: routeResult.properties.length * 1000 * 36, // Rough estimate: 1 km = 36 seconds at 100 km/h
              ...routeResult.properties
            }
          }
        ],
        properties: {
          distance: routeResult.properties.length * 1000, // Convert km to meters
          duration: routeResult.properties.length * 1000 * 36, // Rough estimate
          units: 'kilometers'
        }
      };

      console.log(`✅ ${routeType} route planned successfully with searoute-ts`);
      return formattedRoute;
      
    } catch (err) {
      console.error(`❌ ${routeType} route planning failed:`, err);
      throw err;
    }
  };

  // Process complete vessel journey with route planning using searoute-ts
  const processVesselJourney = async (shipmentData) => {
    setProcessingRoutes(true);
    try {
      console.log('🚢 Processing complete vessel journey with searoute-ts...');
      
      const tracking = shipmentData.containerTracking || 
                      shipmentData.blTracking || 
                      shipmentData.bookingTracking;
      
      if (!tracking) {
        throw new Error('No tracking data available');
      }

      let vesselPosition, portOfLoading, portOfDischarge, vesselName, containerNumber, shippingLine;
      
      if (shipmentData.containerTracking) {
        vesselPosition = tracking.currentVessel?.position;
        portOfLoading = tracking.portOfLoading;
        portOfDischarge = tracking.portOfDischarge;
        vesselName = tracking.currentVessel?.name;
        containerNumber = tracking.number;
        shippingLine = tracking.shippingLine;
      } else if (shipmentData.blTracking) {
        const containerWithVessel = tracking.containers?.find(container => 
          container.currentVessel?.position
        );
        
        if (!containerWithVessel) {
          throw new Error('No vessel position found in any containers');
        }
        
        vesselPosition = containerWithVessel.currentVessel.position;
        portOfLoading = tracking.portOfLoading;
        portOfDischarge = tracking.portOfDischarge;
        vesselName = containerWithVessel.currentVessel.name;
        containerNumber = `BL: ${tracking.number} (${tracking.containers.length} containers)`;
        shippingLine = tracking.shippingLine;
      } else if (shipmentData.bookingTracking) {
        vesselPosition = tracking.currentVessel?.position;
        portOfLoading = tracking.portOfLoading;
        portOfDischarge = tracking.portOfDischarge;
        vesselName = tracking.currentVessel?.name;
        containerNumber = `Booking: ${tracking.number || tracking.id}`;
        shippingLine = tracking.shippingLine;
      }

      if (!vesselPosition) {
        throw new Error('No current vessel position available');
      }

      const currentCoords = `${vesselPosition.longitude},${vesselPosition.latitude}`;
      
      let originCoords = null;
      let destinationCoords = null;

      if (portOfLoading?.unlocodeName) {
        originCoords = await getPortCoordinates(portOfLoading.unlocodeName);
      }

      if (portOfDischarge?.unlocodeName) {
        destinationCoords = await getPortCoordinates(portOfDischarge.unlocodeName);
      }

      let routes = {};

      // Calculate traveled route using searoute-ts
      if (originCoords) {
        try {
          routes.traveled = await planRouteWithSearchouteTS(originCoords, currentCoords, 'traveled route');
        } catch (err) {
          console.warn('Could not plan traveled route:', err.message);
        }
      }

      // Calculate prediction route using searoute-ts
      if (destinationCoords) {
        try {
          routes.prediction = await planRouteWithSearchouteTS(currentCoords, destinationCoords, 'prediction route');
        } catch (err) {
          console.warn('Could not plan prediction route:', err.message);
        }
      }

      const journey = {
        vessel: {
          name: vesselName,
          position: vesselPosition,
          container: containerNumber,
          shippingLine: shippingLine
        },
        ports: {
          loading: {
            name: portOfLoading?.unlocodeName,
            coordinates: originCoords
          },
          discharge: {
            name: portOfDischarge?.unlocodeName, 
            coordinates: destinationCoords
          }
        },
        routes: routes,
        tracking: {
          status: tracking.trackStatus?.status,
          lastMovement: tracking.lastMovementEventDescription || 'Vessel in transit',
          arrivalTime: tracking.arrivalTime,
          trackingType: shipmentData.containerTracking ? 'Container' : 
                       shipmentData.blTracking ? 'Bill of Lading' : 'Booking'
        },
        containers: shipmentData.blTracking ? tracking.containers : null
      };

      setJourneyData(journey);
      setShowMap(true);
      setShowForm(false);
      
    } catch (err) {
      console.error('❌ Journey processing failed:', err);
      setError(`Journey planning failed: ${err.message}`);
    } finally {
      setProcessingRoutes(false);
    }
  };

  // Initialize Google Map with beautiful styling and animations
  const initializeMap = () => {
    if (!window.google || !window.google.maps || !journeyData) return;

    const mapContainer = document.getElementById('journey-map');
    if (!mapContainer) return;

    const mapStyles = [
      {
        "elementType": "geometry",
        "stylers": [{"color": "#f5f5f5"}]
      },
      {
        "elementType": "labels.icon",
        "stylers": [{"visibility": "off"}]
      },
      {
        "elementType": "labels.text.fill",
        "stylers": [{"color": "#616161"}]
      },
      {
        "elementType": "labels.text.stroke",
        "stylers": [{"color": "#f5f5f5"}]
      },
      {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [{"color": "#c9c9c9"}]
      }
    ];

    const map = new window.google.maps.Map(mapContainer, {
      zoom: 4,
      center: { lat: 0, lng: 0 },
      styles: mapStyles,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      zoomControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_BOTTOM
      }
    });

    const bounds = new window.google.maps.LatLngBounds();
    
    // Add origin port marker
    if (journeyData.ports.loading.coordinates) {
      const [originLng, originLat] = journeyData.ports.loading.coordinates.split(',').map(Number);
      const originLatLng = { lat: originLat, lng: originLng };
      
      const originMarker = new window.google.maps.Marker({
        position: originLatLng,
        map: map,
        title: `Origin: ${journeyData.ports.loading.name}`,
        animation: window.google.maps.Animation.DROP,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
                </filter>
              </defs>
              <path d="M20 0C12.268 0 6 6.268 6 14c0 10.5 14 32 14 32s14-21.5 14-32c0-7.732-6.268-14-14-14z" fill="#10B981" filter="url(#shadow)"/>
              <circle cx="20" cy="14" r="8" fill="#ffffff"/>
              <text x="20" y="18" text-anchor="middle" fill="#10B981" font-size="8" font-weight="bold">TS1</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(40, 50),
          anchor: new window.google.maps.Point(20, 50)
        }
      });

      bounds.extend(originLatLng);
    }

    // Add current vessel position with pulsing animation
    const vesselPos = journeyData.vessel.position;
    const vesselLatLng = { lat: vesselPos.latitude, lng: vesselPos.longitude };

    const vesselMarker = new window.google.maps.Marker({
      position: vesselLatLng,
      map: map,
      title: `${journeyData.vessel.name} - Current Position`,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
              </filter>
            </defs>
            <!-- Pulsing outer circle -->
            <circle cx="30" cy="30" r="25" fill="#14B8A6" fill-opacity="0.3" filter="url(#shadow)">
              <animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="fill-opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite"/>
            </circle>
            <!-- Ship body -->
            <path d="M15 35 Q15 30 20 30 L40 30 Q45 30 45 35 L42 40 L18 40 Z" fill="#0F766E" filter="url(#shadow)"/>
            <!-- Ship deck -->
            <rect x="20" y="25" width="20" height="8" fill="#14B8A6" rx="2"/>
            <!-- Ship cabin -->
            <rect x="25" y="20" width="10" height="10" fill="#0F766E" rx="1"/>
            <!-- Ship mast -->
            <line x1="30" y1="20" x2="30" y2="15" stroke="#0F766E" stroke-width="2"/>
            <!-- Ship flag -->
            <polygon points="30,15 35,17 30,19" fill="#EF4444"/>
            <!-- Pulsing animation for the ship -->
            <g>
              <animateTransform attributeName="transform" type="scale" 
                values="1;1.1;1" dur="2s" repeatCount="indefinite" 
                additive="sum" transform-origin="30 30"/>
            </g>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(60, 60),
        anchor: new window.google.maps.Point(30, 30)
      }
    });

    bounds.extend(vesselLatLng);

    // Add destination port marker
    if (journeyData.ports.discharge.coordinates) {
      const [destLng, destLat] = journeyData.ports.discharge.coordinates.split(',').map(Number);
      const destLatLng = { lat: destLat, lng: destLng };
      
      const destMarker = new window.google.maps.Marker({
        position: destLatLng,
        map: map,
        title: `Destination: ${journeyData.ports.discharge.name}`,
        animation: window.google.maps.Animation.DROP,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
                </filter>
              </defs>
              <path d="M20 0C12.268 0 6 6.268 6 14c0 10.5 14 32 14 32s14-21.5 14-32c0-7.732-6.268-14-14-14z" fill="#EF4444" filter="url(#shadow)"/>
              <circle cx="20" cy="14" r="8" fill="#ffffff"/>
              <text x="20" y="18" text-anchor="middle" fill="#EF4444" font-size="6" font-weight="bold">POD</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(40, 50),
          anchor: new window.google.maps.Point(20, 50)
        }
      });

      bounds.extend(destLatLng);
    }

    // Add traveled route
    if (journeyData.routes.traveled?.features?.[0]?.geometry?.coordinates) {
      const coordinates = journeyData.routes.traveled.features[0].geometry.coordinates;
      const path = coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));
      
      const traveledPolyline = new window.google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#10B981',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        icons: [{
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: '#10B981',
            fillColor: '#10B981',
            fillOpacity: 1,
          },
          offset: '100%',
          repeat: '100px'
        }]
      });
      
      traveledPolyline.setMap(map);
      path.forEach(point => bounds.extend(point));
    }

    // Add prediction route with animated arrows
    if (journeyData.routes.prediction?.features?.[0]?.geometry?.coordinates) {
      const coordinates = journeyData.routes.prediction.features[0].geometry.coordinates;
      const path = coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));
      
      const predictionPolyline = new window.google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#14B8A6',
        strokeOpacity: 1,
        strokeWeight: 5
      });
      
      predictionPolyline.setMap(map);
      path.forEach(point => bounds.extend(point));

      // Animated arrows on prediction route
      let arrows = [{
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 5,
          strokeColor: '#0F766E',
          fillColor: '#0F766E',
          fillOpacity: 1,
        },
        offset: '0%',
        repeat: '80px'
      }];

      predictionPolyline.setOptions({ icons: arrows });

      // Animate the arrows
      let count = 0;
      setInterval(() => {
        count = (count + 1) % 200;
        const icons = predictionPolyline.get('icons');
        icons[0].offset = (count / 2) + '%';
        predictionPolyline.set('icons', icons);
      }, 50);
    }

    // Fit map to show all elements
    if (bounds.isEmpty() === false) {
      map.fitBounds(bounds);
      const padding = { top: 60, right: 60, bottom: 60, left: 60 };
      map.fitBounds(bounds, padding);
    }
  };

  // Replace the map initialization useEffect with this:
  useEffect(() => {
    if (mapLoaded && showMap && journeyData) {
      // Add a small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initializeMap();
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [mapLoaded, showMap, journeyData]);

  // Add this additional useEffect for handling layout changes
  useEffect(() => {
    if (mapLoaded && showMap && journeyData) {
      const observer = new ResizeObserver(() => {
        setTimeout(() => {
          const mapContainer = document.getElementById('journey-map');
          if (mapContainer && window.google && window.google.maps) {
            window.google.maps.event.trigger(mapContainer, 'resize');
          }
        }, 100);
      });

      const mapContainer = document.getElementById('journey-map');
      if (mapContainer) {
        observer.observe(mapContainer);
      }

      return () => observer.disconnect();
    }
  }, [mapLoaded, showMap, journeyData]);

  // API call function
  const callAPI = async (query, variables = {}) => {
    try {
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

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${result.error || result.message || 'Unknown error'}`);
      }
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      return result.data;
    } catch (err) {
      throw new Error(`API Error: ${err.message}`);
    }
  };

  // Load available shipping lines
  useEffect(() => {
    const loadAvailableLines = async () => {
      try {
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
        
        const data = await callAPI(GET_AVAILABLE_LINES);
        setAvailableLines({
          container: data.containerTrackingAvailableLines,
          bl: data.blTrackingAvailableLines,
          booking: data.bookingTrackingAvailableLines
        });
      } catch (err) {
        setError(`Failed to load shipping lines: ${err.message}`);
      }
    };
    
    loadAvailableLines();
  }, []);

  // Create and track shipment
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

    try {
      const CREATE_SHIPMENT = `
        mutation CreateShipment($createShipmentInput: CreateShipmentInput!) {
          createShipment(createShipmentInput: $createShipmentInput) {
            createdShipment {
              id
            }
          }
        }
      `;

      const shippingLine = trackingData.autoDetect ? 'MAERSK' : trackingData.shippingLine;

      const data = await callAPI(CREATE_SHIPMENT, {
        createShipmentInput: {
          trackingInput: {
            trackingReference: trackingData.reference,
            shippingLine: shippingLine,
            trackingType: trackingData.trackingType
          },
          withTracking: true
        }
      });

      const shipmentId = data.createShipment.createdShipment.id;
      await pollShipmentStatus(shipmentId);
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Poll shipment status
  const pollShipmentStatus = async (shipmentId) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 15;
    
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
            currentVessel {
              name
              position {
                latitude
                longitude
                actualSnapTime
              }
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
              keyname
            }
            portOfLoading {
              unlocodeName
            }
            portOfDischarge {
              unlocodeName
            }
            containers {
              id
              number
              currentVessel {
                name
                position {
                  latitude
                  longitude
                  actualSnapTime
                }
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
              keyname
            }
            arrivalTime {
              value
              isActual
            }
          }
        }
      }
    `;
    
    const poll = async () => {
      try {
        const data = await callAPI(GET_SHIPMENT, { shipmentId });
        const shipmentData = data.shipment;
        
        setShipment(shipmentData);
        
        const tracking = shipmentData.containerTracking || 
                        shipmentData.blTracking || 
                        shipmentData.bookingTracking;
        
        if (!tracking) {
          setError(`No tracking data found for this ${trackingData.trackingType.replace('Tracking', '').toLowerCase()}.`);
          setPolling(false);
          setLoading(false);
          return;
        }
        
        const status = tracking.trackStatus?.status;
        if (status === 'Track-Succeeded') {
         setPolling(false);
         setLoading(false);
         await processVesselJourney(shipmentData);
         return;
       } else if (status === 'Track-Failed') {
         setError(`Tracking failed: ${tracking.trackStatus.exception || 'Invalid reference'}`);
         setPolling(false);
         setLoading(false);
         return;
       } else if (status === 'Is-Tracking') {
         let hasVesselData = false;
         
         if (shipmentData.containerTracking?.currentVessel?.position) {
           hasVesselData = true;
         } else if (shipmentData.blTracking?.containers?.some(c => c.currentVessel?.position)) {
           hasVesselData = true;
         }
         
         if (hasVesselData && attempts >= 3) {
           console.log('✅ Found vessel data while tracking, proceeding...');
           setPolling(false);
           setLoading(false);
           await processVesselJourney(shipmentData);
           return;
         }
       }

       attempts++;
       if (attempts < maxAttempts) {
         setTimeout(poll, 3000);
       } else {
         if (tracking.trackStatus?.status === 'Is-Tracking') {
           try {
             await processVesselJourney(shipmentData);
             setPolling(false);
             setLoading(false);
             return;
           } catch (err) {
             console.log('No usable data found');
           }
         }
         
         setError('Tracking timeout - please try again');
         setPolling(false);
         setLoading(false);
       }
       
     } catch (err) {
       setError(err.message);
       setPolling(false);
       setLoading(false);
     }
   };
   
   poll();
 };

 // Format distance and duration
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

 return (
   <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50 to-teal-50">
 {/* Header */}

 <div className="bg-white shadow-sm border-b -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-4 md:mb-6">
   <div className="px-4 md:px-6 py-4">
     <div className="flex items-center justify-between">
       <div className="flex items-center space-x-3">
         <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
           <span className="text-white font-bold text-sm">🚢</span>
         </div>
         <h1 className="text-xl font-semibold text-gray-900">Maritime Journey Tracker</h1>
       </div>
       {journeyData && (
         <button
           onClick={() => {
             setShowForm(true);
             setShowMap(false);
             setJourneyData(null);
             setShipment(null);
           }}
           className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
         >
           New Search
         </button>
       )}
     </div>
   </div>
 </div>

 {/* Main Content */}
 <div className="w-full">
   {showForm ? (
     /* Beautiful Form View */
     <div className="w-full">
       <div className="text-center mb-8 md:mb-12">
         <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Track a Container</h1>
         <p className="text-base md:text-lg text-gray-600">Choose your tracking method below</p>
       </div>

       {/* Tracking Type Selection - Beautiful Cards */}
       <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-8 md:mb-12">
         {/* Booking Card */}
         <div 
           onClick={() => setTrackingData({...trackingData, trackingType: 'BookingTracking'})}
           className={`relative p-4 md:p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
             trackingData.trackingType === 'BookingTracking' 
               ? 'border-emerald-500 bg-emerald-50 shadow-lg' 
               : 'border-gray-200 bg-white hover:border-emerald-300'
           }`}
         >
           <div className="flex flex-col items-center text-center">
             <div className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 rounded-lg bg-emerald-100 flex items-center justify-center">
               <svg className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/>
               </svg>
             </div>
             <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-1">Booking</h3>
             <p className="text-xs text-gray-500">Booking reference</p>
           </div>
         </div>

         {/* Container Card - Selected by default */}
         <div 
           onClick={() => setTrackingData({...trackingData, trackingType: 'ContainerTracking'})}
           className={`relative p-4 md:p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
             trackingData.trackingType === 'ContainerTracking' 
               ? 'border-emerald-500 bg-emerald-50 shadow-lg' 
               : 'border-gray-200 bg-white hover:border-emerald-300'
           }`}
         >
           <div className="flex flex-col items-center text-center">
             <div className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 rounded-lg bg-emerald-100 flex items-center justify-center">
               <svg className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M2 6h20v2H2V6zm0 5h20v6H2v-6zm2 2v2h16v-2H4z"/>
               </svg>
             </div>
             <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-1">Container</h3>
             <p className="text-xs text-gray-500">Container number</p>
           </div>
           {trackingData.trackingType === 'ContainerTracking' && (
             <div className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-emerald-500 rounded-full flex items-center justify-center">
               <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                 <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
               </svg>
             </div>
           )}
         </div>

         {/* Multiple Shipments Card */}
         <div className="relative p-4 md:p-6 rounded-xl border-2 border-gray-200 bg-gray-50 cursor-not-allowed opacity-50">
           <div className="flex flex-col items-center text-center">
             <div className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 rounded-lg bg-gray-100 flex items-center justify-center">
               <svg className="w-6 h-6 md:w-8 md:h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zm-8 8h6v6H3v-6zm8 0h6v6h-6v-6z"/>
               </svg>
             </div>
             <h3 className="text-sm md:text-base font-semibold text-gray-500 mb-1">Multiple Shipments</h3>
             <p className="text-xs text-gray-400">Coming soon</p>
           </div>
         </div>

         {/* Bill of Lading Card */}
         <div 
           onClick={() => setTrackingData({...trackingData, trackingType: 'BLTracking'})}
           className={`relative p-4 md:p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
             trackingData.trackingType === 'BLTracking' 
               ? 'border-emerald-500 bg-emerald-50 shadow-lg' 
               : 'border-gray-200 bg-white hover:border-emerald-300'
           }`}
         >
           <div className="flex flex-col items-center text-center">
             <div className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 rounded-lg bg-emerald-100 flex items-center justify-center">
               <svg className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
               </svg>
             </div>
             <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-1">Bill of Lading</h3>
             <p className="text-xs text-gray-500">BL number</p>
           </div>
         </div>

         {/* Vessel Card */}
         <div className="relative p-4 md:p-6 rounded-xl border-2 border-gray-200 bg-gray-50 cursor-not-allowed opacity-50">
           <div className="flex flex-col items-center text-center">
             <div className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 rounded-lg bg-gray-100 flex items-center justify-center">
               <svg className="w-6 h-6 md:w-8 md:h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12l-8-8-8 8z"/>
               </svg>
             </div>
             <h3 className="text-sm md:text-base font-semibold text-gray-500 mb-1">Vessel</h3>
             <p className="text-xs text-gray-400">Coming soon</p>
           </div>
         </div>

         {/* Order Card */}
         <div className="relative p-4 md:p-6 rounded-xl border-2 border-gray-200 bg-gray-50 cursor-not-allowed opacity-50">
           <div className="flex flex-col items-center text-center">
             <div className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 rounded-lg bg-gray-100 flex items-center justify-center">
               <svg className="w-6 h-6 md:w-8 md:h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h4zM5 8h14l-1 8H6L5 8z"/>
               </svg>
             </div>
             <h3 className="text-sm md:text-base font-semibold text-gray-500 mb-1">Order</h3>
             <p className="text-xs text-gray-400">Coming soon</p>
           </div>
         </div>
       </div>

       {/* Search Form */}
       <div className="w-full max-w-2xl mx-auto">
         <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
           {/* Auto Detect Dropdown - MOVED UP */}
           <div className="mb-6">
             <div className="relative">
               <select 
                 value={trackingData.autoDetect ? 'auto' : trackingData.shippingLine}
                 onChange={(e) => {
                   if (e.target.value === 'auto') {
                     setTrackingData({...trackingData, autoDetect: true, shippingLine: ''});
                   } else {
                     setTrackingData({...trackingData, autoDetect: false, shippingLine: e.target.value});
                   }
                 }}
                 className="w-full px-4 md:px-6 py-3 md:py-4 text-base md:text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none appearance-none bg-white transition-all"
               >
                 <option value="auto">⭐ Auto Detect</option>
                 <optgroup label="Container Lines">
                   {availableLines.container?.map((line) => (
                     <option key={line.keyname} value={line.keyname}>
                       {line.name}
                     </option>
                   ))}
                 </optgroup>
                 {trackingData.trackingType === 'BLTracking' && (
                   <optgroup label="BL Lines">
                     {availableLines.bl?.map((line) => (
                       <option key={line.keyname} value={line.keyname}>
                         {line.name}
                       </option>
                     ))}
                   </optgroup>
                 )}
                 {trackingData.trackingType === 'BookingTracking' && (
                   <optgroup label="Booking Lines">
                     {availableLines.booking?.map((line) => (
                       <option key={line.keyname} value={line.keyname}>
                         {line.name}
                       </option>
                     ))}
                   </optgroup>
                 )}
               </select>
               <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                 <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                   <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                 </svg>
               </div>
             </div>
           </div>

           {/* Reference Input - MOVED DOWN */}
           <div className="mb-6 md:mb-8">
             <div className="relative">
               <input
                 type="text"
                 value={trackingData.reference}
                 onChange={(e) => setTrackingData({...trackingData, reference: e.target.value})}
                 placeholder={
                   trackingData.trackingType === 'ContainerTracking' ? 'Container Number, Ex. DFSU7162007' :
                   trackingData.trackingType === 'BLTracking' ? 'Bill of Lading Number, Ex. HLCUIZ1250599742' :
                   'Booking Reference Number'
                 }
                 className="w-full px-4 md:px-6 py-3 md:py-4 text-base md:text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
               />
             </div>
           </div>

           {/* Error Display */}
           {error && (
             <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
               <p className="text-red-800 text-sm">{error}</p>
             </div>
           )}

           {/* Track Button */}
           <button
             onClick={createShipment}
             disabled={loading || !trackingData.reference}
             className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 md:py-4 px-6 md:px-8 rounded-xl font-semibold text-base md:text-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
           >
             {loading ? (
               <div className="flex items-center justify-center">
                 <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-white mr-3"></div>
                 {polling ? 'Processing journey...' : 'Tracking...'}
               </div>
             ) : (
               'Track Container'
             )}
           </button>

           {/* Loading Status */}
           {(loading || processingRoutes) && (
             <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
               <div className="flex items-center">
                 <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600 mr-3"></div>
                 <div className="text-sm">
                   {processingRoutes ? (
                     <div>
                       <p className="font-medium text-emerald-900">Building journey visualization with searoute-ts...</p>
                       <p className="text-emerald-700">Getting coordinates and planning sea routes</p>
                     </div>
                   ) : polling ? (
                     <p className="text-emerald-800">Getting tracking data...</p>
                   ) : (
                     <p className="text-emerald-800">Initializing tracking...</p>
                   )}
                 </div>
               </div>
             </div>
           )}
         </div>
       </div>
     </div>
   ) : (
     /* Map View - Adjusted for dashboard layout */
<div className="flex flex-col xl:flex-row gap-4 md:gap-6 min-h-[600px] xl:h-[calc(100vh-200px)]">
       {/* Left Panel - Journey Details */}
 <div className="w-full xl:w-80 2xl:w-96 bg-white rounded-xl shadow-lg p-4 md:p-6 overflow-y-auto max-h-96 xl:max-h-none">
         <div className="space-y-4 md:space-y-6">
           {/* Vessel Info */}
           {journeyData && (
             <div>
               <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4">Current Status</h3>
               <div className="space-y-3">
                 <div className="flex items-center p-3 bg-emerald-50 rounded-lg">
                   <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center mr-3">
                     <span className="text-white font-bold">🚢</span>
                   </div>
                   <div>
                     <p className="font-medium text-gray-900 text-sm md:text-base">{journeyData.vessel.name}</p>
                     <p className="text-xs md:text-sm text-gray-600">{journeyData.vessel.container}</p>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                   <div className="p-2 bg-gray-50 rounded">
                     <p className="text-gray-600">Shipping Line</p>
                     <p className="font-medium">{journeyData.vessel.shippingLine.name}</p>
                   </div>
                   <div className="p-2 bg-gray-50 rounded">
                     <p className="text-gray-600">Status</p>
                     <p className="font-medium text-emerald-600">{journeyData.tracking.status}</p>
                   </div>
                 </div>
               </div>
             </div>
           )}

           {/* Journey Progress */}
           {journeyData && (
             <div>
               <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4">Journey Progress</h3>
               
               <div className="relative">
                 <div className="flex items-center mb-4">
                   <div className="w-4 h-4 bg-emerald-500 rounded-full mr-3 relative z-10"></div>
                   <div>
                     <p className="font-medium text-gray-900 text-sm md:text-base">{journeyData.ports.loading.name}</p>
                     <p className="text-xs md:text-sm text-gray-600">Port of Loading</p>
                   </div>
                 </div>
                 
                 {journeyData.routes.traveled && (
                   <div className="ml-7 mb-4 p-3 bg-emerald-50 rounded-lg border-l-4 border-emerald-500">
                     <p className="text-xs md:text-sm font-medium text-emerald-800">Completed Journey</p>
                     <div className="flex justify-between text-xs md:text-sm text-emerald-700 mt-1">
                       <span>{formatDistance(journeyData.routes.traveled.properties?.distance)}</span>
                       <span>{formatDuration(journeyData.routes.traveled.properties?.duration)}</span>
                     </div>
                   </div>
                 )}

                 <div className="flex items-center mb-4">
                   <div className="w-4 h-4 bg-teal-600 rounded-full mr-3 relative z-10 animate-pulse"></div>
                   <div>
                     <p className="font-medium text-gray-900 text-sm md:text-base">Current Position</p>
                     <p className="text-xs md:text-sm text-gray-600">
                       {journeyData.vessel.position.latitude.toFixed(3)}°, {journeyData.vessel.position.longitude.toFixed(3)}°
                     </p>
                   </div>
                 </div>

                 {journeyData.routes.prediction && (
                   <div className="ml-7 mb-4 p-3 bg-teal-50 rounded-lg border-l-4 border-teal-500">
                     <p className="text-xs md:text-sm font-medium text-teal-800">Remaining Journey</p>
                     <div className="flex justify-between text-xs md:text-sm text-teal-700 mt-1">
                       <span>{formatDistance(journeyData.routes.prediction.properties?.distance)}</span>
                       <span>{formatDuration(journeyData.routes.prediction.properties?.duration)}</span>
                     </div>
                   </div>
                 )}

                 <div className="flex items-center">
                   <div className="w-4 h-4 bg-red-500 rounded-full mr-3 relative z-10"></div>
                   <div>
                     <p className="font-medium text-gray-900 text-sm md:text-base">{journeyData.ports.discharge.name}</p>
                     <p className="text-xs md:text-sm text-gray-600">Port of Discharge</p>
                     {journeyData.tracking.arrivalTime && (
                       <p className="text-xs text-gray-500 mt-1">
                         ETA: {new Date(journeyData.tracking.arrivalTime.value).toLocaleDateString()}
                       </p>
                     )}
                   </div>
                 </div>

                 <div className="absolute left-2 top-4 bottom-4 w-0.5 bg-gray-300"></div>
               </div>
             </div>
           )}

           {/* Latest Update */}
           {journeyData?.tracking.lastMovement && (
             <div>
               <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">Latest Update</h3>
               <div className="p-3 bg-gray-50 rounded-lg">
                 <p className="text-xs md:text-sm text-gray-700">{journeyData.tracking.lastMovement}</p>
                 <p className="text-xs text-gray-500 mt-1">
                   {new Date(journeyData.vessel.position.actualSnapTime).toLocaleString()}
                 </p>
               </div>
             </div>
           )}

           {/* Map Legend */}
           <div>
             <h3 className="text-base md:text-lg font-bold text-gray-900 mb-3">Map Legend</h3>
             <div className="space-y-2 text-xs md:text-sm">
               <div className="flex items-center">
                 <div className="w-4 h-1 bg-emerald-500 mr-3"></div>
                 <span>Completed route (searoute-ts)</span>
               </div>
               <div className="flex items-center">
                 <div className="w-4 h-1 bg-teal-600 mr-3"></div>
                 <span>Predicted route (searoute-ts)</span>
               </div>
               <div className="flex items-center">
                 <div className="w-3 h-3 bg-emerald-500 rounded-full mr-3"></div>
                 <span>Origin port</span>
               </div>
               <div className="flex items-center">
                 <div className="w-3 h-3 bg-teal-600 rounded-full mr-3 animate-pulse"></div>
                 <span>Current position</span>
               </div>
               <div className="flex items-center">
                 <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                 <span>Destination port</span>
               </div>
             </div>
           </div>
         </div>
       </div>

       {/* Right Panel - Map - Takes remaining space */}
       <div className="flex-1 bg-white rounded-xl shadow-lg overflow-hidden min-h-[500px] xl:min-h-0">
   {!mapLoaded && (
     <div className="h-full flex items-center justify-center min-h-[500px]">
       <div className="text-center">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
         <p className="text-gray-600">Loading map...</p>
       </div>
     </div>
   )}
          <div 
     id="journey-map" 
     className="w-full h-full min-h-[500px]"
     style={{ display: mapLoaded ? 'block' : 'none' }}
   ></div>
 </div>
</div>
   )}
 </div>

</div>
);
};

export default CompleteVisiwiseTracker;