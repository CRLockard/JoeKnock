import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapPage } from '../pages/MapPage.jsx';
import { getMapProperties } from '../api/mapApi.js';
import {
  getPropertyById,
  getPropertyInteractions,
} from '../api/propertiesApi.js';

vi.mock('../api/mapApi.js', () => ({
  getMapProperties: vi.fn(),
}));

vi.mock('../api/propertiesApi.js', () => ({
  getPropertyById: vi.fn(),
  getPropertyInteractions: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  mockState.latestMapHandlers = null;
  mockState.setViewMock.mockReset();
  getMapProperties.mockResolvedValue([]);
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
        interactionGroupId: 'group-1',
        statusName: 'Interested',
        notes: 'Wants a follow-up call.',
      },
    ],
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

  it('loads selected property details and current interactions from marker click', async () => {
    mockGeolocationSuccess();
    getMapProperties.mockResolvedValue([
      { propertyId: 'property-1', latitude: 35.51, longitude: -84.11 },
    ]);

    render(<MapPage />);

    const marker = await screen.findByTestId('property-marker');

    await act(async () => {
      marker.click();
    });

    expect(getPropertyById).toHaveBeenCalledWith('property-1');
    expect(getPropertyInteractions).toHaveBeenCalledWith('property-1');

    expect(
      await screen.findByRole('heading', { name: 'Selected Property' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Current Interaction State')).toBeInTheDocument();
    expect(screen.getByText('Interested')).toBeInTheDocument();
    expect(screen.getByText(/Wants a follow-up call\./)).toBeInTheDocument();
  });

  it('allows canceling selected property and returns to free map mode', async () => {
    mockGeolocationSuccess();
    getMapProperties.mockResolvedValue([
      { propertyId: 'property-1', latitude: 35.51, longitude: -84.11 },
    ]);

    render(<MapPage />);

    const marker = await screen.findByTestId('property-marker');

    await act(async () => {
      marker.click();
    });

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });

    await act(async () => {
      cancelButton.click();
    });

    expect(
      screen.queryByRole('heading', { name: 'Selected Property' }),
    ).not.toBeInTheDocument();
  });

  it('shows an error when property detail loading fails for selected marker', async () => {
    mockGeolocationSuccess();
    getMapProperties.mockResolvedValue([
      { propertyId: 'property-1', latitude: 35.51, longitude: -84.11 },
    ]);
    getPropertyById.mockRejectedValueOnce(
      new Error('Unable to load property.'),
    );

    render(<MapPage />);

    const marker = await screen.findByTestId('property-marker');

    await act(async () => {
      marker.click();
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load property.',
    );
  });
});
