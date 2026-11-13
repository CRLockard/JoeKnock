export function assertSafeTestDatabaseUrl(testUrl, developmentUrl) {
  let target;
  try {
    target = new URL(testUrl);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !/(^|[_-])test($|[_-])/i.test(decodeURIComponent(target.pathname.slice(1)))
  ) {
    throw new Error(
      'TEST_DATABASE_URL must name an explicitly test-only database (for example joeknock_test).',
    );
  }
  if (developmentUrl) {
    const development = new URL(developmentUrl);
    const host = (url) =>
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname.toLowerCase())
        ? 'loopback'
        : url.hostname.toLowerCase();
    if (
      host(target) === host(development) &&
      (target.port || '5432') === (development.port || '5432') &&
      decodeURIComponent(target.pathname) ===
        decodeURIComponent(development.pathname)
    ) {
      throw new Error(
        'TEST_DATABASE_URL must not target the same database as DATABASE_URL.',
      );
    }
  }
  return decodeURIComponent(target.pathname.slice(1));
}
