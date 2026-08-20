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
import {
  createPropertyInteraction,
  getPropertyById,
  getPropertyInteractions,
} from '../api/propertiesApi.js';
import { getStatuses } from '../api/statusesApi.js';
import {
  getInteractionSnapshot,
  updateInteractionSnapshot,
} from '../api/interactionsApi.js';
import { useAuth } from '../auth/useAuth.js';
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

function emptyInteractionForm() {
  return {
    statusId: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    notes: '',
  };
}

function normalizeOptionalValue(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatInteractionError(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  if (error.status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (error.status === 403) {
    return 'You are not authorized to perform that interaction action.';
  }

  if (error.status === 400) {
    return (
      error.message || 'Please check the interaction fields and try again.'
    );
  }

  return error.message || fallbackMessage;
}

function formatDateTime(value) {
  if (!value) {
    return 'Unavailable';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function canEditInteraction({ role, userId, snapshotOwnerId }) {
  if (!role || !snapshotOwnerId || !userId) {
    return false;
  }

  if (role === 'admin' || role === 'manager') {
    return true;
  }

  return role === 'rep' && userId === snapshotOwnerId;
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
  const auth = useAuth();
  const [markers, setMarkers] = useState([]);
  const [markersLoading, setMarkersLoading] = useState(true);
  const [markersError, setMarkersError] = useState('');

  const [currentPosition, setCurrentPosition] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(true);
  const [followLocation, setFollowLocation] = useState(true);

  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedInteractions, setSelectedInteractions] = useState([]);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [statusesError, setStatusesError] = useState('');

  const [panelMode, setPanelMode] = useState('summary');
  const [panelError, setPanelError] = useState('');
  const [panelSuccessMessage, setPanelSuccessMessage] = useState('');

  const [activeSnapshot, setActiveSnapshot] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState('');

  const [createForm, setCreateForm] = useState(() => emptyInteractionForm());
  const [editForm, setEditForm] = useState(() => emptyInteractionForm());
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleMarkerSelect = useCallback(async (propertyId) => {
    setSelectionLoading(true);
    setSelectionError('');
    setSelectedPropertyId(propertyId);
    setPanelError('');
    setPanelSuccessMessage('');
    setSnapshotError('');
    setActiveSnapshot(null);
    setPanelMode('summary');
    setCreateForm(emptyInteractionForm());
    setEditForm(emptyInteractionForm());

    try {
      const [property, interactionsPayload] = await Promise.all([
        getPropertyById(propertyId),
        getPropertyInteractions(propertyId),
      ]);

      setSelectedProperty(property);
      setSelectedInteractions(interactionsPayload?.interactions ?? []);
    } catch (error) {
      setSelectedProperty(null);
      setSelectedInteractions([]);
      setSelectionError(
        error?.message || 'Unable to load property details right now.',
      );
    } finally {
      setSelectionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPropertyId) {
      setStatuses([]);
      setStatusesError('');
      setStatusesLoading(false);
      return;
    }

    let isMounted = true;

    async function loadStatuses() {
      setStatusesError('');
      setStatusesLoading(true);

      try {
        const response = await getStatuses();

        if (!isMounted) {
          return;
        }

        setStatuses(Array.isArray(response) ? response : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatuses([]);
        setStatusesError(error.message || 'Unable to load statuses.');
      } finally {
        if (isMounted) {
          setStatusesLoading(false);
        }
      }
    }

    void loadStatuses();

    return () => {
      isMounted = false;
    };
  }, [selectedPropertyId]);

  const refreshCurrentInteractions = useCallback(async (propertyId) => {
    const interactionsPayload = await getPropertyInteractions(propertyId);
    setSelectedInteractions(interactionsPayload?.interactions ?? []);
  }, []);

  const loadSnapshotDetails = useCallback(async (interactionId) => {
    setPanelError('');
    setPanelSuccessMessage('');
    setSnapshotError('');
    setSnapshotLoading(true);

    try {
      const snapshot = await getInteractionSnapshot(interactionId);
      setActiveSnapshot(snapshot);
      setPanelMode('detail');
    } catch (error) {
      setSnapshotError(
        formatInteractionError(
          error,
          'Unable to load interaction snapshot details right now.',
        ),
      );
      setPanelMode('summary');
      setActiveSnapshot(null);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  const handleStartInteraction = useCallback(() => {
    setPanelMode('create');
    setPanelError('');
    setPanelSuccessMessage('');
    setSnapshotError('');
    setActiveSnapshot(null);
  }, []);

  const handleCreateInteraction = useCallback(
    async (event) => {
      event.preventDefault();

      if (!selectedPropertyId) {
        return;
      }

      if (!createForm.statusId) {
        setPanelError('Select a status before saving the interaction.');
        return;
      }

      setIsCreating(true);
      setPanelError('');
      setPanelSuccessMessage('');

      const payload = {
        statusId: createForm.statusId,
      };

      const contactName = normalizeOptionalValue(createForm.contactName);
      const contactPhone = normalizeOptionalValue(createForm.contactPhone);
      const contactEmail = normalizeOptionalValue(createForm.contactEmail);
      const notes = normalizeOptionalValue(createForm.notes);

      if (contactName !== null) {
        payload.contactName = contactName;
      }

      if (contactPhone !== null) {
        payload.contactPhone = contactPhone;
      }

      if (contactEmail !== null) {
        payload.contactEmail = contactEmail;
      }

      if (notes !== null) {
        payload.notes = notes;
      }

      try {
        const createdSnapshot = await createPropertyInteraction(
          selectedPropertyId,
          payload,
        );

        await refreshCurrentInteractions(selectedPropertyId);
        setActiveSnapshot(createdSnapshot);
        setPanelMode('detail');
        setPanelSuccessMessage('Interaction recorded successfully.');
      } catch (error) {
        setPanelError(
          formatInteractionError(
            error,
            'Unable to save this interaction right now.',
          ),
        );
      } finally {
        setIsCreating(false);
      }
    },
    [createForm, refreshCurrentInteractions, selectedPropertyId],
  );

  const handleStartEdit = useCallback(() => {
    if (!activeSnapshot) {
      return;
    }

    setEditForm({
      statusId: activeSnapshot.statusId ?? '',
      contactName: activeSnapshot.contactName ?? '',
      contactPhone: activeSnapshot.contactPhone ?? '',
      contactEmail: activeSnapshot.contactEmail ?? '',
      notes: activeSnapshot.notes ?? '',
    });
    setPanelError('');
    setPanelSuccessMessage('');
    setPanelMode('edit');
  }, [activeSnapshot]);

  const handleUpdateInteraction = useCallback(
    async (event) => {
      event.preventDefault();

      if (!activeSnapshot?.interactionId) {
        return;
      }

      if (!editForm.statusId) {
        setPanelError('Select a status before saving updates.');
        return;
      }

      setIsUpdating(true);
      setPanelError('');
      setPanelSuccessMessage('');

      const payload = {
        statusId: editForm.statusId,
        contactName: normalizeOptionalValue(editForm.contactName),
        contactPhone: normalizeOptionalValue(editForm.contactPhone),
        contactEmail: normalizeOptionalValue(editForm.contactEmail),
        notes: normalizeOptionalValue(editForm.notes),
      };

      try {
        const updatedSnapshot = await updateInteractionSnapshot(
          activeSnapshot.interactionId,
          payload,
        );

        if (selectedPropertyId) {
          await refreshCurrentInteractions(selectedPropertyId);
        }

        setActiveSnapshot(updatedSnapshot);
        setPanelMode('detail');
        setPanelSuccessMessage('Interaction updated successfully.');
      } catch (error) {
        setPanelError(
          formatInteractionError(
            error,
            'Unable to save interaction updates right now.',
          ),
        );
      } finally {
        setIsUpdating(false);
      }
    },
    [activeSnapshot, editForm, refreshCurrentInteractions, selectedPropertyId],
  );

  const handleCancelSelection = useCallback(() => {
    setSelectedPropertyId(null);
    setSelectedProperty(null);
    setSelectedInteractions([]);
    setSelectionError('');
    setSelectionLoading(false);
    setStatuses([]);
    setStatusesError('');
    setStatusesLoading(false);
    setPanelMode('summary');
    setPanelError('');
    setPanelSuccessMessage('');
    setSnapshotError('');
    setSnapshotLoading(false);
    setActiveSnapshot(null);
    setCreateForm(emptyInteractionForm());
    setEditForm(emptyInteractionForm());
    setIsCreating(false);
    setIsUpdating(false);
  }, []);

  const hasOwnCurrentInteraction = useMemo(() => {
    if (!auth.user?.id) {
      return false;
    }

    return selectedInteractions.some(
      (interaction) => interaction.userId === auth.user.id,
    );
  }, [auth.user?.id, selectedInteractions]);

  const canEditCurrentSnapshot = useMemo(() => {
    return canEditInteraction({
      role: auth.user?.role,
      userId: auth.user?.id,
      snapshotOwnerId: activeSnapshot?.userId,
    });
  }, [activeSnapshot?.userId, auth.user?.id, auth.user?.role]);

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
        {selectionLoading ? <p>Loading property details...</p> : null}
        {selectionError ? <p role="alert">{selectionError}</p> : null}
        {selectedPropertyId ? (
          <p role="status">Map selection is locked to the selected property.</p>
        ) : null}
        {statusesLoading && selectedPropertyId ? (
          <p>Loading statuses...</p>
        ) : null}
        {statusesError ? <p role="alert">{statusesError}</p> : null}
        {panelError ? <p role="alert">{panelError}</p> : null}
        {snapshotError ? <p role="alert">{snapshotError}</p> : null}
        {panelSuccessMessage ? (
          <p role="status">{panelSuccessMessage}</p>
        ) : null}
      </div>

      {selectedProperty ? (
        <section
          className="map-property-panel"
          aria-label="Selected property panel"
        >
          <header className="map-property-panel-header">
            <h3>Selected Property</h3>
            <button type="button" onClick={handleCancelSelection}>
              Cancel
            </button>
          </header>
          <p className="map-property-address">
            {selectedProperty.addressLine1}
            {selectedProperty.addressLine2
              ? `, ${selectedProperty.addressLine2}`
              : ''}
            {` - ${selectedProperty.city}, ${selectedProperty.state} ${selectedProperty.postalCode}`}
          </p>
          <p className="map-property-meta">
            Property ID: {selectedProperty.propertyId}
          </p>

          <div className="map-property-interactions" aria-live="polite">
            <h4>Current Interaction State</h4>
            {panelMode === 'summary' ? (
              <>
                {selectedInteractions.length === 0 ? (
                  <p>No current interactions are visible for this property.</p>
                ) : (
                  <ul>
                    {selectedInteractions.map((interaction) => {
                      const key =
                        interaction.interactionId ||
                        interaction.interactionGroupId;

                      return (
                        <li key={key} className="map-interaction-summary-item">
                          <div>
                            <strong>{interaction.statusName}</strong>
                            {interaction.notes ? ` - ${interaction.notes}` : ''}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!interaction.interactionId) {
                                setSnapshotError(
                                  'Snapshot details are unavailable for this interaction.',
                                );
                                return;
                              }

                              void loadSnapshotDetails(
                                interaction.interactionId,
                              );
                            }}
                            disabled={snapshotLoading}
                          >
                            View snapshot
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="map-panel-actions">
                  <button
                    type="button"
                    onClick={handleStartInteraction}
                    disabled={
                      isCreating || isUpdating || hasOwnCurrentInteraction
                    }
                  >
                    Start interaction
                  </button>
                  {hasOwnCurrentInteraction ? (
                    <p>
                      You already have a current interaction for this property.
                      Open it from the list above to edit.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {panelMode === 'create' ? (
              <form
                className="map-interaction-form"
                onSubmit={handleCreateInteraction}
              >
                <h5>Record Interaction</h5>
                <label>
                  Status
                  <select
                    value={createForm.statusId}
                    onChange={(event) => {
                      setCreateForm((current) => ({
                        ...current,
                        statusId: event.target.value,
                      }));
                    }}
                    disabled={isCreating || statusesLoading}
                    required
                  >
                    <option value="">Select a status</option>
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Contact name
                  <input
                    type="text"
                    value={createForm.contactName}
                    maxLength={255}
                    onChange={(event) => {
                      setCreateForm((current) => ({
                        ...current,
                        contactName: event.target.value,
                      }));
                    }}
                    disabled={isCreating}
                  />
                </label>
                <label>
                  Contact phone
                  <input
                    type="text"
                    value={createForm.contactPhone}
                    maxLength={50}
                    onChange={(event) => {
                      setCreateForm((current) => ({
                        ...current,
                        contactPhone: event.target.value,
                      }));
                    }}
                    disabled={isCreating}
                  />
                </label>
                <label>
                  Contact email
                  <input
                    type="email"
                    value={createForm.contactEmail}
                    maxLength={255}
                    onChange={(event) => {
                      setCreateForm((current) => ({
                        ...current,
                        contactEmail: event.target.value,
                      }));
                    }}
                    disabled={isCreating}
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    value={createForm.notes}
                    onChange={(event) => {
                      setCreateForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }));
                    }}
                    disabled={isCreating}
                    rows={3}
                  />
                </label>
                <div className="map-panel-actions">
                  <button
                    type="submit"
                    disabled={isCreating || statusesLoading}
                  >
                    {isCreating ? 'Saving interaction...' : 'Save interaction'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPanelMode('summary');
                      setPanelError('');
                    }}
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {panelMode === 'detail' ? (
              <div className="map-interaction-detail" aria-live="polite">
                <h5>Interaction Snapshot</h5>
                {snapshotLoading ? (
                  <p>Loading interaction snapshot...</p>
                ) : null}
                {activeSnapshot ? (
                  <>
                    <p>
                      <strong>Status:</strong> {activeSnapshot.statusName}
                    </p>
                    <p>
                      <strong>Representative:</strong>{' '}
                      {activeSnapshot.representative?.firstName}{' '}
                      {activeSnapshot.representative?.lastName}
                      {activeSnapshot.representative?.email
                        ? ` (${activeSnapshot.representative.email})`
                        : ''}
                    </p>
                    <p>
                      <strong>Property:</strong> {selectedProperty.addressLine1}
                      {selectedProperty.addressLine2
                        ? `, ${selectedProperty.addressLine2}`
                        : ''}
                      {` - ${selectedProperty.city}, ${selectedProperty.state} ${selectedProperty.postalCode}`}
                    </p>
                    <p>
                      <strong>First Knock:</strong>{' '}
                      {formatDateTime(activeSnapshot.initialInteractionAt)}
                    </p>
                    <p>
                      <strong>Last Updated:</strong>{' '}
                      {formatDateTime(activeSnapshot.changedAt)}
                    </p>
                    {activeSnapshot.contactName ? (
                      <p>
                        <strong>Contact Name:</strong>{' '}
                        {activeSnapshot.contactName}
                      </p>
                    ) : null}
                    {activeSnapshot.contactPhone ? (
                      <p>
                        <strong>Contact Phone:</strong>{' '}
                        {activeSnapshot.contactPhone}
                      </p>
                    ) : null}
                    {activeSnapshot.contactEmail ? (
                      <p>
                        <strong>Contact Email:</strong>{' '}
                        {activeSnapshot.contactEmail}
                      </p>
                    ) : null}
                    {activeSnapshot.notes ? (
                      <p>
                        <strong>Notes:</strong> {activeSnapshot.notes}
                      </p>
                    ) : null}
                  </>
                ) : null}
                <div className="map-panel-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setPanelMode('summary');
                      setSnapshotError('');
                    }}
                  >
                    Back to property
                  </button>
                  {canEditCurrentSnapshot ? (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      disabled={!activeSnapshot || statusesLoading}
                    >
                      Edit interaction
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {panelMode === 'edit' ? (
              <form
                className="map-interaction-form"
                onSubmit={handleUpdateInteraction}
              >
                <h5>Edit Interaction Snapshot</h5>
                <label>
                  Status
                  <select
                    value={editForm.statusId}
                    onChange={(event) => {
                      setEditForm((current) => ({
                        ...current,
                        statusId: event.target.value,
                      }));
                    }}
                    disabled={isUpdating || statusesLoading}
                    required
                  >
                    <option value="">Select a status</option>
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Contact name
                  <input
                    type="text"
                    value={editForm.contactName}
                    maxLength={255}
                    onChange={(event) => {
                      setEditForm((current) => ({
                        ...current,
                        contactName: event.target.value,
                      }));
                    }}
                    disabled={isUpdating}
                  />
                </label>
                <label>
                  Contact phone
                  <input
                    type="text"
                    value={editForm.contactPhone}
                    maxLength={50}
                    onChange={(event) => {
                      setEditForm((current) => ({
                        ...current,
                        contactPhone: event.target.value,
                      }));
                    }}
                    disabled={isUpdating}
                  />
                </label>
                <label>
                  Contact email
                  <input
                    type="email"
                    value={editForm.contactEmail}
                    maxLength={255}
                    onChange={(event) => {
                      setEditForm((current) => ({
                        ...current,
                        contactEmail: event.target.value,
                      }));
                    }}
                    disabled={isUpdating}
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    value={editForm.notes}
                    onChange={(event) => {
                      setEditForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }));
                    }}
                    disabled={isUpdating}
                    rows={3}
                  />
                </label>
                <div className="map-panel-actions">
                  <button
                    type="submit"
                    disabled={isUpdating || statusesLoading}
                  >
                    {isUpdating ? 'Saving changes...' : 'Save as new snapshot'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPanelMode('detail');
                      setPanelError('');
                    }}
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </section>
      ) : null}

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
              eventHandlers={{
                click: () => {
                  void handleMarkerSelect(marker.propertyId);
                },
              }}
            >
              <Popup>
                {selectedPropertyId === marker.propertyId
                  ? 'Selected property marker'
                  : 'Property marker'}
              </Popup>
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
