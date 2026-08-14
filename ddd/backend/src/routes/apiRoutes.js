import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../validation/validate.js';
import { buildAuthRoutes } from '../auth/authRoutes.js';

export function buildApiRoutes({ authService } = {}) {
  const router = Router();

  router.use('/auth', buildAuthRoutes({ authService }));

  router.get('/_scaffold/protected', authMiddleware, (req, res) => {
    return res.status(200).json({
      ok: true,
      auth: req.auth,
    });
  });

  router.post(
    '/_scaffold/validate',
    body('value').isString().notEmpty(),
    validate,
    (req, res) => {
      return res.status(200).json({
        value: req.body.value,
      });
    },
  );

  return router;
}
