import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';
import { icon } from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { getMapProperties } from '../api/mapApi.js';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [35.95, -84.0];
const DEFAULT_ZOOM = 13;

const propertyMarkerIcon = icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function toBoundsPayload(bounds) {
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();

  return {
    north: Number(northEast.lat.toFixed(6)),
    south: Number(southWest.lat.toFixed(6)),
    east: Number(northEast.lng.toFixed(6)),
    west: Number(southWest.lng.toFixed(6)),
  };
}

function geolocationErrorMessage(error) {
  if (!error) {
    return null;
  }

  switch (error.code) {
    case 1:
      return 'Location permission was denied. You can continue using the map manually.';
    case 2:
      return 'Location is currently unavailable. Try again when signal improves.';
    case 3:
      return 'Location request timed out. Please try again.';
    default:
      return 'Unable to determine your location right now.';
  }
}

function MapEventBridge({
  followLocation,
  currentPosition,
  onBoundsChange,
  onManualMapInteraction,
}) {
  const map = useMapEvents({
    moveend() {
      onBoundsChange(toBoundsPayload(map.getBounds()));
    },
    dragstart() {
      onManualMapInteraction();
    },
    zoomstart() {
      onManualMapInteraction();
    },
  });

  useEffect(() => {
    onBoundsChange(toBoundsPayload(map.getBounds()));
  }, [map, onBoundsChange]);

  useEffect(() => {
    if (!currentPosition || !followLocation) {
      return;
    }

    map.setView(currentPosition, map.getZoom(), { animate: true });
  }, [map, currentPosition, followLocation]);

  return null;
}

export function MapPage() {
  const [markers, setMarkers] = useState([]);
  const [markersLoading, setMarkersLoading] = useState(true);
  const [markersError, setMarkersError] = useState('');

  const [currentPosition, setCurrentPosition] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(true);
  const [followLocation, setFollowLocation] = useState(true);

  const latestRequestRef = useRef(0);

  const loadMarkers = useCallback(async (bounds) => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    setMarkersLoading(true);
    setMarkersError('');

    try {
      const response = await getMapProperties(bounds);

      if (latestRequestRef.current !== requestId) {
        return;
      }

      setMarkers(Array.isArray(response) ? response : []);
    } catch (error) {
      if (latestRequestRef.current !== requestId) {
        return;
      }

      setMarkersError(error.message || 'Unable to load map properties.');
    } finally {
      if (latestRequestRef.current === requestId) {
        setMarkersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      setFollowLocation(false);
      setLocationError(
        'Geolocation is not supported by this browser. You can still use the map manually.',
      );
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition([
          position.coords.latitude,
          position.coords.longitude,
        ]);
        setLocating(false);
        setLocationError('');
      },
      (error) => {
        setLocating(false);
        setFollowLocation(false);
        setLocationError(
          geolocationErrorMessage(error) ||
            'Unable to determine your location right now.',
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const mapCenter = useMemo(() => {
    return currentPosition ?? DEFAULT_CENTER;
  }, [currentPosition]);

  const handleManualInteraction = useCallback(() => {
    setFollowLocation((previous) => {
      if (!previous) {
        return previous;
      }

      return false;
    });
  }, []);

  return (
    <section className="map-page" aria-label="Map workspace">
      <header className="map-page-header">
        <h2>Map</h2>
        <div className="map-page-controls">
          <span className="map-follow-status" role="status">
            {followLocation
              ? 'Follow mode is on.'
              : 'Follow mode is off after map interaction.'}
          </span>
          <button
            type="button"
            onClick={() => setFollowLocation(true)}
            disabled={!currentPosition || followLocation}
          >
            Follow my location
          </button>
        </div>
      </header>

      <div className="map-feedback" aria-live="polite">
        {markersLoading ? <p>Loading map markers...</p> : null}
        {markersError ? <p role="alert">{markersError}</p> : null}
        {locating ? <p>Detecting current location...</p> : null}
        {locationError ? <p role="alert">{locationError}</p> : null}
      </div>

      <div className="map-canvas" role="region" aria-label="Canvassing map">
        <MapContainer
          center={mapCenter}
          zoom={DEFAULT_ZOOM}
          minZoom={4}
          className="map-container"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapEventBridge
            followLocation={followLocation}
            currentPosition={currentPosition}
            onBoundsChange={loadMarkers}
            onManualMapInteraction={handleManualInteraction}
          />

          {markers.map((marker) => (
            <Marker
              key={marker.propertyId}
              position={[marker.latitude, marker.longitude]}
              icon={propertyMarkerIcon}
            >
              <Popup>Property marker</Popup>
            </Marker>
          ))}

          {currentPosition ? (
            <CircleMarker
              center={currentPosition}
              radius={9}
              pathOptions={{
                color: '#0f2f5f',
                fillColor: '#2a7de1',
                fillOpacity: 0.85,
              }}
            >
              <Popup>Your current location</Popup>
            </CircleMarker>
          ) : null}
        </MapContainer>
      </div>
    </section>
  );
}
