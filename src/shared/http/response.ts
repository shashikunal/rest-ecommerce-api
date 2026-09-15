import type { Request, Response, NextFunction } from 'express';

import { HTTP_STATUS } from '../errors/http-status';

export interface AppRequest extends Request {
  correlationId?: string;
  requestId?: string;
  userId?: string;
}

export function sendSuccessResponse<T>(
  res: Response,
  data: T,
  statusCode: number = HTTP_STATUS.OK,
): void {
  const correlationId = (res.locals as Record<string, unknown>).correlationId as string | undefined;
  res.status(statusCode).json({ success: true, data, correlationId });
}

export function sendErrorResponse(res: Response, error: any): void {
  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details ?? {},
      correlationId: error.correlationId,
    },
  });
}

export function sendUnexpectedResponse(res: Response, err: Error): void {
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      code: 'INTERNAL',
      message: 'An unexpected error occurred',
      details: {},
      correlationId: undefined,
    },
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
