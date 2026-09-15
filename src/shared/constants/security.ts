export const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
export const HTTP_METHODS = new Set(SUPPORTED_METHODS);

export const ALLOWED_CONTENT_TYPES = ['application/json', 'application/vnd.api+json'];
export const MAX_BODY_SIZE = '100kb';

export const ALLOWED_SORT_FIELDS: Record<string, string[]> = {
  products: ['name', 'price', 'createdAt', 'updatedAt'],
  orders: ['createdAt', 'status', 'total'],
  users: ['name', 'email', 'createdAt'],
};

export const ALLOWED_FILTER_PARAMS = ['category', 'brand', 'status', 'minPrice', 'maxPrice'];
export const ALLOWED_SORT_PARAM = ['name', 'price', 'createdAt', '-name', '-price', '-createdAt'];
