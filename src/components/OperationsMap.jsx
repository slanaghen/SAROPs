import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

const OperationsMap = ({ 
  loading, 
  assignments, 
  teams, 
  sartopoId,
  layoutMode
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    // Capture Google Maps authentication failures (like InvalidKeyMapError)
    // which are not caught by the loader's internal try/catch.
    const handleAuthFailure = () => {
      setMapError(true);
    };
    window.gm_authFailure = handleAuthFailure;
    return () => {
      if (window.gm_authFailure === handleAuthFailure) window.gm_authFailure = null;
    };
  }, []);

  const syncMapData = useCallback(async () => {
    if (!map.current || typeof window.google === 'undefined') return;
    // Placeholder for GeoJSON / Marker sync
  }, [assignments, teams, sartopoId]);

  useEffect(() => {
    if (loading || !mapContainer.current || map.current || mapError) return;

    let isMounted = true;
    let timeoutId = null;

    // Capture the current element reference to ensure stability 
    // through the asynchronous loading and timeout process.
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      setMapError(true);
      return;
    }

    const initMap = async () => {
      try {
        const el = mapContainer.current;
        const loader = new Loader({
          apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
          version: "weekly"
        });
        const { Map } = await loader.importLibrary("maps");
        
        if (!isMounted || !el || !document.body.contains(el)) return;

        // Defer map initialization to ensure DOM layout is fully stable
        timeoutId = setTimeout(() => {
          try {
            // Final safety checks: Verify element is still in document and has valid dimensions
            // to prevent Google Maps IntersectionObserver crashes.
            if (!isMounted || !el || !document.body.contains(el) || el.clientWidth === 0 || el.clientHeight === 0) return;
            if (map.current) return; // Prevent double initialization

            map.current = new Map(el, {
              center: { lat: 40.0150, lng: -105.2705 },
              zoom: 13,
              mapTypeId: 'terrain',
              fullscreenControl: false,
              streetViewControl: false,
              mapTypeControlOptions: { 
                position: window.google?.maps?.ControlPosition?.TOP_LEFT 
              }
            });
            if (window.google?.maps?.event) {
              window.google.maps.event.addListenerOnce(map.current, 'idle', () => {
                if (isMounted) syncMapData();
              });
            }
          } catch (innerError) {
            if (isMounted) setMapError(true);
          }
        }, 0); // Use setTimeout with 0 delay
      } catch (e) {
        if (isMounted) setMapError(true);
      }
    };

    initMap();
    return () => { 
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, mapError]); // Remove syncMapData from deps to prevent re-init loops

  // Separate effect to handle data synchronization once the map is initialized
  useEffect(() => {
    if (map.current && !loading) {
      syncMapData();
    }
  }, [assignments, teams, sartopoId, loading, syncMapData]);

  // Trigger resize when layoutMode or split width changes
  useEffect(() => {
    if (map.current && window.google?.maps?.event?.trigger) {
      window.google.maps.event.trigger(map.current, "resize");
    }
  }, [layoutMode, assignments, teams]);

  if (mapError) {
    return (
      <div className="map-fallback" style={{ 
        height: '100%', width: '100%', 
        minHeight: '400px', // Prevent collapse in flex layouts
        position: 'relative', // Match the successful wrapper structure
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#f1f5f9',
        //backgroundImage: 'url("https://placehold.co/600x400/e2e8f0/64748b?text=Boulder,+CO+Static+Preview")',
        backgroundImage: 'url("https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/media/images/TNMBoulderCOwithStrctTint_0.png")',
        backgroundSize: 'cover', 
        backgroundPosition: 'center'
      }}>
        <div style={{  
          background: 'rgba(255,255,255,0.9)', 
          padding: '20px', 
          borderRadius: '8px', 
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
          maxWidth: '80%'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
          <h4 style={{ margin: '0 0 8px', color: '#1e293b' }}>Interactive Map Unavailable</h4>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            This is a static preview. To enable the live operations map, please configure a valid <strong>Google Maps API Key</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-wrapper" style={{ position: 'relative', height: '100%' }}>
      <div 
        ref={mapContainer} 
        className="map-container" 
        style={{ height: '100%', width: '100%', background: '#f1f5f9' }} 
      />
    </div>
  );
};

export default OperationsMap;