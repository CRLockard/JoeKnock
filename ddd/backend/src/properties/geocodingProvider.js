class GeocodingProviderError extends Error {
  constructor(message, { category, provider = 'nominatim', statusCode } = {}) {
    super(message);
    this.name = 'GeocodingProviderError';
    this.category = category ?? 'unknown';
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickAddressLine1(address) {
  const parts = [address.house_number, address.road]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' ');
  }

  return '';
}

export function createNominatimGeocodingProvider({
  fetchImpl = fetch,
  baseUrl = 'https://nominatim.openstreetmap.org',
} = {}) {
  return {
    async reverseGeocode({ latitude, longitude }) {
      const url = new URL('/reverse', baseUrl);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));

      let response;

      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'JoeKnock/0.1 property-resolution',
          },
        });
      } catch {
        throw new GeocodingProviderError('Geocoding provider request failed.', {
          category: 'network_transport_failure',
        });
      }

      if (!response.ok) {
        throw new GeocodingProviderError('Geocoding provider request failed.', {
          category: 'provider_non_2xx',
          statusCode: response.status,
        });
      }

      let body;

      try {
        body = await response.json();
      } catch {
        throw new GeocodingProviderError(
          'Geocoding provider response was invalid.',
          {
            category: 'provider_invalid_json',
          },
        );
      }

      const address = body?.address;

      if (!address || typeof address !== 'object') {
        return null;
      }

      const addressLine1 = pickAddressLine1(address);
      const city =
        address.city ??
        address.town ??
        address.village ??
        address.hamlet ??
        address.municipality ??
        address.county ??
        '';
      const state = address.state ?? address.state_district ?? '';
      const postalCode = address.postcode ?? '';
      const country =
        (address.country_code
          ? String(address.country_code).toUpperCase()
          : '') ||
        address.country ||
        '';

      if (!addressLine1 || !city || !state || !postalCode || !country) {
        return null;
      }

      const resolvedLatitude = toNumber(body?.lat);
      const resolvedLongitude = toNumber(body?.lon);

      return {
        addressLine1,
        addressLine2: null,
        city,
        state,
        postalCode,
        country,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
      };
    },
  };
}

export { GeocodingProviderError };
