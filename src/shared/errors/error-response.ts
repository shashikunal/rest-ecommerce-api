import type { AppError } from './app-error';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    correlationId: string | undefined;
  };
}

export function formatErrorResponse(error: AppError): ErrorResponse {
  const details = Object.entries(error.details).reduce(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {} as Record<string, unknown>,
  );

  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details,
      correlationId: error.correlationId,
    },
  };
}

export function formatUnexpectedError(error: Error, correlationId?: string): ErrorResponse {
  return {
    success: false,
    error: {
      code: 'INTERNAL',
      message: 'An unexpected error occurred',
      details: {},
      correlationId,
    },
  };
}
