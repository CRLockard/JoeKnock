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
} from '../api/propertiesApi.js';
import { getStatuses } from '../api/statusesApi.js';
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

beforeEach(() => {
  vi.clearAllMocks();
  mockState.latestMapHandlers = null;
  mockState.setViewMock.mockReset();

  authState.user = {
    id: 'user-1',
    role: 'rep',
  };

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

  it('renders interaction-entry fields when starting a new interaction from selected property', async () => {
    mockGeolocationSuccess();
    getPropertyInteractions.mockResolvedValueOnce({
      propertyId: 'property-1',
      interactions: [],
    });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    fireEvent.click(screen.getByRole('button', { name: 'Start interaction' }));

    expect(
      screen.getByRole('heading', { name: 'Record Interaction' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact name')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact phone')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact email')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('submits a new interaction and transitions to snapshot detail without leaving selected property workflow', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Start interaction' }));

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
      screen.getByRole('heading', { name: 'Interaction Snapshot' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Property:/)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Start interaction' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Start interaction' }));

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

  it('loads current interaction snapshot detail and renders only approved fields', async () => {
    mockGeolocationSuccess();

    render(<MapPage />);

    await selectFirstPropertyMarker();

    fireEvent.click(screen.getByRole('button', { name: 'View snapshot' }));

    await waitFor(() => {
      expect(getInteractionSnapshot).toHaveBeenCalledWith('interaction-1');
    });

    expect(
      await screen.findByRole('heading', { name: 'Interaction Snapshot' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Status:/)).toBeInTheDocument();
    expect(screen.getByText(/First Knock:/)).toBeInTheDocument();
    expect(screen.getByText(/Last Updated:/)).toBeInTheDocument();
    expect(screen.queryByText(/timeline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/interaction_at/i)).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'View snapshot' }));
    await screen.findByRole('button', { name: 'Edit interaction' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit interaction' }));

    expect(
      screen.getByRole('heading', { name: 'Edit Interaction Snapshot' }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-1' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'No answer on return visit.' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Save as new snapshot' }),
    );

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
    expect(screen.getByText(/Status:/)).toBeInTheDocument();
    expect(screen.getByText(/No Answer/)).toBeInTheDocument();
  });

  it('handles 403 response when updating an interaction snapshot', async () => {
    mockGeolocationSuccess();

    updateInteractionSnapshot.mockRejectedValueOnce({
      status: 403,
      message: 'You do not have permission to perform this action.',
    });

    render(<MapPage />);

    await selectFirstPropertyMarker();

    fireEvent.click(screen.getByRole('button', { name: 'View snapshot' }));
    await screen.findByRole('button', { name: 'Edit interaction' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit interaction' }));

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-1' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Save as new snapshot' }),
    );

    expect(
      await screen.findByText(
        'You are not authorized to perform that interaction action.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Edit Interaction Snapshot' }),
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

    fireEvent.click(screen.getByRole('button', { name: 'Start interaction' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[1]);

    expect(
      screen.getByRole('heading', { name: 'Selected Property' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start interaction' }),
    ).toBeInTheDocument();
  });
});
