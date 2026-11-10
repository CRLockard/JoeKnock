const TIMEZONE_MESSAGE =
  'timezone must be a recognized IANA timezone name such as America/New_York.';

// Cheap request-level check. Offsets such as "+05:00" are rejected because the
// database cannot resolve them by name.
export function isValidIanaTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !/^[A-Za-z]/.test(timeZone)) {
    return false;
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Authoritative check: visits freeze local dates with this zone, so only names
// the database itself resolves are accepted.
export async function isRecognizedTimezone(client, timezone) {
  const result = await client.query(
    'SELECT 1 FROM pg_timezone_names WHERE name = $1 LIMIT 1',
    [timezone],
  );
  return result.rowCount > 0;
}

export { TIMEZONE_MESSAGE };
