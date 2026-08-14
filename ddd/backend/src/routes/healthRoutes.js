import { Router } from 'express';

export function buildHealthRoutes({ db }) {
  const router = Router();

  router.get('/health', async (req, res) => {
    void req;

    try {
      await db.query('SELECT 1');
      return res.status(200).json({ status: 'ok' });
    } catch {
      return res.status(503).json({ status: 'unavailable' });
    }
  });

  return router;
}
