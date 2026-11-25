import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertSafeTestDatabaseUrl, query } from '../../src/db/client.js';
import {
  ensureTestMigrations,
  hasTestDatabase,
} from '../helpers/dbTestHarness.js';

const describeDb = hasTestDatabase() ? describe : describe.skip;
const workerPath = fileURLToPath(
  new URL('../helpers/geocodingWorker.js', import.meta.url),
);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function worker() {
  const child = fork(workerPath, [], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: {
      ...process.env,
      PGAPPNAME: `joeknock-geocoding-test-${process.pid}`,
    },
  });
  const messages = [];
  child.on('message', (message) => messages.push(message));
  async function next(type) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const index = messages.findIndex((message) => message.type === type);
      if (index >= 0) return messages.splice(index, 1)[0];
      await wait(10);
    }
    throw new Error(`Timed out waiting for worker message: ${type}`);
  }
  return {
    child,
    next,
    run(latitude) {
      child.send({ type: 'run', latitude });
    },
    async close() {
      if (!child.connected) return;
      const exited = once(child, 'exit');
      child.send({ type: 'close' });
      await exited;
    },
  };
}

describeDb('cross-process geocoding pacing', () => {
  let a;
  let b;
  beforeAll(async () => {
    await ensureTestMigrations();
    a = worker();
    b = worker();
    await Promise.all([a.next('ready'), b.next('ready')]);
  });
  beforeEach(async () => {
    const expected = assertSafeTestDatabaseUrl(
      process.env.TEST_DATABASE_URL,
      process.env.DATABASE_URL,
    );
    const actual = await query('SELECT current_database() AS name');
    expect(actual.rows[0].name).toBe(expected);
    await query("UPDATE geocoding_pacing SET available_at = '-infinity'");
  });
  afterAll(async () => {
    await Promise.all([a?.close(), b?.close()]);
  });

  it('returns promptly and spaces actual starts after successes and failures', async () => {
    a.run(1);
    const first = await a.next('started');
    b.run(6);
    expect((await b.next('error')).category).toBe('provider_busy');
    const result = await a.next('result');
    expect(result.elapsed).toBeLessThan(800);
    b.run(6);
    expect((await b.next('error')).category).toBe('provider_busy');
    await wait(1200);
    b.run(4);
    const failed = await b.next('started');
    expect(failed.at - first.at).toBeGreaterThanOrEqual(1100);
    expect((await b.next('error')).message).toBe('stub provider failure');
    a.run(7);
    expect((await a.next('error')).category).toBe('provider_busy');
    await wait(1200);
    a.run(7);
    const last = await a.next('started');
    expect(last.at - failed.at).toBeGreaterThanOrEqual(1100);
    await a.next('result');
    console.log(
      `Stubbed geocoding: response ${result.elapsed.toFixed(1)} ms; start gaps ${failed.at - first.at} ms and ${last.at - failed.at} ms`,
    );
  });

  it('keeps a stalled worker exclusive and cools down after it finishes', async () => {
    a.run(2);
    const first = await a.next('started');
    await wait(1200);
    b.run(8);
    expect((await b.next('error')).category).toBe('provider_busy');
    a.child.send({ type: 'release' });
    await a.next('result');
    b.run(8);
    expect((await b.next('error')).category).toBe('provider_busy');
    await wait(1200);
    b.run(8);
    const second = await b.next('started');
    expect(second.at - first.at).toBeGreaterThanOrEqual(1100);
    await b.next('result');
  });

  it('preserves cooldown across a graceful worker shutdown', async () => {
    const closing = worker();
    await closing.next('ready');
    closing.run(10);
    const first = await closing.next('started');
    await closing.next('result');
    await closing.close();
    b.run(11);
    expect((await b.next('error')).category).toBe('provider_busy');
    await wait(1200);
    b.run(11);
    const second = await b.next('started');
    expect(second.at - first.at).toBeGreaterThanOrEqual(1100);
    await b.next('result');
  });

  it('fails closed if the active test coordination connection is terminated', async () => {
    a.run(13);
    await a.next('started');
    const lock = await query(
      `SELECT l.pid FROM pg_locks l
       JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE l.locktype = 'advisory' AND l.classid = 1246708555
         AND l.objid = 1 AND l.granted AND a.datname = current_database()
         AND a.application_name = $1`,
      [`joeknock-geocoding-test-${process.pid}`],
    );
    expect(lock.rows).toHaveLength(1);
    const terminated = await query(
      'SELECT pg_terminate_backend($1) AS stopped',
      [lock.rows[0].pid],
    );
    expect(terminated.rows[0].stopped).toBe(true);
    expect((await a.next('error')).category).toBe(
      'provider_coordination_unavailable',
    );
    b.run(12);
    expect((await b.next('error')).category).toBe('provider_busy');
  });

  it('retains the conservative lease after a process exits mid-request', async () => {
    const crashed = worker();
    await crashed.next('ready');
    const exited = once(crashed.child, 'exit');
    crashed.run(3);
    const first = await crashed.next('started');
    await exited;
    b.run(9);
    expect((await b.next('error')).category).toBe('provider_busy');
    await wait(Math.max(0, first.at + 32500 - Date.now()));
    b.run(9);
    const second = await b.next('started');
    expect(second.at - first.at).toBeGreaterThanOrEqual(32000);
    await b.next('result');
  }, 45000);
});
