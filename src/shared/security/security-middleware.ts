import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

import type { AppRequest } from '../http/response';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' },
});

export function corsMiddleware(origins: string[]) {
  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origins.includes(origin)) return callback(null, true);
      callback(new Error('CORS policy: origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-Request-ID',
      'Idempotency-Key',
      'Accept',
      'Origin',
    ],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  });
}

export function requestLoggerMiddleware(
  logger: (msg: string, meta: Record<string, unknown>) => void,
): (req: AppRequest, res: Response, next: NextFunction) => void {
  return (req: AppRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    res.on('finish', () => {
      logger('HTTP request', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startTime,
        correlationId: req.correlationId ?? 'unknown',
      });
    });
    next();
  };
}
