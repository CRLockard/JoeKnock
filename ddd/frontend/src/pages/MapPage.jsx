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
  resolvePropertyLocation,
} from '../api/propertiesApi.js';
import { getStatuses } from '../api/statusesApi.js';
import {
  getInteractionSnapshot,
  updateInteractionSnapshot,
} from '../api/interactionsApi.js';
import { useAuth } from '../auth/useAuth.js';
import {
  clearInteractionDraft,
  loadInteractionDraft,
  saveInteractionDraft,
} from '../features/interactions/interactionDraftStorage.js';
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

function hasDraftContent(form) {
  return Boolean(
    form.statusId ||
    normalizeOptionalValue(form.contactName) ||
    normalizeOptionalValue(form.contactPhone) ||
    normalizeOptionalValue(form.contactEmail) ||
    normalizeOptionalValue(form.notes),
  );
}

function createClientRequestId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  const randomHex = (length) =>
    Array.from({ length }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');

  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-8${randomHex(3)}-${randomHex(12)}`;
}

function toValidationDetails(error) {
  if (!Array.isArray(error?.details)) {
    return [];
  }

  return error.details.filter(
    (item) =>
      item &&
      typeof item.field === 'string' &&
      typeof item.message === 'string',
  );
}

function toFieldErrorMap(details) {
  const fieldErrors = {};

  for (const detail of details) {
    if (detail.field && !fieldErrors[detail.field]) {
      fieldErrors[detail.field] = detail.message;
    }
  }

  return fieldErrors;
}

function toDraftScope(authUser, propertyId) {
  return {
    userId: authUser?.id,
    organizationId: authUser?.organizationId,
    propertyId,
  };
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
    const firstDetail = toValidationDetails(error)[0]?.message;
    return (
      firstDetail ||
      error.message ||
      'Please check the interaction fields and try again.'
    );
  }

  if (!error.status) {
    return 'Connection failed while submitting your interaction. Your draft is still saved locally. Please check connectivity and retry.';
  }

  if (error.status >= 500) {
    return 'The server could not complete this save right now. Your entered values are still available so you can retry.';
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
  onMapClick,
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
    click(event) {
      onManualMapInteraction();

      if (!event?.latlng) {
        return;
      }

      onMapClick(event.latlng);
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
  const [, setSelectedInteractions] = useState([]);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [statusesError, setStatusesError] = useState('');

  const [panelMode, setPanelMode] = useState('summary');
  const [panelError, setPanelError] = useState('');
  const [panelSuccessMessage, setPanelSuccessMessage] = useState('');

  const [activeSnapshot, setActiveSnapshot] = useState(null);
  const [, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState('');
  const [editableDetailFields, setEditableDetailFields] = useState({
    contactName: false,
    contactPhone: false,
    contactEmail: false,
    notes: false,
  });

  const [createForm, setCreateForm] = useState(() => emptyInteractionForm());
  const [editForm, setEditForm] = useState(() => emptyInteractionForm());
  const [createFieldErrors, setCreateFieldErrors] = useState({});
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [createRequestId, setCreateRequestId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const latestRequestRef = useRef(0);
  const latestBoundsRef = useRef(null);

  const loadMarkers = useCallback(async (bounds) => {
    // Map move/zoom can fire rapidly; track a monotonic request id so stale
    // responses never overwrite newer marker data.
    latestBoundsRef.current = bounds;
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

  const handleStartInteraction = useCallback(
    (propertyId = selectedPropertyId) => {
      const draftScope = toDraftScope(auth.user, propertyId);
      const draft = propertyId ? loadInteractionDraft(draftScope) : null;

      if (draft) {
        setCreateForm({
          statusId: draft.statusId ?? '',
          contactName: draft.contactName ?? '',
          contactPhone: draft.contactPhone ?? '',
          contactEmail: draft.contactEmail ?? '',
          notes: draft.notes ?? '',
        });
        setCreateRequestId(draft.clientRequestId ?? createClientRequestId());
        setPanelSuccessMessage('Restored saved draft for this property.');
      } else {
        setCreateForm(emptyInteractionForm());
        setCreateRequestId(createClientRequestId());
      }

      setCreateFieldErrors({});
      setPanelMode('create');
      setPanelError('');
      setSnapshotError('');
      setActiveSnapshot(null);
      setEditableDetailFields({
        contactName: false,
        contactPhone: false,
        contactEmail: false,
        notes: false,
      });
    },
    [auth.user, selectedPropertyId],
  );

  const loadSnapshotDetails = useCallback(
    async (interactionId) => {
      setPanelError('');
      setPanelSuccessMessage('');
      setSnapshotError('');
      setSnapshotLoading(true);

      try {
        const snapshot = await getInteractionSnapshot(interactionId);
        const draftScope = toDraftScope(auth.user, selectedPropertyId);
        const draft = selectedPropertyId
          ? loadInteractionDraft(draftScope)
          : null;
        const hasMatchingEditDraft =
          draft?.mode === 'edit' &&
          draft?.interactionId === snapshot.interactionId;

        setActiveSnapshot(snapshot);
        setEditForm({
          statusId: hasMatchingEditDraft
            ? (draft.statusId ?? snapshot.statusId ?? '')
            : (snapshot.statusId ?? ''),
          contactName: hasMatchingEditDraft
            ? (draft.contactName ?? '')
            : (snapshot.contactName ?? ''),
          contactPhone: hasMatchingEditDraft
            ? (draft.contactPhone ?? '')
            : (snapshot.contactPhone ?? ''),
          contactEmail: hasMatchingEditDraft
            ? (draft.contactEmail ?? '')
            : (snapshot.contactEmail ?? ''),
          notes: hasMatchingEditDraft
            ? (draft.notes ?? '')
            : (snapshot.notes ?? ''),
        });
        setEditFieldErrors({});
        setEditableDetailFields({
          contactName: false,
          contactPhone: false,
          contactEmail: false,
          notes: false,
        });
        setPanelMode('detail');

        if (hasMatchingEditDraft) {
          setPanelSuccessMessage('Restored saved draft for this property.');
        }
      } catch (error) {
        setSnapshotError(
          formatInteractionError(
            error,
            'Unable to load interaction snapshot details right now.',
          ),
        );
        setPanelMode('create');
        setActiveSnapshot(null);
      } finally {
        setSnapshotLoading(false);
      }
    },
    [auth.user, selectedPropertyId],
  );

  const handleMarkerSelect = useCallback(
    async (propertyId) => {
      setSelectionLoading(true);
      setSelectionError('');
      setSelectedPropertyId(propertyId);
      setPanelError('');
      setPanelSuccessMessage('');
      setSnapshotError('');
      setActiveSnapshot(null);
      setPanelMode('create');
      setCreateForm(emptyInteractionForm());
      setEditForm(emptyInteractionForm());
      setEditableDetailFields({
        contactName: false,
        contactPhone: false,
        contactEmail: false,
        notes: false,
      });

      try {
        const [property, interactionsPayload] = await Promise.all([
          getPropertyById(propertyId),
          getPropertyInteractions(propertyId),
        ]);

        const interactions = interactionsPayload?.interactions ?? [];

        setSelectedProperty(property);
        setSelectedInteractions(interactions);

        if (interactions.length === 0) {
          handleStartInteraction(propertyId);
        } else {
          const targetInteraction = interactions.find(
            (interaction) => interaction.interactionId,
          );

          if (targetInteraction?.interactionId) {
            await loadSnapshotDetails(targetInteraction.interactionId);
          } else {
            setSelectionError(
              'Unable to open current interaction details for this property.',
            );
            handleStartInteraction(propertyId);
          }
        }
      } catch (error) {
        setSelectedProperty(null);
        setSelectedInteractions([]);
        setSelectionError(
          error?.message || 'Unable to load property details right now.',
        );
      } finally {
        setSelectionLoading(false);
      }
    },
    [handleStartInteraction, loadSnapshotDetails],
  );

  const handleMapLocationSelect = useCallback(
    async ({ lat, lng }) => {
      setSelectionError('');

      try {
        // Property resolution is intentionally backend-mediated so geocoding,
        // normalization, and organization scoping stay server-controlled.
        const resolved = await resolvePropertyLocation({
          latitude: lat,
          longitude: lng,
        });

        const propertyId = resolved?.property?.propertyId;

        if (!propertyId) {
          setSelectionError(
            'Unable to resolve that location to a property right now.',
          );
          return;
        }

        await handleMarkerSelect(propertyId);
      } catch (error) {
        setSelectionError(
          error?.message ||
            'Unable to resolve that location to a property right now.',
        );
      }
    },
    [handleMarkerSelect],
  );

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

  useEffect(() => {
    if (panelMode !== 'create' || !selectedPropertyId) {
      return;
    }

    const draftScope = toDraftScope(auth.user, selectedPropertyId);

    if (!hasDraftContent(createForm)) {
      clearInteractionDraft(draftScope);
      return;
    }

    // Drafts are scoped by authenticated user + organization + property to
    // prevent cross-property/cross-user leakage of in-progress form data.
    saveInteractionDraft(draftScope, {
      ...createForm,
      clientRequestId: createRequestId,
      updatedAt: new Date().toISOString(),
    });
  }, [auth.user, createForm, createRequestId, panelMode, selectedPropertyId]);

  const handleSaveCreateDraft = useCallback(() => {
    if (!selectedPropertyId) {
      return;
    }

    const requestId = createRequestId ?? createClientRequestId();

    if (!createRequestId) {
      setCreateRequestId(requestId);
    }

    saveInteractionDraft(toDraftScope(auth.user, selectedPropertyId), {
      ...createForm,
      clientRequestId: requestId,
      mode: 'create',
      updatedAt: new Date().toISOString(),
    });
    setPanelSuccessMessage('Draft saved successfully.');
  }, [auth.user, createForm, createRequestId, selectedPropertyId]);

  const handleSaveExistingDraft = useCallback(() => {
    if (!selectedPropertyId || !activeSnapshot?.interactionId) {
      return;
    }

    saveInteractionDraft(toDraftScope(auth.user, selectedPropertyId), {
      ...editForm,
      mode: 'edit',
      interactionId: activeSnapshot.interactionId,
      updatedAt: new Date().toISOString(),
    });
    setPanelSuccessMessage('Draft saved successfully.');
  }, [activeSnapshot?.interactionId, auth.user, editForm, selectedPropertyId]);

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
      setCreateFieldErrors({});

      const requestId = createRequestId ?? createClientRequestId();

      if (!createRequestId) {
        setCreateRequestId(requestId);
      }

      const payload = {
        statusId: createForm.statusId,
        clientRequestId: requestId,
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
        // clientRequestId supports safe retries without creating duplicate
        // initial snapshots when users submit during transient failures.
        await createPropertyInteraction(selectedPropertyId, payload);

        await refreshCurrentInteractions(selectedPropertyId);

        if (latestBoundsRef.current) {
          await loadMarkers(latestBoundsRef.current);
        }

        clearInteractionDraft(toDraftScope(auth.user, selectedPropertyId));
        setCreateForm(emptyInteractionForm());
        setCreateRequestId(null);
        setActiveSnapshot(null);
        setPanelMode('summary');
        setPanelSuccessMessage('Interaction recorded successfully.');
      } catch (error) {
        const details = toValidationDetails(error);
        setCreateFieldErrors(toFieldErrorMap(details));
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
    [
      auth.user,
      createForm,
      createRequestId,
      loadMarkers,
      refreshCurrentInteractions,
      selectedPropertyId,
    ],
  );

  const enableDetailFieldEdit = useCallback((fieldName) => {
    setEditableDetailFields((current) => ({
      ...current,
      [fieldName]: true,
    }));
  }, []);

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
      setEditFieldErrors({});

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
        setEditForm({
          statusId: updatedSnapshot.statusId ?? '',
          contactName: updatedSnapshot.contactName ?? '',
          contactPhone: updatedSnapshot.contactPhone ?? '',
          contactEmail: updatedSnapshot.contactEmail ?? '',
          notes: updatedSnapshot.notes ?? '',
        });
        setEditableDetailFields({
          contactName: false,
          contactPhone: false,
          contactEmail: false,
          notes: false,
        });
        setPanelMode('detail');
        setPanelSuccessMessage(
          updatedSnapshot.interactionId === activeSnapshot.interactionId
            ? 'No changes to save.'
            : 'Interaction updated successfully.',
        );
      } catch (error) {
        const details = toValidationDetails(error);
        setEditFieldErrors(toFieldErrorMap(details));
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
    setPanelMode('create');
    setPanelError('');
    setPanelSuccessMessage('');
    setSnapshotError('');
    setSnapshotLoading(false);
    setActiveSnapshot(null);
    setCreateForm(emptyInteractionForm());
    setEditForm(emptyInteractionForm());
    setCreateFieldErrors({});
    setEditFieldErrors({});
    setEditableDetailFields({
      contactName: false,
      contactPhone: false,
      contactEmail: false,
      notes: false,
    });
    setCreateRequestId(null);
    setIsCreating(false);
    setIsUpdating(false);
  }, []);

  const canEditCurrentSnapshot = useMemo(() => {
    return canEditInteraction({
      role: auth.user?.role,
      userId: auth.user?.id,
      snapshotOwnerId: activeSnapshot?.userId,
    });
  }, [activeSnapshot?.userId, auth.user?.id, auth.user?.role]);

  return (
    <section className="map-page" aria-label="Map workspace">
      <h2 className="visually-hidden">Map</h2>

      <div className="map-stage">
        <div className="map-stage__feedback" aria-live="polite">
          {markersLoading ? (
            <p className="feedback">Loading map markers...</p>
          ) : null}
          {markersError ? (
            <p role="alert" className="feedback feedback--error">
              {markersError}
            </p>
          ) : null}
          {locating ? (
            <p className="feedback">Detecting current location...</p>
          ) : null}
          {locationError ? (
            <p role="alert" className="feedback feedback--error">
              {locationError}
            </p>
          ) : null}
          {selectionLoading ? (
            <p className="feedback">Loading property details...</p>
          ) : null}
          {selectionError ? (
            <p role="alert" className="feedback feedback--error">
              {selectionError}
            </p>
          ) : null}
          {selectedPropertyId ? (
            <p role="status" className="feedback feedback--success">
              Map selection is locked to the selected property.
            </p>
          ) : null}
          {statusesLoading && selectedPropertyId ? (
            <p className="feedback">Loading statuses...</p>
          ) : null}
          {statusesError ? (
            <p role="alert" className="feedback feedback--error">
              {statusesError}
            </p>
          ) : null}
          {panelError ? (
            <p role="alert" className="feedback feedback--error">
              {panelError}
            </p>
          ) : null}
          {snapshotError ? (
            <p role="alert" className="feedback feedback--error">
              {snapshotError}
            </p>
          ) : null}
          {panelSuccessMessage ? (
            <p role="status" className="feedback feedback--success">
              {panelSuccessMessage}
            </p>
          ) : null}
        </div>

        <div className="map-stage__controls">
          <span className="map-follow-status" role="status">
            {followLocation
              ? 'Follow mode is on.'
              : 'Follow mode is off after map interaction.'}
          </span>
          <button
            type="button"
            className={`map-locate-button ${followLocation ? 'map-locate-button--active' : 'map-locate-button--inactive'}`}
            onClick={() => setFollowLocation(true)}
            disabled={!currentPosition || followLocation}
            aria-label="Recenter to my location"
            title="Recenter to my location"
          >
            <span className="map-locate-button__icon" aria-hidden="true">
              <span className="map-locate-button__crosshair map-locate-button__crosshair--horizontal" />
              <span className="map-locate-button__crosshair map-locate-button__crosshair--vertical" />
              <span className="map-locate-button__dot" />
            </span>
          </button>
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
              onMapClick={handleMapLocationSelect}
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

        {selectedProperty ? (
          <section
            className="map-property-panel map-property-panel--overlay"
            aria-label="Selected property panel"
          >
            <header className="map-property-panel-header">
              <h3>Selected Property</h3>
              <button
                type="button"
                className="button button--ghost"
                onClick={handleCancelSelection}
              >
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
              {panelMode === 'create' ? (
                <form
                  className="map-interaction-form"
                  onSubmit={handleCreateInteraction}
                >
                  <h5>Record Interaction</h5>
                  <div className="map-interaction-form__grid">
                    <label className="form-field form-field--inverse">
                      <span>Status</span>
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
                      {createFieldErrors.statusId ? (
                        <p role="alert">{createFieldErrors.statusId}</p>
                      ) : null}
                    </label>
                    <label className="form-field form-field--inverse">
                      <span>Contact phone</span>
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
                      {createFieldErrors.contactPhone ? (
                        <p role="alert">{createFieldErrors.contactPhone}</p>
                      ) : null}
                    </label>
                    <label className="form-field form-field--inverse">
                      <span>Contact name</span>
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
                      {createFieldErrors.contactName ? (
                        <p role="alert">{createFieldErrors.contactName}</p>
                      ) : null}
                    </label>
                    <label className="form-field form-field--inverse">
                      <span>Contact email</span>
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
                      {createFieldErrors.contactEmail ? (
                        <p role="alert">{createFieldErrors.contactEmail}</p>
                      ) : null}
                    </label>
                  </div>
                  <label className="form-field form-field--inverse">
                    <span>Notes</span>
                    <textarea
                      value={createForm.notes}
                      onChange={(event) => {
                        setCreateForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }));
                      }}
                      disabled={isCreating}
                      rows={4}
                    />
                    {createFieldErrors.notes ? (
                      <p role="alert">{createFieldErrors.notes}</p>
                    ) : null}
                  </label>
                  <div className="map-panel-actions">
                    <button
                      type="submit"
                      className="button button--primary"
                      disabled={isCreating || statusesLoading}
                    >
                      {isCreating
                        ? 'Saving interaction...'
                        : 'Save interaction'}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={handleSaveCreateDraft}
                      disabled={isCreating}
                    >
                      Save draft
                    </button>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={handleCancelSelection}
                      disabled={isCreating}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {panelMode === 'detail' ? (
                <form
                  className="map-interaction-form"
                  onSubmit={handleUpdateInteraction}
                >
                  <h5>Interaction Details</h5>
                  <div className="map-interaction-form__grid">
                    <label className="form-field form-field--inverse">
                      <span>Status</span>
                      <select
                        value={editForm.statusId}
                        onChange={(event) => {
                          setEditForm((current) => ({
                            ...current,
                            statusId: event.target.value,
                          }));
                        }}
                        disabled={
                          isUpdating ||
                          statusesLoading ||
                          !canEditCurrentSnapshot
                        }
                        required
                      >
                        <option value="">Select a status</option>
                        {statuses.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.name}
                          </option>
                        ))}
                      </select>
                      {editFieldErrors.statusId ? (
                        <p role="alert">{editFieldErrors.statusId}</p>
                      ) : null}
                    </label>

                    <label className="form-field form-field--inverse">
                      <span>Contact phone</span>
                      {editableDetailFields.contactPhone ? (
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
                      ) : (
                        <div className="map-detail-field-row">
                          <span className="map-detail-field-value">
                            {editForm.contactPhone || 'Not provided'}
                          </span>
                          {canEditCurrentSnapshot ? (
                            <button
                              type="button"
                              className="button button--ghost map-detail-edit-button"
                              onClick={() =>
                                enableDetailFieldEdit('contactPhone')
                              }
                              disabled={isUpdating}
                            >
                              Edit
                            </button>
                          ) : null}
                        </div>
                      )}
                      {editFieldErrors.contactPhone ? (
                        <p role="alert">{editFieldErrors.contactPhone}</p>
                      ) : null}
                    </label>

                    <label className="form-field form-field--inverse">
                      <span>Contact name</span>
                      {editableDetailFields.contactName ? (
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
                      ) : (
                        <div className="map-detail-field-row">
                          <span className="map-detail-field-value">
                            {editForm.contactName || 'Not provided'}
                          </span>
                          {canEditCurrentSnapshot ? (
                            <button
                              type="button"
                              className="button button--ghost map-detail-edit-button"
                              onClick={() =>
                                enableDetailFieldEdit('contactName')
                              }
                              disabled={isUpdating}
                            >
                              Edit
                            </button>
                          ) : null}
                        </div>
                      )}
                      {editFieldErrors.contactName ? (
                        <p role="alert">{editFieldErrors.contactName}</p>
                      ) : null}
                    </label>

                    <label className="form-field form-field--inverse">
                      <span>Contact email</span>
                      {editableDetailFields.contactEmail ? (
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
                      ) : (
                        <div className="map-detail-field-row">
                          <span className="map-detail-field-value">
                            {editForm.contactEmail || 'Not provided'}
                          </span>
                          {canEditCurrentSnapshot ? (
                            <button
                              type="button"
                              className="button button--ghost map-detail-edit-button"
                              onClick={() =>
                                enableDetailFieldEdit('contactEmail')
                              }
                              disabled={isUpdating}
                            >
                              Edit
                            </button>
                          ) : null}
                        </div>
                      )}
                      {editFieldErrors.contactEmail ? (
                        <p role="alert">{editFieldErrors.contactEmail}</p>
                      ) : null}
                    </label>
                  </div>
                  <label className="form-field form-field--inverse">
                    <span>Notes</span>
                    {editableDetailFields.notes ? (
                      <textarea
                        value={editForm.notes}
                        onChange={(event) => {
                          setEditForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }));
                        }}
                        disabled={isUpdating}
                        rows={4}
                      />
                    ) : (
                      <div className="map-detail-field-row map-detail-field-row--notes">
                        <span className="map-detail-field-value">
                          {editForm.notes || 'No notes recorded.'}
                        </span>
                        {canEditCurrentSnapshot ? (
                          <button
                            type="button"
                            className="button button--ghost map-detail-edit-button"
                            onClick={() => enableDetailFieldEdit('notes')}
                            disabled={isUpdating}
                          >
                            Edit
                          </button>
                        ) : null}
                      </div>
                    )}
                    {editFieldErrors.notes ? (
                      <p role="alert">{editFieldErrors.notes}</p>
                    ) : null}
                  </label>

                  {activeSnapshot ? (
                    <p className="map-property-meta">
                      Last updated {formatDateTime(activeSnapshot.changedAt)}
                    </p>
                  ) : null}

                  <div className="map-panel-actions">
                    {canEditCurrentSnapshot ? (
                      <>
                        <button
                          type="submit"
                          className="button button--primary"
                          disabled={isUpdating || statusesLoading}
                        >
                          {isUpdating
                            ? 'Saving changes...'
                            : 'Save interaction'}
                        </button>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={handleSaveExistingDraft}
                          disabled={isUpdating}
                        >
                          Save draft
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={handleCancelSelection}
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
      </div>
    </section>
  );
}
