import { describe, expect, it } from 'vitest';
import { isValidIanaTimeZone } from '../../src/common/timezone.js';

describe('shared timezone validation', () => {
  it.each(['America/New_York', 'Asia/Tokyo', 'UTC'])('accepts %s', (zone) => {
    expect(isValidIanaTimeZone(zone)).toBe(true);
  });

  it.each(['+05:00', '', 'Not/A_Real_Timezone', null, 42, undefined])(
    'rejects %s',
    (zone) => {
      expect(isValidIanaTimeZone(zone)).toBe(false);
    },
  );
});
