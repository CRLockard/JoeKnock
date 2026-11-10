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

function toDraftScope(authUser, propertyId, interactionId) {
  return {
    userId: authUser?.id,
    organizationId: authUser?.organizationId,
    propertyId,
    interactionId,
  };
}

function toDraftReadyKey(authUser, propertyId) {
  return `${authUser?.organizationId}:${authUser?.id}:${propertyId}`;
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

  if (error.status === 409) {
    return 'This interaction was updated by someone else. Your unsaved changes are retained. Reopen the property and review the latest version before saving.';
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

function canEditInteraction({ role, userId, snapshotOwnerId, canEdit }) {
  if (typeof canEdit === 'boolean') return canEdit;
  if (!role || !snapshotOwnerId || !userId) {
    return false;
  }

  if (role === 'admin') {
    return true;
  }

  // Older API responses lack capabilities: managers safely default to own only.
  return (role === 'rep' || role === 'manager') && userId === snapshotOwnerId;
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
  const [selectedInteractions, setSelectedInteractions] = useState([]);
  const [propertyIdCopied, setPropertyIdCopied] = useState(false);
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

  // Autosave/auto-delete of the create draft is only allowed once the draft for
  // this exact org/user/property has been restored into the form.
  const [draftReadyKey, setDraftReadyKey] = useState(null);
  const [draftStorageError, setDraftStorageError] = useState('');
  const [conflictSnapshot, setConflictSnapshot] = useState(null);
  const [refreshRetry, setRefreshRetry] = useState(null);
  const [sameDayConflict, setSameDayConflict] = useState(null);
  const selectionTokenRef = useRef(0);
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

      setDraftReadyKey(
        propertyId ? toDraftReadyKey(auth.user, propertyId) : null,
      );
      setCreateFieldErrors({});
      setSameDayConflict(null);
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
    async (interactionId, propertyId, selectionToken) => {
      setPanelError('');
      setPanelSuccessMessage('');
      setSnapshotError('');
      setSnapshotLoading(true);

      try {
        const snapshot = await getInteractionSnapshot(interactionId);

        if (
          selectionToken !== undefined &&
          selectionTokenRef.current !== selectionToken
        ) {
          return;
        }
        const draft = propertyId
          ? loadInteractionDraft(
              toDraftScope(auth.user, propertyId, snapshot.interactionId),
            )
          : null;
        const hasMatchingEditDraft =
          draft?.mode === 'edit' &&
          draft?.interactionId === snapshot.interactionId;

        setActiveSnapshot(snapshot);
        setDraftReadyKey(toDraftReadyKey(auth.user, propertyId));
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
        if (
          selectionToken !== undefined &&
          selectionTokenRef.current !== selectionToken
        ) {
          return;
        }

        handleStartInteraction(propertyId);
        setSnapshotError(
          formatInteractionError(
            error,
            'Unable to load interaction snapshot details right now.',
          ),
        );
      } finally {
        if (
          selectionToken === undefined ||
          selectionTokenRef.current === selectionToken
        ) {
          setSnapshotLoading(false);
        }
      }
    },
    [auth.user, handleStartInteraction],
  );

  const handleMarkerSelect = useCallback(
    async (propertyId, existingToken) => {
      // A map click claims its token before reverse geocoding starts; marker
      // clicks claim a fresh one here.
      const selectionToken = existingToken ?? (selectionTokenRef.current += 1);
      selectionTokenRef.current = selectionToken;
      setDraftReadyKey(null);
      setDraftStorageError('');
      setConflictSnapshot(null);
      setSameDayConflict(null);
      setSelectionLoading(true);
      setSelectionError('');
      setSelectedPropertyId(propertyId);
      // Drop the previous property's panel so its editable form can never be
      // submitted against the newly selected id while details load.
      setSelectedProperty(null);
      setSelectedInteractions([]);
      setRefreshRetry(null);
      setIsCreating(false);
      setIsUpdating(false);
      setCreateRequestId(null);
      setCreateFieldErrors({});
      setEditFieldErrors({});
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

        if (selectionTokenRef.current !== selectionToken) {
          return;
        }

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
            await loadSnapshotDetails(
              targetInteraction.interactionId,
              propertyId,
              selectionToken,
            );
          } else {
            setSelectionError(
              'Unable to open current interaction details for this property.',
            );
            handleStartInteraction(propertyId);
          }
        }
      } catch (error) {
        if (selectionTokenRef.current !== selectionToken) {
          return;
        }

        setSelectedProperty(null);
        setSelectedInteractions([]);
        setSelectionError(
          error?.message || 'Unable to load property details right now.',
        );
      } finally {
        if (selectionTokenRef.current === selectionToken) {
          setSelectionLoading(false);
        }
      }
    },
    [handleStartInteraction, loadSnapshotDetails],
  );

  const handleMapLocationSelect = useCallback(
    async ({ lat, lng }) => {
      // Identity tracking starts at click time so an older, slower lookup can
      // never replace a newer selection or reopen a cancelled one.
      const selectionToken = (selectionTokenRef.current += 1);
      setSelectionError('');

      try {
        // Property resolution is intentionally backend-mediated so geocoding,
        // normalization, and organization scoping stay server-controlled.
        const resolved = await resolvePropertyLocation({
          latitude: lat,
          longitude: lng,
        });

        if (selectionTokenRef.current !== selectionToken) {
          return;
        }

        const propertyId = resolved?.property?.propertyId;

        if (!propertyId) {
          setSelectionError(
            'Unable to resolve that location to a property right now.',
          );
          return;
        }

        await handleMarkerSelect(propertyId, selectionToken);
      } catch (error) {
        if (selectionTokenRef.current !== selectionToken) {
          return;
        }

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

  const refreshCurrentInteractions = useCallback(
    async (propertyId, selectionToken) => {
      const interactionsPayload = await getPropertyInteractions(propertyId);

      if (selectionTokenRef.current === selectionToken) {
        setSelectedInteractions(interactionsPayload?.interactions ?? []);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      panelMode !== 'create' ||
      !selectedPropertyId ||
      draftReadyKey !== toDraftReadyKey(auth.user, selectedPropertyId)
    ) {
      return;
    }

    const draftScope = toDraftScope(auth.user, selectedPropertyId);

    if (!hasDraftContent(createForm)) {
      clearInteractionDraft(draftScope);
      return;
    }

    // Drafts are scoped by authenticated user + organization + property to
    // prevent cross-property/cross-user leakage of in-progress form data.
    const saved = saveInteractionDraft(draftScope, {
      ...createForm,
      clientRequestId: createRequestId,
      mode: 'create',
      updatedAt: new Date().toISOString(),
    });
    setDraftStorageError(
      saved
        ? ''
        : 'Draft could not be saved on this device. Keep this form open or submit your interaction before leaving.',
    );
  }, [
    auth.user,
    createForm,
    createRequestId,
    draftReadyKey,
    panelMode,
    selectedPropertyId,
  ]);

  useEffect(() => {
    if (
      panelMode !== 'detail' ||
      !activeSnapshot?.interactionId ||
      !selectedPropertyId ||
      draftReadyKey !== toDraftReadyKey(auth.user, selectedPropertyId) ||
      selectedProperty?.propertyId !== selectedPropertyId ||
      isUpdating ||
      !canEditInteraction({
        role: auth.user?.role,
        userId: auth.user?.id,
        snapshotOwnerId: activeSnapshot.userId,
        canEdit: activeSnapshot.canEdit,
      })
    )
      return;
    const fields = [
      'statusId',
      'contactName',
      'contactPhone',
      'contactEmail',
      'notes',
    ];
    const changed = fields.some(
      (field) =>
        normalizeOptionalValue(editForm[field]) !==
        normalizeOptionalValue(activeSnapshot[field]),
    );
    if (!changed) return;
    const saved = saveInteractionDraft(
      toDraftScope(auth.user, selectedPropertyId, activeSnapshot.interactionId),
      {
        ...editForm,
        mode: 'edit',
        interactionId: activeSnapshot.interactionId,
      },
    );
    setDraftStorageError(
      saved
        ? ''
        : 'Draft could not be saved on this device. Keep this form open or submit your interaction before leaving.',
    );
  }, [
    panelMode,
    activeSnapshot,
    selectedPropertyId,
    selectedProperty,
    draftReadyKey,
    auth.user,
    editForm,
    isUpdating,
  ]);

  const handleSaveCreateDraft = useCallback(() => {
    if (!selectedPropertyId) {
      return;
    }

    const requestId = createRequestId ?? createClientRequestId();

    if (!createRequestId) {
      setCreateRequestId(requestId);
    }

    const saved = saveInteractionDraft(
      toDraftScope(auth.user, selectedPropertyId),
      {
        ...createForm,
        clientRequestId: requestId,
        mode: 'create',
        updatedAt: new Date().toISOString(),
      },
    );
    setPanelSuccessMessage(saved ? 'Draft saved successfully.' : '');
    setDraftStorageError(
      saved
        ? ''
        : 'Draft could not be saved on this device. Keep this form open or submit your interaction before leaving.',
    );
  }, [auth.user, createForm, createRequestId, selectedPropertyId]);

  const handleSaveExistingDraft = useCallback(() => {
    if (!selectedPropertyId || !activeSnapshot?.interactionId) {
      return;
    }

    const saved = saveInteractionDraft(
      toDraftScope(auth.user, selectedPropertyId, activeSnapshot.interactionId),
      {
        ...editForm,
        mode: 'edit',
        interactionId: activeSnapshot.interactionId,
        updatedAt: new Date().toISOString(),
      },
    );
    setPanelSuccessMessage(saved ? 'Draft saved successfully.' : '');
    setDraftStorageError(
      saved
        ? ''
        : 'Draft could not be saved on this device. Keep this form open or submit your interaction before leaving.',
    );
  }, [activeSnapshot?.interactionId, auth.user, editForm, selectedPropertyId]);

  const submitCreateInteraction = useCallback(
    async ({ sameDayReturn = false } = {}) => {
      if (
        !selectedPropertyId ||
        selectionLoading ||
        selectedProperty?.propertyId !== selectedPropertyId
      ) {
        return;
      }

      if (!createForm.statusId) {
        setPanelError('Select a status before saving the interaction.');
        return;
      }

      // Bind the request to the selection it was started from.
      const requestPropertyId = selectedPropertyId;
      const requestToken = selectionTokenRef.current;
      const requestUser = auth.user;
      const isCurrent = () => selectionTokenRef.current === requestToken;

      setIsCreating(true);
      setPanelError('');
      setPanelSuccessMessage('');
      setCreateFieldErrors({});
      setSameDayConflict(null);

      const requestId = createRequestId ?? createClientRequestId();

      if (!createRequestId) {
        setCreateRequestId(requestId);
      }

      const payload = {
        statusId: createForm.statusId,
        clientRequestId: requestId,
      };

      if (sameDayReturn) {
        payload.sameDayReturn = true;
      }

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
        await createPropertyInteraction(requestPropertyId, payload);
      } catch (error) {
        if (isCurrent()) {
          if (error?.code === 'SAME_DAY_VISIT_EXISTS') {
            // Nothing was saved; the entered details and draft stay as they
            // are until the rep explicitly confirms the same-day return.
            setSameDayConflict({ propertyId: requestPropertyId });
            setPanelError('');
          } else {
            const details = toValidationDetails(error);
            setCreateFieldErrors(toFieldErrorMap(details));
            setPanelError(
              formatInteractionError(
                error,
                'Unable to save this interaction right now.',
              ),
            );
          }
          setIsCreating(false);
        }

        return;
      }

      // The write is confirmed: the draft belongs to the original property
      // even if the user has since moved on to another one.
      clearInteractionDraft(toDraftScope(requestUser, requestPropertyId));

      if (isCurrent()) {
        setDraftReadyKey(null);
        setCreateForm(emptyInteractionForm());
        setCreateRequestId(null);
        setActiveSnapshot(null);
        setPanelMode('summary');
      }

      try {
        await refreshCurrentInteractions(requestPropertyId, requestToken);

        if (latestBoundsRef.current) {
          await loadMarkers(latestBoundsRef.current);
        }

        if (isCurrent()) {
          setPanelSuccessMessage(
            sameDayReturn
              ? 'Same-day return recorded. No additional knock was added.'
              : 'Interaction recorded successfully.',
          );
        }
      } catch {
        if (isCurrent()) {
          setRefreshRetry({
            propertyId: requestPropertyId,
            token: requestToken,
            message:
              'Your interaction was saved, but the latest property details could not be refreshed.',
          });
        }
      } finally {
        if (isCurrent()) {
          setIsCreating(false);
        }
      }
    },
    [
      auth.user,
      createForm,
      createRequestId,
      loadMarkers,
      refreshCurrentInteractions,
      selectedProperty,
      selectedPropertyId,
      selectionLoading,
    ],
  );

  const handleCreateInteraction = useCallback(
    (event) => {
      event.preventDefault();
      return submitCreateInteraction();
    },
    [submitCreateInteraction],
  );

  const handleConfirmSameDayReturn = useCallback(() => {
    if (sameDayConflict?.propertyId !== selectedPropertyId) {
      return;
    }
    return submitCreateInteraction({ sameDayReturn: true });
  }, [sameDayConflict, selectedPropertyId, submitCreateInteraction]);

  const enableDetailFieldEdit = useCallback((fieldName) => {
    setEditableDetailFields((current) => ({
      ...current,
      [fieldName]: true,
    }));
  }, []);

  const handleUpdateInteraction = useCallback(
    async (event) => {
      event.preventDefault();

      if (
        !activeSnapshot?.interactionId ||
        !selectedPropertyId ||
        selectionLoading ||
        selectedProperty?.propertyId !== selectedPropertyId
      ) {
        return;
      }

      if (!editForm.statusId) {
        setPanelError('Select a status before saving updates.');
        return;
      }

      // Bind the request to the selection and interaction it started from.
      const requestPropertyId = selectedPropertyId;
      const requestInteractionId = activeSnapshot.interactionId;
      const requestToken = selectionTokenRef.current;
      const requestUser = auth.user;
      const isCurrent = () => selectionTokenRef.current === requestToken;

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

      let updatedSnapshot;

      try {
        updatedSnapshot = await updateInteractionSnapshot(
          requestInteractionId,
          payload,
        );
      } catch (error) {
        if (isCurrent()) {
          const details = toValidationDetails(error);
          setEditFieldErrors(toFieldErrorMap(details));
          setPanelError(
            formatInteractionError(
              error,
              'Unable to save interaction updates right now.',
            ),
          );
          setIsUpdating(false);
          if (error.status === 409) {
            try {
              const latest = await getInteractionSnapshot(requestInteractionId);
              if (isCurrent()) setConflictSnapshot(latest);
            } catch {
              /* Keep the entered form intact if latest values cannot load. */
            }
          }
        }

        return;
      }

      // Edit drafts are keyed per interaction; clear both the edited one
      // and the new snapshot so obsolete values never restore.
      clearInteractionDraft(
        toDraftScope(requestUser, requestPropertyId, requestInteractionId),
      );

      if (updatedSnapshot?.interactionId) {
        clearInteractionDraft(
          toDraftScope(
            requestUser,
            requestPropertyId,
            updatedSnapshot.interactionId,
          ),
        );
      }

      if (isCurrent()) {
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
      }

      try {
        await refreshCurrentInteractions(requestPropertyId, requestToken);

        if (isCurrent()) {
          setPanelSuccessMessage(
            updatedSnapshot.interactionId === requestInteractionId
              ? 'No changes to save.'
              : 'Interaction updated successfully.',
          );
        }
      } catch {
        if (isCurrent()) {
          setRefreshRetry({
            propertyId: requestPropertyId,
            token: requestToken,
            message:
              'Your changes were saved, but the latest property details could not be refreshed.',
          });
        }
      } finally {
        if (isCurrent()) {
          setIsUpdating(false);
        }
      }
    },
    [
      activeSnapshot,
      auth.user,
      editForm,
      refreshCurrentInteractions,
      selectedProperty,
      selectedPropertyId,
      selectionLoading,
    ],
  );

  const handleRetryRefresh = useCallback(async () => {
    if (!refreshRetry || selectionTokenRef.current !== refreshRetry.token) {
      return;
    }

    const { propertyId, token } = refreshRetry;

    // Only the read is retried; the confirmed write is never resubmitted.
    try {
      await refreshCurrentInteractions(propertyId, token);

      if (latestBoundsRef.current) {
        await loadMarkers(latestBoundsRef.current);
      }

      if (selectionTokenRef.current === token) {
        setRefreshRetry(null);
        setPanelSuccessMessage('Saved changes and refreshed property details.');
      }
    } catch {
      // The retry control stays available.
    }
  }, [loadMarkers, refreshCurrentInteractions, refreshRetry]);

  const handleOpenVisit = useCallback(
    (interactionId) => {
      if (!selectedPropertyId) return;
      setSameDayConflict(null);
      void loadSnapshotDetails(
        interactionId,
        selectedPropertyId,
        selectionTokenRef.current,
      );
    },
    [loadSnapshotDetails, selectedPropertyId],
  );

  const handleCopyPropertyId = useCallback(async () => {
    if (!selectedProperty?.propertyId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(String(selectedProperty.propertyId));
      setPropertyIdCopied(true);
      setTimeout(() => setPropertyIdCopied(false), 1500);
    } catch {
      setPropertyIdCopied(false);
    }
  }, [selectedProperty]);

  const handleCancelSelection = useCallback(() => {
    // Invalidate in-flight selection responses; stored drafts are kept.
    selectionTokenRef.current += 1;
    setRefreshRetry(null);
    setDraftReadyKey(null);
    setDraftStorageError('');
    setConflictSnapshot(null);
    setSameDayConflict(null);
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
      canEdit: activeSnapshot?.canEdit,
    });
  }, [
    activeSnapshot?.userId,
    activeSnapshot?.canEdit,
    auth.user?.id,
    auth.user?.role,
  ]);

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
          {statusesError && !selectedProperty ? (
            <p role="alert" className="feedback feedback--error">
              {statusesError}
            </p>
          ) : null}
          {panelError && !selectedProperty ? (
            <p role="alert" className="feedback feedback--error">
              {panelError}
            </p>
          ) : null}
          {snapshotError && !selectedProperty ? (
            <p role="alert" className="feedback feedback--error">
              {snapshotError}
            </p>
          ) : null}
          {refreshRetry && !selectedProperty ? (
            <div role="alert" className="feedback feedback--error">
              <span>{refreshRetry.message}</span>{' '}
              <button type="button" onClick={handleRetryRefresh}>
                Retry refresh
              </button>
            </div>
          ) : null}
          {panelSuccessMessage && !selectedProperty ? (
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

        {selectedProperty && !selectionLoading ? (
          <section
            className="map-property-panel map-property-panel--overlay"
            aria-label="Selected property panel"
          >
            <header className="map-property-panel-header">
              <h3>Selected Property</h3>
            </header>
            <p className="map-property-address">
              {selectedProperty.addressLine1}
              {selectedProperty.addressLine2
                ? `, ${selectedProperty.addressLine2}`
                : ''}
              {` - ${selectedProperty.city}, ${selectedProperty.state} ${selectedProperty.postalCode}`}
              <button
                type="button"
                className="map-copy-id-button"
                onClick={handleCopyPropertyId}
                title={propertyIdCopied ? 'Copied!' : 'Copy property ID'}
                aria-label="Copy property ID"
              >
                {propertyIdCopied ? '✓' : '⧉'}
              </button>
            </p>

            <div className="map-property-interactions" aria-live="polite">
              {draftStorageError ? (
                <p role="alert" className="feedback feedback--error">
                  {draftStorageError}
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
              {statusesError ? (
                <p role="alert" className="feedback feedback--error">
                  {statusesError}
                </p>
              ) : null}
              {refreshRetry ? (
                <div role="alert" className="feedback feedback--error">
                  <span>{refreshRetry.message}</span>{' '}
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={handleRetryRefresh}
                  >
                    Retry refresh
                  </button>
                </div>
              ) : null}
              {conflictSnapshot ? (
                <section
                  className="panel"
                  aria-label="Review interaction conflict"
                >
                  <h4>Review the latest saved values</h4>
                  <p>
                    Your entered values remain in the form below. Nothing has
                    been overwritten.
                  </p>
                  <dl>
                    {[
                      'statusName',
                      'contactName',
                      'contactPhone',
                      'contactEmail',
                      'notes',
                    ].map((field) => (
                      <div key={field}>
                        <dt>
                          {
                            {
                              statusName: 'Status',
                              contactName: 'Contact name',
                              contactPhone: 'Phone',
                              contactEmail: 'Email',
                              notes: 'Notes',
                            }[field]
                          }
                        </dt>
                        <dd>{conflictSnapshot[field] || 'Not provided'}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      setActiveSnapshot(conflictSnapshot);
                      setConflictSnapshot(null);
                      setPanelError('');
                      setPanelSuccessMessage(
                        'Latest version reviewed. Your entered values are still in the form; save only the changes you want to keep.',
                      );
                    }}
                  >
                    Keep my entered values for review
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      clearInteractionDraft(
                        toDraftScope(
                          auth.user,
                          selectedPropertyId,
                          activeSnapshot.interactionId,
                        ),
                      );
                      setEditForm(
                        Object.fromEntries(
                          [
                            'statusId',
                            'contactName',
                            'contactPhone',
                            'contactEmail',
                            'notes',
                          ].map((field) => [
                            field,
                            conflictSnapshot[field] ?? '',
                          ]),
                        ),
                      );
                      setActiveSnapshot(conflictSnapshot);
                      setConflictSnapshot(null);
                      setPanelError('');
                    }}
                  >
                    Use latest saved values
                  </button>
                </section>
              ) : null}
              <h4>Current Interaction State</h4>
              {panelMode !== 'create' ? (
                <div className="map-panel-actions">
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => handleStartInteraction(selectedPropertyId)}
                    disabled={isUpdating || isCreating}
                  >
                    Log a visit
                  </button>
                </div>
              ) : null}
              {panelMode !== 'create' && selectedInteractions.length > 1 ? (
                <ul
                  className="map-visit-list"
                  aria-label="Visits to this property"
                >
                  {selectedInteractions.map((visit) => (
                    <li key={visit.interactionId}>
                      <button
                        type="button"
                        className="button button--ghost"
                        aria-current={
                          activeSnapshot?.interactionId === visit.interactionId
                            ? 'true'
                            : undefined
                        }
                        onClick={() => handleOpenVisit(visit.interactionId)}
                        disabled={snapshotLoading}
                      >
                        {`Open visit from ${formatDateTime(visit.initialInteractionAt)}`}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {panelMode === 'summary' && selectedInteractions.length === 1 ? (
                <div className="map-panel-actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() =>
                      handleOpenVisit(selectedInteractions[0].interactionId)
                    }
                    disabled={snapshotLoading}
                  >
                    View latest visit
                  </button>
                </div>
              ) : null}
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
                  {sameDayConflict?.propertyId === selectedPropertyId ? (
                    <div role="alert" className="feedback feedback--error">
                      <p>
                        You already logged a visit to this property today. Your
                        details are kept below.
                      </p>
                      <p>
                        Confirming saves them as a same-day return. It won't add
                        another knock.
                      </p>
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={handleConfirmSameDayReturn}
                        disabled={isCreating}
                      >
                        Confirm same-day return
                      </button>
                    </div>
                  ) : null}
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
                      {activeSnapshot.lastEditedBy
                        ? `Last edited by ${[activeSnapshot.lastEditedBy.firstName, activeSnapshot.lastEditedBy.lastName].filter(Boolean).join(' ')} on ${formatDateTime(activeSnapshot.changedAt)}`
                        : `Last updated ${formatDateTime(activeSnapshot.changedAt)}`}
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
