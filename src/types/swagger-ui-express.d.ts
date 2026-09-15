declare module 'swagger-ui-express' {
  import type { RequestHandler } from 'express';
  export const serve: RequestHandler[];
  export function setup(
    spec: Record<string, unknown> | null,
    options?: Record<string, unknown>,
  ): RequestHandler;
}
