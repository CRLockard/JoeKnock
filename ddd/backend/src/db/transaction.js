import { getPool } from './client.js';

export async function withTransaction(callback) {
  const client = await getPool().connect();

  try {
    // Services use this helper to keep multi-step writes atomic while keeping
    // route handlers thin and repository methods focused on SQL only.
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
