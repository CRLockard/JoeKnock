import { createManagedGeocodingProvider } from '../../src/properties/managedGeocodingProvider.js';
import { closePool } from '../../src/db/client.js';

let release;
const provider = {
  async reverseGeocode({ latitude, signal }) {
    process.send({ type: 'started', at: Date.now() });
    if (latitude === 3) process.exit(0);
    if (latitude === 2 || latitude === 13) {
      await new Promise((resolve, reject) => {
        release = resolve;
        signal.addEventListener(
          'abort',
          () => reject(new Error('coordination connection lost')),
          { once: true },
        );
      });
    } else {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (latitude === 4) throw new Error('stub provider failure');
    return { addressLine1: 'stub' };
  },
};
const managed = createManagedGeocodingProvider({ provider });

process.on('message', async (message) => {
  if (message.type === 'release') {
    release();
  } else if (message.type === 'close') {
    await closePool();
    process.disconnect();
  } else if (message.type === 'run') {
    const start = performance.now();
    try {
      await managed.reverseGeocode({
        latitude: message.latitude,
        longitude: 0,
      });
      process.send({ type: 'result', elapsed: performance.now() - start });
    } catch (error) {
      process.send({
        type: 'error',
        category: error.category,
        message: error.message,
        elapsed: performance.now() - start,
      });
    }
  }
});
process.send({ type: 'ready' });
