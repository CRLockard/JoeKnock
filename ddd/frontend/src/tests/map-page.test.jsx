import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapPage } from '../pages/MapPage.jsx';
import { getMapProperties } from '../api/mapApi.js';
import {
  createPropertyInteraction,
  getPropertyById,
  getPropertyInteractions,
  resolvePropertyLocation,
} from '../api/propertiesApi.js';
import { getStatuses } from '../api/statusesApi.js';
import {
  loadInteractionDraft,
  saveInteractionDraft,
} from '../features/interactions/interactionDraftStorage.js';
import {
  getInteractionSnapshot,
  updateInteractionSnapshot,
} from '../api/interactionsApi.js';

vi.mock('../api/mapApi.js', () => ({
  getMapProperties: vi.fn(),
}));

vi.mock('../api/propertiesApi.js', () => ({
  createPropertyInteraction: vi.fn(),
  getPropertyById: vi.fn(),
  getPropertyInteractions: vi.fn(),
  resolvePropertyLocation: vi.fn(),
}));

vi.mock('../api/statusesApi.js', () => ({
  getStatuses: vi.fn(),
}));

vi.mock('../api/interactionsApi.js', () => ({
  getInteractionSnapshot: vi.fn(),
  updateInteractionSnapshot: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    role: 'rep',
  },
}));

vi.mock('../auth/useAuth.js', () => ({
  useAuth: () => authState,
}));

const mockState = vi.hoisted(() => ({
  setViewMock: vi.fn(),
  latestMapHandlers: null,
}));

vi.mock('react-leaflet', async () => {
  const React = await import('react');

  function createBounds() {
    return {
      getNorthEast() {
        return { lat: 36, lng: -83 };
      },
      getSouthWest() {
        return { lat: 35, lng: -85 };
      },
    };
  }

  const map = {
    getBounds: vi.fn(createBounds),
    getZoom: vi.fn(() => 13),
    setView: mockState.setViewMock,
  };

  return {
    MapContainer: ({ children, className }) => (
      <div data-testid="map-container" className={className}>
        {children}
      </div>
    ),
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({ children, eventHandlers }) => (
      <button
        type="button"
        data-testid="property-marker"
        onClick={() => eventHandlers?.click?.()}
      >
        {children}
      </button>
    ),
    Popup: ({ children }) => <div>{children}</div>,
    CircleMarker: ({ children }) => (
      <div data-testid="current-location-marker">{children}</div>
    ),
    useMapEvents: (handlers) => {
      mockState.latestMapHandlers = handlers;
      return map;
    },
  };
});

function mockGeolocationSuccess() {
  const clearWatch = vi.fn();
  let successCallback;

  const watchPosition = vi.fn((success) => {
    successCallback = success;
    success({ coords: { latitude: 35.9, longitude: -84.0 } });
    return 42;
  });

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition,
      clearWatch,
    },
  });

  return {
    watchPosition,
    clearWatch,
    pushUpdate(coords) {
      successCallback?.({ coords });
    },
  };
}

function mockGeolocationDenied() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition(success, error) {
        error({ code: 1 });
        return 7;
      },
      clearWatch: vi.fn(),
    },
  });
}

async function selectFirstPropertyMarker() {
  const marker = await screen.findByTestId('property-marker');

  await act(async () => {
    marker.click();
  });
}

async function selectPropertyMarkerByIndex(index) {
  const markers = await screen.findAllByTestId('property-marker');

  await act(async () => {
    markers[index].click();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.latestMapHandlers = null;
  mockState.setViewMock.mockReset();

  authState.user = {
    id: 'user-1',
    role: 'rep',
    organizationId: 'org-1',
  };

  localStorage.clear();

  getMapProperties.mockResolvedValue([
    { propertyId: 'property-1', latitude: 35.51, longitude: -84.11 },
  ]);

  getPropertyById.mockResolvedValue({
    propertyId: 'property-1',
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Knoxville',
    state: 'TN',
    postalCode: '37901',
    country: 'US',
    latitude: 35.51,
    longitude: -84.11,
  });

  resolvePropertyLocation.mockResolvedValue({
    created: false,
    property: {
      propertyId: 'property-1',
      addressLine1: '123 Main St',
      addressLine2: null,
      city: 'Knoxville',
      state: 'TN',
      postalCode: '37901',
      country: 'US',
      latitude: 35.51,
      longitude: -84.11,
    },
  });

  getPropertyInteractions.mockResolvedValue({
    propertyId: 'property-1',
    interactions: [
      {
        interactionId: 'interaction-1',
        interactionGroupId: 'group-1',
        userId: 'user-1',
        statusName: 'Interested',
        notes: 'Wants a follow-up call.',
      },
    ],
  });

  getStatuses.mockResolvedValue([
    { id: 'status-1', name: 'No Answer' },
    { id: 'status-2', name: 'Interested' },
  ]);

  createPropertyInteraction.mockResolvedValue({
    interactionId: 'interaction-new',
    interactionGroupId: 'group-new',
    propertyId: 'property-1',
    userId: 'user-1',
    statusId: 'status-2',
    statusName: 'Interested',
    initialInteractionAt: '2026-08-19T15:30:00.000Z',
    changedAt: '2026-08-19T15:30:00.000Z',
    contactName: 'Taylor Homeowner',
    contactPhone: '555-555-0100',
    contactEmail: 'taylor@example.com',
    notes: 'Homeowner asked for Friday follow-up.',
    representative: {
      firstName: 'Alex',
      lastName: 'Rep',
      email: 'alex@example.com',
    },
  });

  getInteractionSnapshot.mockResolvedValue({
    interactionId: 'interaction-1',
    interactionGroupId: 'group-1',
    propertyId: 'property-1',
    userId: 'user-1',
    statusId: 'status-2',
    statusName: 'Interested',
    initialInteractionAt: '2026-08-19T15:00:00.000Z',
    changedAt: '2026-08-19T15:45:00.000Z',
    contactName: 'Jamie Homeowner',
    contactPhone: '555-555-5555',
    contactEmail: 'jamie@example.com',
    notes: 'Call after 5pm.',
    representative: {
      firstName: 'Alex',
      lastName: 'Rep',
      email: 'alex@example.com',
    },
  });

  updateInteractionSnapshot.mockResolvedValue({
    interactionId: 'interaction-2',
    interactionGroupId: 'group-1',
    propertyId: 'property-1',
    userId: 'user-1',
    statusId: 'status-1',
    statusName: 'No Answer',
    initialInteractionAt: '2026-08-19T15:00:00.000Z',
    changedAt: '2026-08-20T11:00:00.000Z',
    contactName: 'Jamie Homeowner',
    contactPhone: null,
    contactEmail: null,
    notes: 'No answer on return visit.',
    representative: {
      firstName: 'Alex',
      lastName: 'Rep',
      email: 'alex@example.com',
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MapPage', () => {
  it('loads property markers for current bounds and renders map marker data', async () => {
    mockGeolocationSuccess();
    getMapProperties.mockResolvedValue([
      { propertyId: 'property-1', latitude: 35.51, longitude: -84.11 },
      { propertyId: 'property-2', latitude: 35.52, longitude: -84.12 },
    ]);

    render(<MapPage />);

    await waitFor(() => {
      expect(getMapProperties).toHaveBeenCalledWith({
        north: 36,
        south: 35,
        east: -83,
        west: -85,
      });
    });

    expect(await screen.findAllByTestId('property-marker')).toHaveLength(2);
    expect(screen.getByTestId('current-location-marker')).toBeInTheDocument();
  });

  it('handles denied geolocation permission gracefully', async () => {
    mockGeolocationDenied();

    render(<MapPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Location permission was denied. You can continue using the map manually.',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Follow mode is off');
  });

  it('disables follow mode on map interaction and stops recentering on subsequent updates', async () => {
    const geo = mockGeolocationSuccess();

    render(<MapPage />);

    await waitFor(() => {
      expect(mockState.setViewMock).toHaveBeenCalled();
    });

    const setViewCallsBeforeInteraction =
      mockState.setViewMock.mock.calls.length;

    await act(async () => {
      mockState.latestMapHandlers.dragstart();
    });

    expect(screen.getByRole('status')).toHaveTextContent('Follow mode is off');

    await act(async () => {
      geo.pushUpdate({ latitude: 35.91, longitude: -84.02 });
    });

    expect(mockState.setViewMock.mock.calls.length).toBe(
      setViewCallsBeforeInteraction,
    );
  });

  it('opens selected property panel when a map property marker is chosen', async () => {
    mockGeolocationSuccess();

    render(<MapPage />);

    await selectFirstPropertyMarker();

    expect(
      screen.getByRole('heading', { name: 'Selected Property' }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText(/123 Main St/)).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole('heading', { name: 'Interaction Details' }),
    ).toBeInTheDocument();
  });

  it('starts property interaction workflow when selecting a supported map location', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions.mockResolvedValueOnce({
      propertyId: 'property-1',
      interactions: [],
    });

    render(<MapPage />);

    await act(async () => {
      mockState.latestMapHandlers.click({
        latlng: { lat: 35.51, lng: -84.11 },
      });
    });

    await waitFor(() => {
      expect(resolvePropertyLocation).toHaveBeenCalledWith({
        latitude: 35.51,
        longitude: -84.11,
      });
    });

    expect(
      await screen.findByRole('heading', { name: 'Record Interaction' }),
    ).toBeInTheDocument();
  });

  it('renders interaction-entry fields immediately for a selected property with no visible interaction', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions.mockResolvedValueOnce({
      propertyId: 'property-1',
      interactions: [],
    });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    expect(
      screen.getByRole('heading', { name: 'Record Interaction' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact name')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact phone')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact email')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('submits a new interaction and returns to selected-property summary while keeping map context', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions
      .mockResolvedValueOnce({
        propertyId: 'property-1',
        interactions: [],
      })
      .mockResolvedValueOnce({
        propertyId: 'property-1',
        interactions: [
          {
            interactionId: 'interaction-new',
            interactionGroupId: 'group-new',
            userId: 'user-1',
            statusName: 'Interested',
            notes: 'Homeowner asked for Friday follow-up.',
          },
        ],
      });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });
    fireEvent.change(screen.getByLabelText('Contact name'), {
      target: { value: 'Taylor Homeowner' },
    });
    fireEvent.change(screen.getByLabelText('Contact phone'), {
      target: { value: '555-555-0100' },
    });
    fireEvent.change(screen.getByLabelText('Contact email'), {
      target: { value: 'taylor@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Homeowner asked for Friday follow-up.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    await waitFor(() => {
      expect(createPropertyInteraction).toHaveBeenCalledWith('property-1', {
        clientRequestId: expect.any(String),
        statusId: 'status-2',
        contactName: 'Taylor Homeowner',
        contactPhone: '555-555-0100',
        contactEmail: 'taylor@example.com',
        notes: 'Homeowner asked for Friday follow-up.',
      });
    });

    expect(
      await screen.findByText('Interaction recorded successfully.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Selected Property' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Record Interaction' }),
    ).not.toBeInTheDocument();
    expect(getPropertyInteractions).toHaveBeenCalledTimes(2);
    expect(getMapProperties).toHaveBeenCalledTimes(2);
  });

  it('prevents duplicate submit while interaction create is in progress', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions.mockResolvedValueOnce({
      propertyId: 'property-1',
      interactions: [],
    });

    let resolveCreate;
    createPropertyInteraction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<MapPage />);

    await selectFirstPropertyMarker();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Saving interaction...' }),
      ).toBeDisabled();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Saving interaction...' }),
    );

    expect(createPropertyInteraction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate({
        interactionId: 'interaction-new',
        interactionGroupId: 'group-new',
        propertyId: 'property-1',
        userId: 'user-1',
        statusId: 'status-2',
        statusName: 'Interested',
        initialInteractionAt: '2026-08-19T15:30:00.000Z',
        changedAt: '2026-08-19T15:30:00.000Z',
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        notes: null,
        representative: {
          firstName: 'Alex',
          lastName: 'Rep',
          email: 'alex@example.com',
        },
      });
    });
  });

  it('shows interaction create errors and preserves entered values', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions.mockResolvedValueOnce({
      propertyId: 'property-1',
      interactions: [],
    });

    createPropertyInteraction.mockRejectedValueOnce({
      status: 400,
      message: 'statusId must reference an active status in this organization.',
    });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Attempted note content.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    expect(
      await screen.findByText(
        'statusId must reference an active status in this organization.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue(
      'Attempted note content.',
    );
  });

  it('opens existing interaction details directly for selected properties with visible current interaction', async () => {
    mockGeolocationSuccess();

    render(<MapPage />);

    await selectFirstPropertyMarker();

    await waitFor(() => {
      expect(getInteractionSnapshot).toHaveBeenCalledWith('interaction-1');
    });

    expect(
      await screen.findByRole('heading', { name: 'Interaction Details' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start interaction' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'View snapshot' })).toBeNull();
  });

  it('allows authorized edit and treats response as a new snapshot', async () => {
    mockGeolocationSuccess();

    getPropertyInteractions
      .mockResolvedValueOnce({
        propertyId: 'property-1',
        interactions: [
          {
            interactionId: 'interaction-1',
            interactionGroupId: 'group-1',
            userId: 'user-1',
            statusName: 'Interested',
            notes: 'Wants a follow-up call.',
          },
        ],
      })
      .mockResolvedValueOnce({
        propertyId: 'property-1',
        interactions: [
          {
            interactionId: 'interaction-2',
            interactionGroupId: 'group-1',
            userId: 'user-1',
            statusName: 'No Answer',
            notes: 'No answer on return visit.',
          },
        ],
      });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    await screen.findByRole('heading', { name: 'Interaction Details' });

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-1' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Notes\s+Call after 5pm\./i }),
    );
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'No answer on return visit.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    await waitFor(() => {
      expect(updateInteractionSnapshot).toHaveBeenCalledWith('interaction-1', {
        statusId: 'status-1',
        contactName: 'Jamie Homeowner',
        contactPhone: '555-555-5555',
        contactEmail: 'jamie@example.com',
        notes: 'No answer on return visit.',
      });
    });

    expect(
      await screen.findByText('Interaction updated successfully.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveValue('status-1');
  });

  it('handles 403 response when saving an existing interaction update', async () => {
    mockGeolocationSuccess();

    updateInteractionSnapshot.mockRejectedValueOnce({
      status: 403,
      message: 'You do not have permission to perform this action.',
    });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    await screen.findByRole('heading', { name: 'Interaction Details' });

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    expect(
      await screen.findByText(
        'You are not authorized to perform that interaction action.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Interaction Details' }),
    ).toBeInTheDocument();
  });

  it('supports cancel/back behavior in interaction flows and keeps property selected', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions.mockResolvedValueOnce({
      propertyId: 'property-1',
      interactions: [],
    });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      screen.queryByRole('heading', { name: 'Selected Property' }),
    ).toBeNull();
    expect(createPropertyInteraction).not.toHaveBeenCalled();
  });

  it('restores a saved create draft when form is reopened for the same property', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions
      .mockResolvedValueOnce({
        propertyId: 'property-1',
        interactions: [],
      })
      .mockResolvedValueOnce({
        propertyId: 'property-1',
        interactions: [],
      });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });
    fireEvent.change(screen.getByLabelText('Contact name'), {
      target: { value: 'Saved Name' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Saved note text.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await selectFirstPropertyMarker();

    expect(screen.getByLabelText('Status')).toHaveValue('status-2');
    expect(screen.getByLabelText('Contact name')).toHaveValue('Saved Name');
    expect(screen.getByLabelText('Notes')).toHaveValue('Saved note text.');
  });

  it('isolates drafts between properties', async () => {
    mockGeolocationSuccess();

    getMapProperties.mockResolvedValue([
      { propertyId: 'property-1', latitude: 35.51, longitude: -84.11 },
      { propertyId: 'property-2', latitude: 35.52, longitude: -84.12 },
    ]);

    getPropertyById.mockImplementation(async (propertyId) => {
      if (propertyId === 'property-2') {
        return {
          propertyId: 'property-2',
          addressLine1: '900 Elm St',
          addressLine2: null,
          city: 'Knoxville',
          state: 'TN',
          postalCode: '37902',
          country: 'US',
          latitude: 35.52,
          longitude: -84.12,
        };
      }

      return {
        propertyId: 'property-1',
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Knoxville',
        state: 'TN',
        postalCode: '37901',
        country: 'US',
        latitude: 35.51,
        longitude: -84.11,
      };
    });

    getPropertyInteractions.mockResolvedValue({
      propertyId: 'property-1',
      interactions: [],
    });

    render(<MapPage />);

    await selectPropertyMarkerByIndex(0);
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Draft for property one.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await selectPropertyMarkerByIndex(1);

    expect(screen.getByLabelText('Notes')).toHaveValue('');
  });

  it('shows field-level validation feedback and keeps local draft for correction', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions
      .mockResolvedValueOnce({
        propertyId: 'property-1',
        interactions: [],
      })
      .mockResolvedValueOnce({
        propertyId: 'property-1',
        interactions: [],
      });

    createPropertyInteraction.mockRejectedValueOnce({
      status: 400,
      message: 'Invalid request data.',
      details: [
        {
          field: 'contactPhone',
          message: 'contactPhone must be at most 50 characters.',
        },
      ],
    });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });
    fireEvent.change(screen.getByLabelText('Contact phone'), {
      target: {
        value: '555-555-010012345678901234567890123456789012345678901',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    const validationMessages = await screen.findAllByText(
      'contactPhone must be at most 50 characters.',
    );
    expect(validationMessages.length).toBeGreaterThan(0);
    expect(
      screen.getByDisplayValue(
        '555-555-010012345678901234567890123456789012345678901',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await selectFirstPropertyMarker();
    expect(
      screen.getByDisplayValue(
        '555-555-010012345678901234567890123456789012345678901',
      ),
    ).toBeInTheDocument();
  });

  it('preserves draft on network failure and retries create with same clientRequestId', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions
      .mockResolvedValueOnce({
        propertyId: 'property-1',
        interactions: [],
      })
      .mockResolvedValueOnce({
        propertyId: 'property-1',
        interactions: [
          {
            interactionId: 'interaction-new',
            interactionGroupId: 'group-new',
            userId: 'user-1',
            statusName: 'Interested',
            notes: 'Retry note',
          },
        ],
      });

    createPropertyInteraction
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        interactionId: 'interaction-new',
        interactionGroupId: 'group-new',
      });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Retry note' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    expect(
      await screen.findByText(
        'Connection failed while submitting your interaction. Your draft is still saved locally. Please check connectivity and retry.',
      ),
    ).toBeInTheDocument();

    const firstPayload = createPropertyInteraction.mock.calls[0][1];
    expect(firstPayload.clientRequestId).toEqual(expect.any(String));

    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    await waitFor(() => {
      expect(createPropertyInteraction).toHaveBeenCalledTimes(2);
    });

    const secondPayload = createPropertyInteraction.mock.calls[1][1];
    expect(secondPayload.clientRequestId).toBe(firstPayload.clientRequestId);

    expect(
      await screen.findByText('Interaction recorded successfully.'),
    ).toBeInTheDocument();
  });

  it('shows role/session/server-specific messages for interaction save failures', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions.mockResolvedValue({
      propertyId: 'property-1',
      interactions: [],
    });

    render(<MapPage />);

    await selectFirstPropertyMarker();
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });

    createPropertyInteraction.mockRejectedValueOnce({
      status: 401,
      message: 'Missing Authorization header.',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));
    expect(
      await screen.findByText(
        'Your session has expired. Please sign in again.',
      ),
    ).toBeInTheDocument();

    createPropertyInteraction.mockRejectedValueOnce({
      status: 403,
      message: 'You do not have permission to perform this action.',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));
    expect(
      await screen.findByText(
        'You are not authorized to perform that interaction action.',
      ),
    ).toBeInTheDocument();

    createPropertyInteraction.mockRejectedValueOnce({
      status: 500,
      message: 'An unexpected error occurred.',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));
    expect(
      await screen.findByText(
        'The server could not complete this save right now. Your entered values are still available so you can retry.',
      ),
    ).toBeInTheDocument();
  });
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const PROPERTY_1 = {
  propertyId: 'property-1',
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Knoxville',
  state: 'TN',
  postalCode: '37901',
  country: 'US',
  latitude: 35.51,
  longitude: -84.11,
};

const PROPERTY_2 = {
  ...PROPERTY_1,
  propertyId: 'property-2',
  addressLine1: '900 Elm St',
  postalCode: '37902',
};

function draftScope(propertyId, interactionId) {
  return {
    userId: 'user-1',
    organizationId: 'org-1',
    propertyId,
    interactionId,
  };
}

function seedCreateDraft(propertyId, notes, statusId = 'status-2') {
  saveInteractionDraft(draftScope(propertyId), {
    statusId,
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    notes,
    clientRequestId: `request-${propertyId}`,
    mode: 'create',
  });
}

function seedEditDraft(propertyId, interactionId, notes) {
  saveInteractionDraft(draftScope(propertyId, interactionId), {
    statusId: 'status-1',
    contactName: 'Draft Name',
    contactPhone: '',
    contactEmail: '',
    notes,
    mode: 'edit',
    interactionId,
  });
}

async function clickMarker(index) {
  const markers = await screen.findAllByTestId('property-marker');

  await act(async () => {
    markers[index].click();
  });
}

describe('MapPage draft lifecycle with delayed responses', () => {
  beforeEach(() => {
    mockGeolocationSuccess();
  });

  it('restores a saved draft after a delayed property response without deleting it', async () => {
    seedCreateDraft('property-1', 'Delayed draft note.');
    const property = deferred();
    getPropertyById.mockReturnValueOnce(property.promise);
    getPropertyInteractions.mockResolvedValueOnce({
      propertyId: 'property-1',
      interactions: [],
    });

    render(<MapPage />);
    await clickMarker(0);

    // While details are still loading, the stored draft must survive.
    expect(loadInteractionDraft(draftScope('property-1'))?.notes).toBe(
      'Delayed draft note.',
    );

    await act(async () => {
      property.resolve(PROPERTY_1);
    });

    expect(await screen.findByLabelText('Notes')).toHaveValue(
      'Delayed draft note.',
    );
    expect(screen.getByLabelText('Status')).toHaveValue('status-2');
    expect(loadInteractionDraft(draftScope('property-1'))?.notes).toBe(
      'Delayed draft note.',
    );
  });

  it('keeps drafts isolated and intact when switching properties during slow responses', async () => {
    getMapProperties.mockResolvedValue([
      { propertyId: 'property-1', latitude: 35.51, longitude: -84.11 },
      { propertyId: 'property-2', latitude: 35.52, longitude: -84.12 },
    ]);
    seedCreateDraft('property-1', 'Draft one.');
    seedCreateDraft('property-2', 'Draft two.');

    const first = deferred();
    const second = deferred();
    getPropertyById.mockImplementation((propertyId) =>
      propertyId === 'property-1' ? first.promise : second.promise,
    );
    getPropertyInteractions.mockImplementation(async (propertyId) => ({
      propertyId,
      interactions: [],
    }));

    render(<MapPage />);
    await clickMarker(0);
    await clickMarker(1);

    // The newer selection resolves first, then the stale one arrives late.
    await act(async () => {
      second.resolve(PROPERTY_2);
    });
    await act(async () => {
      first.resolve(PROPERTY_1);
    });

    expect(await screen.findByLabelText('Notes')).toHaveValue('Draft two.');
    expect(loadInteractionDraft(draftScope('property-1'))?.notes).toBe(
      'Draft one.',
    );
    expect(loadInteractionDraft(draftScope('property-2'))?.notes).toBe(
      'Draft two.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await clickMarker(0);
    expect(await screen.findByLabelText('Notes')).toHaveValue('Draft one.');
  });

  it('restores edit drafts only for the matching property and interaction', async () => {
    seedEditDraft(
      'property-1',
      'interaction-other',
      'Wrong interaction draft.',
    );
    seedEditDraft('property-2', 'interaction-1', 'Wrong property draft.');
    seedEditDraft('property-1', 'interaction-1', 'Right edit draft.');

    const snapshot = deferred();
    const originalSnapshot = await getInteractionSnapshot('interaction-1');
    getInteractionSnapshot.mockReturnValueOnce(snapshot.promise);

    render(<MapPage />);
    await clickMarker(0);

    expect(
      loadInteractionDraft(draftScope('property-1', 'interaction-1'))?.notes,
    ).toBe('Right edit draft.');

    await act(async () => {
      snapshot.resolve(originalSnapshot);
    });

    expect(
      await screen.findByRole('button', { name: /Notes\s+Right edit draft\./ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveValue('status-1');
    expect(screen.queryByText(/Wrong/)).toBeNull();
  });

  it('keeps a create draft when a delayed save fails', async () => {
    getPropertyInteractions.mockResolvedValue({
      propertyId: 'property-1',
      interactions: [],
    });
    const save = deferred();
    createPropertyInteraction.mockReturnValueOnce(save.promise);

    render(<MapPage />);
    await clickMarker(0);
    await screen.findByLabelText('Notes');

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Must survive failure.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    expect(loadInteractionDraft(draftScope('property-1'))?.notes).toBe(
      'Must survive failure.',
    );

    await act(async () => {
      save.reject({ status: 500, message: 'An unexpected error occurred.' });
    });

    expect(
      await screen.findByText(/The server could not complete this save/),
    ).toBeInTheDocument();
    expect(loadInteractionDraft(draftScope('property-1'))?.notes).toBe(
      'Must survive failure.',
    );
  });

  it('clears the create draft after a delayed save succeeds', async () => {
    getPropertyInteractions
      .mockResolvedValueOnce({ propertyId: 'property-1', interactions: [] })
      .mockResolvedValue({ propertyId: 'property-1', interactions: [] });
    const save = deferred();
    createPropertyInteraction.mockReturnValueOnce(save.promise);

    render(<MapPage />);
    await clickMarker(0);
    await screen.findByLabelText('Notes');

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Will be saved.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    expect(loadInteractionDraft(draftScope('property-1'))?.notes).toBe(
      'Will be saved.',
    );

    await act(async () => {
      save.resolve({ interactionId: 'interaction-new' });
    });

    expect(
      await screen.findByText('Interaction recorded successfully.'),
    ).toBeInTheDocument();
    expect(loadInteractionDraft(draftScope('property-1'))).toBeNull();
  });

  it('clears the edit draft after a successful update so obsolete values never restore', async () => {
    seedEditDraft('property-1', 'interaction-1', 'Stale edit draft.');
    const update = deferred();
    updateInteractionSnapshot.mockReturnValueOnce(update.promise);
    getPropertyInteractions.mockResolvedValue({
      propertyId: 'property-1',
      interactions: [
        {
          interactionId: 'interaction-2',
          interactionGroupId: 'group-1',
          userId: 'user-1',
          statusName: 'No Answer',
        },
      ],
    });

    render(<MapPage />);
    await clickMarker(0);
    await screen.findByRole('heading', { name: 'Interaction Details' });

    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    await act(async () => {
      update.resolve({
        interactionId: 'interaction-2',
        interactionGroupId: 'group-1',
        propertyId: 'property-1',
        userId: 'user-1',
        statusId: 'status-1',
        statusName: 'No Answer',
        contactName: 'Server Name',
        contactPhone: null,
        contactEmail: null,
        notes: 'Server notes.',
      });
    });

    await screen.findByText('Interaction updated successfully.');
    expect(
      loadInteractionDraft(draftScope('property-1', 'interaction-1')),
    ).toBeNull();
    expect(
      loadInteractionDraft(draftScope('property-1', 'interaction-2')),
    ).toBeNull();
  });
});

async function clickMap(lat, lng) {
  await act(async () => {
    mockState.latestMapHandlers.click({ latlng: { lat, lng } });
  });
}

function snapshotFor(interactionId, propertyId, notes) {
  return {
    interactionId,
    interactionGroupId: `group-${propertyId}`,
    propertyId,
    userId: 'user-1',
    statusId: 'status-2',
    statusName: 'Interested',
    contactName: 'Owner',
    contactPhone: null,
    contactEmail: null,
    notes,
    representative: { firstName: 'Alex', lastName: 'Rep', email: 'a@x.com' },
  };
}

function useTwoProperties({ interactionsByProperty } = {}) {
  getMapProperties.mockResolvedValue([
    { propertyId: 'property-1', latitude: 35.51, longitude: -84.11 },
    { propertyId: 'property-2', latitude: 35.52, longitude: -84.12 },
  ]);
  getPropertyById.mockImplementation(async (propertyId) =>
    propertyId === 'property-2' ? PROPERTY_2 : PROPERTY_1,
  );
  getPropertyInteractions.mockImplementation(async (propertyId) => ({
    propertyId,
    interactions: interactionsByProperty?.[propertyId] ?? [],
  }));
}

describe('MapPage selection identity with delayed responses', () => {
  beforeEach(() => {
    mockGeolocationSuccess();
  });

  it('ignores an older map-location lookup that finishes after a newer one', async () => {
    useTwoProperties();
    const lookupOne = deferred();
    const lookupTwo = deferred();
    resolvePropertyLocation
      .mockReturnValueOnce(lookupOne.promise)
      .mockReturnValueOnce(lookupTwo.promise);

    render(<MapPage />);
    await screen.findAllByTestId('property-marker');

    await clickMap(35.51, -84.11);
    await clickMap(35.52, -84.12);

    await act(async () => {
      lookupTwo.resolve({ created: false, property: PROPERTY_2 });
    });
    expect(await screen.findByText(/900 Elm St/)).toBeInTheDocument();

    await act(async () => {
      lookupOne.resolve({ created: false, property: PROPERTY_1 });
    });

    expect(screen.getByText(/900 Elm St/)).toBeInTheDocument();
    expect(screen.queryByText(/123 Main St/)).toBeNull();
    expect(getPropertyById).not.toHaveBeenCalledWith('property-1');
  });

  it('does not reopen a selection cancelled while its lookup is pending', async () => {
    useTwoProperties();
    const lookup = deferred();
    resolvePropertyLocation.mockReturnValueOnce(lookup.promise);

    render(<MapPage />);
    await clickMarker(0);
    await screen.findByLabelText('Notes');

    await clickMap(35.52, -84.12);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await act(async () => {
      lookup.resolve({ created: false, property: PROPERTY_2 });
    });

    expect(
      screen.queryByRole('heading', { name: 'Selected Property' }),
    ).toBeNull();
    expect(getPropertyById).not.toHaveBeenCalledWith('property-2');
  });

  it('keeps the new property panel intact when a create save for the old property completes', async () => {
    useTwoProperties();
    const save = deferred();
    createPropertyInteraction.mockReturnValueOnce(save.promise);

    render(<MapPage />);
    await clickMarker(0);
    await screen.findByLabelText('Notes');

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Note for A.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    await clickMarker(1);
    expect(await screen.findByText(/900 Elm St/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Note for B.' },
    });

    await act(async () => {
      save.resolve({ interactionId: 'interaction-a' });
    });

    expect(screen.getByLabelText('Notes')).toHaveValue('Note for B.');
    expect(screen.getByText(/900 Elm St/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save interaction' }),
    ).toBeEnabled();
    expect(screen.queryByText('Interaction recorded successfully.')).toBeNull();
    expect(createPropertyInteraction).toHaveBeenCalledTimes(1);
    expect(createPropertyInteraction.mock.calls[0][0]).toBe('property-1');
    expect(loadInteractionDraft(draftScope('property-1'))).toBeNull();
    expect(loadInteractionDraft(draftScope('property-2'))?.notes).toBe(
      'Note for B.',
    );
  });

  it('keeps the new property panel intact when an update for the old property completes', async () => {
    useTwoProperties({
      interactionsByProperty: {
        'property-1': [
          { interactionId: 'interaction-1', userId: 'user-1', statusName: 'x' },
        ],
      },
    });
    const update = deferred();
    updateInteractionSnapshot.mockReturnValueOnce(update.promise);

    render(<MapPage />);
    await clickMarker(0);
    await screen.findByRole('heading', { name: 'Interaction Details' });

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    await clickMarker(1);
    expect(await screen.findByText(/900 Elm St/)).toBeInTheDocument();

    await act(async () => {
      update.resolve(snapshotFor('interaction-2', 'property-1', 'Done'));
    });

    expect(screen.getByText(/900 Elm St/)).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Save interaction' }),
    ).toBeEnabled();
    expect(screen.queryByText('Interaction updated successfully.')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Interaction Details' }),
    ).toBeNull();
  });

  it('does not offer a submittable form while another property is loading', async () => {
    useTwoProperties();
    const slowProperty = deferred();

    render(<MapPage />);
    await clickMarker(0);
    await screen.findByLabelText('Notes');
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });

    getPropertyById.mockReturnValueOnce(slowProperty.promise);
    await clickMarker(1);

    expect(
      screen.queryByRole('button', { name: 'Save interaction' }),
    ).toBeNull();
    expect(screen.queryByLabelText('Notes')).toBeNull();
    expect(createPropertyInteraction).not.toHaveBeenCalled();

    await act(async () => {
      slowProperty.resolve(PROPERTY_2);
    });

    expect(await screen.findByText(/900 Elm St/)).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });

  it('reports a saved write with a failed refresh and retries only the refresh', async () => {
    useTwoProperties();
    getPropertyInteractions
      .mockResolvedValueOnce({ propertyId: 'property-1', interactions: [] })
      .mockRejectedValueOnce(new Error('refresh down'))
      .mockResolvedValue({ propertyId: 'property-1', interactions: [] });

    render(<MapPage />);
    await clickMarker(0);
    await screen.findByLabelText('Notes');

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-2' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Saved note.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

    expect(
      await screen.findByText(
        'Your interaction was saved, but the latest property details could not be refreshed.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Unable to save this interaction right now.'),
    ).toBeNull();
    expect(loadInteractionDraft(draftScope('property-1'))).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry refresh' }));

    expect(
      await screen.findByText('Saved changes and refreshed property details.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry refresh' })).toBeNull();
    expect(createPropertyInteraction).toHaveBeenCalledTimes(1);
  });

  it('ignores an older snapshot request that finishes after a newer selection', async () => {
    useTwoProperties({
      interactionsByProperty: {
        'property-1': [
          { interactionId: 'interaction-1', userId: 'user-1', statusName: 'x' },
        ],
        'property-2': [
          { interactionId: 'interaction-9', userId: 'user-1', statusName: 'x' },
        ],
      },
    });
    const slowSnapshot = deferred();
    getInteractionSnapshot.mockImplementation((interactionId) =>
      interactionId === 'interaction-1'
        ? slowSnapshot.promise
        : Promise.resolve(
            snapshotFor('interaction-9', 'property-2', 'Property two notes'),
          ),
    );

    render(<MapPage />);
    await clickMarker(0);
    await clickMarker(1);

    expect(
      await screen.findByRole('button', { name: /Notes\s+Property two notes/ }),
    ).toBeInTheDocument();

    await act(async () => {
      slowSnapshot.resolve(
        snapshotFor('interaction-1', 'property-1', 'Property one notes'),
      );
    });

    expect(screen.getByText(/900 Elm St/)).toBeInTheDocument();
    expect(screen.queryByText(/Property one notes/)).toBeNull();
    expect(
      screen.getByRole('button', { name: /Notes\s+Property two notes/ }),
    ).toBeInTheDocument();
  });
});

it('reports a failed explicit draft write rather than claiming it was saved', async () => {
  mockGeolocationSuccess();
  getPropertyInteractions.mockResolvedValue({
    propertyId: 'property-1',
    interactions: [],
  });
  render(<MapPage />);
  await selectFirstPropertyMarker();
  await screen.findByRole('heading', { name: 'Record Interaction' });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage full');
  });
  fireEvent.change(screen.getByLabelText('Contact name'), {
    target: { value: 'Unsaved contact' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(
    await screen.findByText(/Draft could not be saved on this device/),
  ).toBeInTheDocument();
  expect(screen.queryByText('Draft saved successfully.')).toBeNull();
});

it('autosaves private edit work and restores it after closing the popup', async () => {
  mockGeolocationSuccess();
  render(<MapPage />);
  await selectFirstPropertyMarker();
  await screen.findByRole('heading', { name: 'Interaction Details' });
  fireEvent.click(
    screen.getByRole('button', { name: /Notes\s+Call after 5pm\./i }),
  );
  fireEvent.change(screen.getByLabelText('Notes'), {
    target: { value: 'Autosaved private edit' },
  });
  const scope = {
    userId: 'user-1',
    organizationId: 'org-1',
    propertyId: 'property-1',
    interactionId: 'interaction-1',
  };
  await waitFor(() =>
    expect(loadInteractionDraft(scope)?.notes).toBe('Autosaved private edit'),
  );
  expect(updateInteractionSnapshot).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
  await selectFirstPropertyMarker();
  expect(
    await screen.findByRole('button', {
      name: /Notes\s+Autosaved private edit/i,
    }),
  ).toBeInTheDocument();
});

it('uses server edit capability instead of presenting every manager as an editor', async () => {
  mockGeolocationSuccess();
  authState.user.role = 'manager';
  const snapshot = await getInteractionSnapshot();
  getInteractionSnapshot.mockResolvedValue({
    ...snapshot,
    userId: 'non-team-rep',
    canEdit: false,
  });
  render(<MapPage />);
  await selectFirstPropertyMarker();
  await screen.findByRole('heading', { name: 'Interaction Details' });
  expect(
    screen.queryByRole('button', { name: 'Save interaction', exact: true }),
  ).toBeNull();
  expect(screen.getByLabelText('Status')).toBeDisabled();
});

it('preserves entered values and requires review before resaving a conflict', async () => {
  mockGeolocationSuccess();
  render(<MapPage />);
  await selectFirstPropertyMarker();
  await screen.findByRole('heading', { name: 'Interaction Details' });
  const snapshot = await getInteractionSnapshot.mock.results[0].value;
  getInteractionSnapshot.mockResolvedValue({
    ...snapshot,
    interactionId: 'latest-snapshot',
    notes: 'Other editor saved this',
  });
  updateInteractionSnapshot.mockRejectedValueOnce(
    Object.assign(new Error('conflict'), { status: 409 }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: /Notes\s+Call after 5pm\./i }),
  );
  fireEvent.change(screen.getByLabelText('Notes'), {
    target: { value: 'My unsaved changes' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save interaction', exact: true }),
  );
  expect(
    await screen.findByRole('region', { name: 'Review interaction conflict' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Other editor saved this')).toBeInTheDocument();
  expect(screen.getByLabelText('Notes')).toHaveValue('My unsaved changes');
  expect(updateInteractionSnapshot).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByRole('button', { name: 'Keep my entered values for review' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save interaction', exact: true }),
  );
  await waitFor(() =>
    expect(updateInteractionSnapshot).toHaveBeenCalledTimes(2),
  );
  expect(updateInteractionSnapshot.mock.calls[1][0]).toBe('latest-snapshot');
});

it('offers Log a visit beside a separate Edit for a property with history', async () => {
  mockGeolocationSuccess();
  getInteractionSnapshot.mockResolvedValue({
    interactionId: 'interaction-1',
    interactionGroupId: 'group-1',
    propertyId: 'property-1',
    userId: 'user-1',
    statusId: 'status-2',
    statusName: 'Interested',
    changedAt: '2026-08-02T15:00:00.000Z',
    changedBy: 'user-9',
    lastEditedBy: { firstName: 'Casey', lastName: 'Manager' },
    contactName: 'Pat',
    canEdit: true,
  });

  render(<MapPage />);
  await selectFirstPropertyMarker();
  await screen.findByRole('heading', { name: 'Interaction Details' });

  expect(
    screen.getByText(/Last edited by Casey Manager on/),
  ).toBeInTheDocument();
  expect(screen.getAllByText('Edit').length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: 'Log a visit' }));
  expect(
    await screen.findByRole('heading', { name: 'Record Interaction' }),
  ).toBeInTheDocument();
  expect(updateInteractionSnapshot).not.toHaveBeenCalled();
});

it('keeps entered details on a same-day conflict and only resubmits after confirmation', async () => {
  mockGeolocationSuccess();
  getPropertyInteractions.mockResolvedValueOnce({
    propertyId: 'property-1',
    interactions: [],
  });
  const conflict = new Error('exists');
  conflict.status = 409;
  conflict.code = 'SAME_DAY_VISIT_EXISTS';
  createPropertyInteraction.mockRejectedValueOnce(conflict);

  render(<MapPage />);
  await selectFirstPropertyMarker();

  fireEvent.change(screen.getByLabelText('Status'), {
    target: { value: 'status-2' },
  });
  fireEvent.change(screen.getByLabelText('Notes'), {
    target: { value: 'Back after lunch' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));

  const confirm = await screen.findByRole('button', {
    name: 'Confirm same-day return',
  });
  expect(screen.getByText(/won't add another knock/)).toBeInTheDocument();
  expect(screen.getByLabelText('Notes')).toHaveValue('Back after lunch');
  expect(createPropertyInteraction).toHaveBeenCalledTimes(1);
  expect(
    createPropertyInteraction.mock.calls[0][1].sameDayReturn,
  ).toBeUndefined();
  expect(
    loadInteractionDraft({
      userId: 'user-1',
      organizationId: 'org-1',
      propertyId: 'property-1',
    })?.notes,
  ).toBe('Back after lunch');

  fireEvent.click(confirm);
  await waitFor(() =>
    expect(createPropertyInteraction).toHaveBeenCalledTimes(2),
  );
  expect(createPropertyInteraction.mock.calls[1][1]).toMatchObject({
    sameDayReturn: true,
    notes: 'Back after lunch',
    clientRequestId: createPropertyInteraction.mock.calls[0][1].clientRequestId,
  });
  expect(
    await screen.findByText(/No additional knock was added/),
  ).toBeInTheDocument();
});

it('drops the same-day confirmation when another property is selected', async () => {
  mockGeolocationSuccess();
  getMapProperties.mockResolvedValue([
    { propertyId: 'property-1', latitude: 35.51, longitude: -84.11 },
    { propertyId: 'property-2', latitude: 35.52, longitude: -84.12 },
  ]);
  getPropertyInteractions.mockResolvedValue({ interactions: [] });
  const conflict = new Error('exists');
  conflict.status = 409;
  conflict.code = 'SAME_DAY_VISIT_EXISTS';
  createPropertyInteraction.mockRejectedValueOnce(conflict);

  render(<MapPage />);
  await selectPropertyMarkerByIndex(0);
  fireEvent.change(screen.getByLabelText('Status'), {
    target: { value: 'status-2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));
  await screen.findByRole('button', { name: 'Confirm same-day return' });

  await selectPropertyMarkerByIndex(1);
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Confirm same-day return' }),
    ).toBeNull(),
  );
  expect(createPropertyInteraction).toHaveBeenCalledTimes(1);
});

it('does not show a late save result under a newly selected property', async () => {
  mockGeolocationSuccess();
  getMapProperties.mockResolvedValue([
    { propertyId: 'property-1', latitude: 35.51, longitude: -84.11 },
    { propertyId: 'property-2', latitude: 35.52, longitude: -84.12 },
  ]);
  getPropertyInteractions.mockResolvedValue({ interactions: [] });
  let finish;
  createPropertyInteraction.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );

  render(<MapPage />);
  await selectPropertyMarkerByIndex(0);
  fireEvent.change(screen.getByLabelText('Status'), {
    target: { value: 'status-2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save interaction' }));
  await waitFor(() =>
    expect(createPropertyInteraction).toHaveBeenCalledTimes(1),
  );

  await selectPropertyMarkerByIndex(1);
  await act(async () => {
    finish({ interactionId: 'late' });
  });

  expect(screen.queryByText(/recorded successfully/)).toBeNull();
  expect(createPropertyInteraction).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Notes')).toHaveValue('');
});
