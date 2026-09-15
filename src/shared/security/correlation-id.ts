import type { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { CORRELATION_ID_HEADER } from '../constants';
import type { AppRequest } from '../http/response';

const CORRELATION_ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_CORRELATION_ID_LENGTH = 64;

export function generateCorrelationId(): string {
  return uuidv4();
}
export function validateCorrelationId(id: string): boolean {
  return id.length <= MAX_CORRELATION_ID_LENGTH && CORRELATION_ID_PATTERN.test(id);
}

export function correlationIdMiddleware(req: AppRequest, res: Response, next: NextFunction): void {
  const raw = req.headers[CORRELATION_ID_HEADER];
  const incomingId = Array.isArray(raw) ? raw[0] : raw;
  const correlationId =
    incomingId && validateCorrelationId(incomingId) ? incomingId : generateCorrelationId();
  req.correlationId = correlationId;
  req.requestId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  res.locals.correlationId = correlationId;
  next();
}
