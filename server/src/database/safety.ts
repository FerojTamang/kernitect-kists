export function assertLocalDevelopmentDatabase(
  connectionString: string,
): string {
  const url = new URL(connectionString);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^kists_(dev|test)(_[a-z0-9]+)?$/.test(database)
  ) {
    throw new Error(
      'Seed, reset and database tests require a local kists_dev or kists_test database (optional _suffix), outside production.',
    );
  }
  return database;
}
