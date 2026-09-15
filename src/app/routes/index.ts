import express from 'express';

import { APP_NAME, APP_VERSION, API_PREFIX } from '../../shared/constants';
import type { AppDependencies } from '../app';

export function createApiRouter(deps: AppDependencies): express.Router {
  const router = express.Router();
  router.get('/', (_req, res) => {
    res.json({
      name: APP_NAME,
      version: APP_VERSION,
      prefix: API_PREFIX,
      status: 'running',
      documentation: '/api/docs',
      health: '/health',
    });
  });
  void deps;
  return router;
}
