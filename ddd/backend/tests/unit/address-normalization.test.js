import { describe, expect, it } from 'vitest';
import { normalizeResolvedAddress } from '../../src/properties/addressNormalization.js';

describe('normalizeResolvedAddress', () => {
  it('normalizes casing and repeated whitespace deterministically', () => {
    const value = normalizeResolvedAddress({
      addressLine1: '  123   MAIN   STREET ',
      addressLine2: null,
      city: '  KNOXVILLE ',
      state: ' Tennessee ',
      postalCode: ' 37901 ',
      country: ' US ',
    });

    expect(value).toBe('123 main st|knoxville|tennessee|37901|us');
  });

  it('normalizes common abbreviations to the same canonical form', () => {
    const street = normalizeResolvedAddress({
      addressLine1: '123 Main Street',
      addressLine2: 'Apartment 5',
      city: 'Knoxville',
      state: 'TN',
      postalCode: '37901',
      country: 'US',
    });

    const abbreviated = normalizeResolvedAddress({
      addressLine1: '123 MAIN ST.',
      addressLine2: 'APT 5',
      city: 'knoxville',
      state: 'tn',
      postalCode: '37901',
      country: 'us',
    });

    expect(street).toBe(abbreviated);
  });

  it('normalizes postal code spacing', () => {
    const withSpace = normalizeResolvedAddress({
      addressLine1: '10 North Road',
      addressLine2: null,
      city: 'London',
      state: 'Greater London',
      postalCode: 'SW1A 1AA',
      country: 'GB',
    });

    const withoutSpace = normalizeResolvedAddress({
      addressLine1: '10 N rd',
      addressLine2: null,
      city: 'london',
      state: 'greater london',
      postalCode: 'sw1a1aa',
      country: 'gb',
    });

    expect(withSpace).toBe(withoutSpace);
  });
});
