import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapPage } from '../pages/MapPage.jsx';
import { getMapProperties } from '../api/mapApi.js';

vi.mock('../api/mapApi.js', () => ({
  getMapProperties: vi.fn(),
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
    Marker: ({ children }) => (
      <div data-testid="property-marker">{children}</div>
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
});
