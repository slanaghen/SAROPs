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

  const syncMapData = useCallback(async () => {
    if (!map.current || typeof window.google === 'undefined') return;
    // Placeholder for GeoJSON / Marker sync
  }, [assignments, teams, sartopoId]);

  useEffect(() => {
    if (loading || !mapContainer.current || map.current) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      setMapError(true);
      return;
    }

    const initMap = async () => {
      try {
        const loader = new Loader({
          apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
          version: "weekly"
        });
        const { Map } = await loader.importLibrary("maps");
        map.current = new Map(mapContainer.current, {
          center: { lat: 40.0150, lng: -105.2705 },
          zoom: 13,
          mapTypeId: 'terrain',
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControlOptions: { position: window.google.maps.ControlPosition.TOP_LEFT }
        });

        window.google.maps.event.addListenerOnce(map.current, 'idle', syncMapData);
      } catch (e) {
        setMapError(true);
      }
    };

    initMap();
    return () => { map.current = null; };
  }, [loading, syncMapData]);

  // Trigger resize when layoutMode or split width changes
  useEffect(() => {
    if (map.current && typeof window.google !== 'undefined') {
      window.google.maps.event.trigger(map.current, "resize");
    }
  }, [layoutMode, assignments, teams]);

  if (mapError) {
    return (
      <div className="map-fallback" style={{ 
        height: '100%', width: '100%', 
        aspectRatio: '1 / 1',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#f1f5f9',
        backgroundImage: 'url("https://placehold.co/600x400/e2e8f0/64748b?text=Boulder,+CO+Static+Preview")',
        backgroundSize: 'cover', backgroundPosition: 'center'
      }}>
        <div style={{ 
          background: 'rgba(255,255,255,0.9)', padding: '20px', borderRadius: '8px', 
          textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', maxWidth: '80%'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
          <h4 style={{ margin: '0 0 8px', color: '#1e293b' }}>Interactive Map Unavailable</h4>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Configure a valid <strong>Google Maps API Key</strong> to enable live operations.
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