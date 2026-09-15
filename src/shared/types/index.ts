export interface PaginationParams {
  cursor: string | null;
  limit: number;
  sort: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  correlationId?: string;
}

export interface PaginatedQuery {
  cursor?: string;
  limit?: string;
  sort?: string;
}

export function parsePagination(
  query: Record<string, unknown>,
  defaultLimit: number = 20,
  maxLimit: number = 50,
): PaginationParams {
  const cursor = (query.cursor as string) ?? null;
  const limit = Math.min(Math.max(Number(query.limit) || defaultLimit, 1), maxLimit);
  const sort = (query.sort as string) ?? null;

  return { cursor, limit, sort };
}

export function validateCursor(cursor: string | null): boolean {
  if (!cursor) return true;
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    return decoded.length > 0;
  } catch {
    return false;
  }
}
