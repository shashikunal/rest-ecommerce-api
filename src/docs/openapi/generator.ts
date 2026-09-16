import type { EnvConfig } from '../../config/env';
import type { Logger } from '../../config/logger';

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact: { name: string; url: string };
  };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
    parameters: Record<string, unknown>;
    responses: Record<string, unknown>;
  };
  tags: Array<{ name: string; description: string }>;
  security: Array<Record<string, unknown>>;
}

export function generateOpenApiSpec(config: EnvConfig): OpenAPISpec {
  return {
    openapi: '3.1.0',
    info: {
      title: 'REST Mock APIs - E-Commerce Platform',
      description: 'Production-grade e-commerce platform - Modular Monolith, Vercel-first',
      version: '1.0.0',
      contact: { name: 'API Support', url: config.API_BASE_URL },
    },
    servers: [
      { url: config.API_BASE_URL, description: 'Development server' },
      { url: '/api/v1', description: 'API v1' },
    ],
    paths: {
      '/api/v1/users/me': {
        get: {
          tags: ['Users'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/CorrelationIdHeader' }],
          responses: {
            '200': {
              description: 'Current user profile',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', const: true },
                      data: { $ref: '#/components/schemas/UserProfile' },
                      correlationId: { type: 'string' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
        patch: {
          tags: ['Users'],
          summary: 'Update current user profile',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/CorrelationIdHeader' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateProfileRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated profile',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', const: true },
                      data: { $ref: '#/components/schemas/UserProfile' },
                      correlationId: { type: 'string' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '409': {
              description: 'Concurrent update conflict',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '422': { $ref: '#/components/responses/BadRequest' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/api/v1/users/me/preferences': {
        get: {
          tags: ['Users'],
          summary: 'Get notification preferences',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'User preferences' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        patch: {
          tags: ['Users'],
          summary: 'Update notification preferences',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdatePreferencesRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Updated preferences' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '422': { $ref: '#/components/responses/BadRequest' },
          },
        },
      },
      '/api/v1/users/me/sessions': {
        get: {
          tags: ['Users'],
          summary: 'List active sessions (cursor paginated)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: '#/components/parameters/CursorParam' },
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/CorrelationIdHeader' },
          ],
          responses: {
            '200': {
              description: 'Active sessions with current flag',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SessionList' },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/api/v1/users/me/sessions/{sessionId}': {
        delete: {
          tags: ['Users'],
          summary: 'Revoke a session (owner only, idempotent)',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            { $ref: '#/components/parameters/CorrelationIdHeader' },
          ],
          responses: {
            '200': { description: 'Session revoked' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/users/me/sessions/revoke-others': {
        post: {
          tags: ['Users'],
          summary: 'Revoke all sessions except current',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Other sessions revoked' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/v1/users/me/deactivate': {
        post: {
          tags: ['Users'],
          summary: 'Deactivate own account (soft, revokes sessions)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Account deactivated' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/api/v1/products/search': {
        get: {
          tags: ['Search'],
          summary: 'Search published products with filtering and cursor pagination',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'categoryId', in: 'query', schema: { type: 'string' } },
            { name: 'brand', in: 'query', schema: { type: 'string' } },
            { name: 'brandId', in: 'query', schema: { type: 'string' } },
            {
              name: 'attributes',
              in: 'query',
              schema: { type: 'string' },
              description: 'key:value1,value2; repeat for AND semantics',
            },
            { name: 'minPrice', in: 'query', schema: { type: 'number', minimum: 0 } },
            { name: 'maxPrice', in: 'query', schema: { type: 'number', minimum: 0 } },
            {
              name: 'availability',
              in: 'query',
              schema: { type: 'string', enum: ['unknown', 'in_stock', 'out_of_stock'] },
            },
            {
              name: 'sort',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['relevance', 'price_asc', 'price_desc', 'newest', 'name_asc'],
              },
            },
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/CursorParam' },
          ],
          responses: {
            '200': {
              description: 'Search results',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/SearchResult' } },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/api/v1/products/suggestions': {
        get: {
          tags: ['Search'],
          summary: 'Product search suggestions',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: true,
              schema: { type: 'string', minLength: 2, maxLength: 100 },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 10, default: 8 },
            },
          ],
          responses: {
            '200': { description: 'Suggestions' },
            '400': { $ref: '#/components/responses/BadRequest' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/api/v1/products': {
        get: {
          tags: ['Catalog'],
          summary: 'List published products (cursor paginated)',
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'brand', in: 'query', schema: { type: 'string' } },
            {
              name: 'minPrice',
              in: 'query',
              schema: { type: 'number' },
              description: 'Minimum price in major units',
            },
            {
              name: 'maxPrice',
              in: 'query',
              schema: { type: 'number' },
              description: 'Maximum price in major units',
            },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            {
              name: 'sort',
              in: 'query',
              schema: { type: 'string', enum: ['price', '-price', 'createdAt', '-createdAt'] },
            },
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/CursorParam' },
            { $ref: '#/components/parameters/CorrelationIdHeader' },
          ],
          responses: {
            '200': {
              description: 'Published products',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ProductList' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
        post: {
          tags: ['Catalog'],
          summary: 'Create product (admin, draft)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/CreateProductRequest' } },
            },
          },
          responses: {
            '201': { description: 'Product created' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '409': { description: 'Slug conflict' },
          },
        },
      },
      '/api/v1/products/{slug}': {
        get: {
          tags: ['Catalog'],
          summary: 'Get published product by slug',
          parameters: [
            { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
            { $ref: '#/components/parameters/CorrelationIdHeader' },
          ],
          responses: {
            '200': {
              description: 'Product detail',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ProductDetail' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/products/{id}/publish': {
        post: {
          tags: ['Catalog'],
          summary: 'Publish product (requires >=1 active variant)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Product published' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '422': { description: 'Not publishable or illegal transition' },
          },
        },
      },
      '/api/v1/products/{id}/unpublish': {
        post: {
          tags: ['Catalog'],
          summary: 'Unpublish product back to draft',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Product unpublished' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '422': { description: 'Illegal transition' },
          },
        },
      },
      '/api/v1/products/{id}/archive': {
        post: {
          tags: ['Catalog'],
          summary: 'Archive product (soft delete)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Product archived' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '422': { description: 'Illegal transition' },
          },
        },
      },
      '/api/v1/categories': {
        get: {
          tags: ['Catalog'],
          summary: 'Get category tree',
          responses: {
            '200': { description: 'Category tree' },
          },
        },
        post: {
          tags: ['Catalog'],
          summary: 'Create category (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '201': { description: 'Category created' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '409': { description: 'Slug conflict' },
          },
        },
      },
      '/api/v1/brands': {
        get: {
          tags: ['Catalog'],
          summary: 'List brands',
          responses: {
            '200': { description: 'Active brands' },
          },
        },
        post: {
          tags: ['Catalog'],
          summary: 'Create brand (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '201': { description: 'Brand created' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '409': { description: 'Slug conflict' },
          },
        },
      },
      '/api/v1/media/upload-url': {
        post: {
          tags: ['Catalog'],
          summary: 'Mint media upload URL (admin, 10/hour)',
          security: [{ bearerAuth: [] }],
          responses: {
            '201': { description: 'Upload URL minted' },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/v1/cart': {
        get: {
          tags: ['Cart'],
          summary: 'Get current cart (display snapshots, stale-price flags)',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/CorrelationIdHeader' }],
          responses: {
            '200': {
              description: 'Cart view',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CartView' },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
        delete: {
          tags: ['Cart'],
          summary: 'Clear cart (empties items, preserves identity)',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdempotencyKeyHeader' }],
          responses: {
            '200': { description: 'Cart cleared' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '409': { description: 'Version conflict or idempotency conflict' },
          },
        },
      },
      '/api/v1/cart/items': {
        post: {
          tags: ['Cart'],
          summary: 'Add item by sku (or productId/variantId); duplicates merge quantities',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdempotencyKeyHeader' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AddCartItemRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Item merged into existing line' },
            '201': { description: 'Item added as new line' },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '409': { description: 'Version conflict or idempotency conflict' },
            '422': { description: 'SKU unavailable or limit exceeded' },
          },
        },
      },
      '/api/v1/cart/items/{itemId}': {
        patch: {
          tags: ['Cart'],
          summary: 'Update item quantity (optimistic concurrency via expectedVersion)',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'itemId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            { $ref: '#/components/parameters/IdempotencyKeyHeader' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateCartItemRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Quantity updated' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Stale version (CART_STALE)' },
          },
        },
        delete: {
          tags: ['Cart'],
          summary: 'Remove item from cart',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'itemId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            { $ref: '#/components/parameters/IdempotencyKeyHeader' },
          ],
          responses: {
            '200': { description: 'Item removed' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/wishlist': {
        get: {
          tags: ['Wishlist'],
          summary: 'List wishlist (cursor paginated, graceful unavailable states)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/CursorParam' },
          ],
          responses: {
            '200': { description: 'Wishlist page' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/v1/wishlist/items': {
        post: {
          tags: ['Wishlist'],
          summary: 'Add wishlist item (duplicate returns 200 existing, no 409)',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdempotencyKeyHeader' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AddWishlistItemRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Already saved (duplicate)' },
            '201': { description: 'Wishlist item added' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/v1/wishlist/items/{itemId}': {
        delete: {
          tags: ['Wishlist'],
          summary: 'Remove wishlist item',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'itemId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '204': { description: 'Wishlist item removed' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/wishlist/check': {
        get: {
          tags: ['Wishlist'],
          summary: 'Check whether a product/variant is saved',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'productId',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            { name: 'variantId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': { description: 'Saved status' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/v1/inventory/availability': {
        get: {
          tags: ['Inventory'],
          summary: 'Public stock availability for a SKU (safe subset only)',
          parameters: [
            { name: 'sku', in: 'query', required: true, schema: { type: 'string' } },
            { $ref: '#/components/parameters/CorrelationIdHeader' },
          ],
          responses: {
            '200': {
              description: 'Availability status',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/InventoryAvailability' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/api/v1/inventory': {
        get: {
          tags: ['Inventory'],
          summary: 'List inventory records (staff/admin, cursor paginated)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'sku', in: 'query', schema: { type: 'string' } },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] },
            },
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/CursorParam' },
          ],
          responses: {
            '200': { description: 'Inventory page' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
        post: {
          tags: ['Inventory'],
          summary: 'Initialize inventory for a variant (idempotent by SKU)',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdempotencyKeyHeader' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InitInventoryRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Inventory already exists' },
            '201': { description: 'Inventory initialized' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/api/v1/inventory/adjust': {
        post: {
          tags: ['Inventory'],
          summary: 'Adjust on-hand stock by delta (never direct set)',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdempotencyKeyHeader' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdjustInventoryRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Stock adjusted' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '422': { description: 'Adjustment violates stock invariants' },
          },
        },
      },
      '/api/v1/inventory/{id}': {
        get: {
          tags: ['Inventory'],
          summary: 'Get inventory record by id or SKU (staff/admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Inventory record',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/InventoryRecord' },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/inventory/{id}/movements': {
        get: {
          tags: ['Inventory'],
          summary: 'List immutable stock movements (staff/admin, cursor paginated)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/CursorParam' },
          ],
          responses: {
            '200': { description: 'Movement page' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/inventory/reservations': {
        post: {
          tags: ['Inventory'],
          summary: 'Reserve stock (atomic conditional update, idempotencyKey required)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReserveStockRequest' },
              },
            },
          },
          responses: {
            '201': { description: 'Stock reserved' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Insufficient stock or idempotency conflict' },
          },
        },
      },
      '/api/v1/inventory/reservations/{id}': {
        get: {
          tags: ['Inventory'],
          summary: 'Get reservation by id (staff/admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': { description: 'Reservation' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/inventory/reservations/{id}/release': {
        post: {
          tags: ['Inventory'],
          summary: 'Release a reservation (idempotent)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': { description: 'Reservation released (or already terminal)' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/inventory/reservations/{id}/confirm': {
        post: {
          tags: ['Inventory'],
          summary: 'Confirm a reservation: reserved stock becomes sold (idempotent)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': { description: 'Reservation confirmed (or already confirmed)' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Reservation is released/expired and cannot be confirmed' },
          },
        },
      },
      '/api/v1/inventory/reservations/expire-sweep': {
        post: {
          tags: ['Inventory'],
          summary: 'Expire due reservations in a bounded batch (admin/system worker boundary)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Sweep summary {scanned, expired, failed}' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/api/v1/checkout': {
        post: {
          tags: ['Checkout'],
          summary:
            'Create checkout from cart (snapshot + validate + price, no inventory side effects)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: '#/components/parameters/IdempotencyKeyHeader' },
            { $ref: '#/components/parameters/CorrelationIdHeader' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateCheckoutRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Checkout replayed for Idempotency-Key' },
            '201': { description: 'Checkout created (status priced)' },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '409': { description: 'Idempotency conflict' },
            '422': { description: 'Cart empty or item unavailable' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
        get: {
          tags: ['Checkout'],
          summary: 'List own checkouts (cursor paginated)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/CursorParam' },
          ],
          responses: {
            '200': { description: 'Checkout page' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/api/v1/checkout/expire-sweep': {
        post: {
          tags: ['Checkout'],
          summary: 'Expire due checkouts and release reservations (admin/system worker boundary)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Sweep summary {scanned, expired, failed}' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/api/v1/checkout/{id}': {
        get: {
          tags: ['Checkout'],
          summary: 'Get own checkout by id',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Checkout',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Checkout' },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/checkout/{id}/validate': {
        post: {
          tags: ['Checkout'],
          summary: 'Revalidate checkout against cart and catalog (dry run, marks failed on issues)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { $ref: '#/components/parameters/IdempotencyKeyHeader' },
          ],
          responses: {
            '200': { description: 'Validation result {checkout, ok, issues}' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Stale state or expired checkout' },
            '422': { description: 'Validation issues found (checkout marked failed)' },
          },
        },
      },
      '/api/v1/checkout/{id}/reserve': {
        post: {
          tags: ['Checkout'],
          summary: 'Reserve inventory for all lines with compensation (→ ready)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { $ref: '#/components/parameters/IdempotencyKeyHeader' },
          ],
          responses: {
            '200': { description: 'Checkout ready for order' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Insufficient stock, cart/price drift, or conflict' },
            '422': { description: 'Item unavailable' },
          },
        },
      },
      '/api/v1/checkout/{id}/address': {
        patch: {
          tags: ['Checkout'],
          summary: 'Replace address snapshot (version-guarded, priced/reserved/ready only)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { $ref: '#/components/parameters/IdempotencyKeyHeader' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateCheckoutAddressRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Address snapshot replaced' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Stale version or illegal state' },
          },
        },
      },
      '/api/v1/checkout/{id}/cancel': {
        post: {
          tags: ['Checkout'],
          summary: 'Cancel checkout and release reservations (idempotent)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { $ref: '#/components/parameters/IdempotencyKeyHeader' },
          ],
          responses: {
            '200': { description: 'Checkout cancelled (or already cancelled)' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Terminal state conflict or expired' },
          },
        },
      },
    },
    components: {
      schemas: {
        SearchResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'object',
              properties: {
                items: { type: 'array', items: { $ref: '#/components/schemas/SearchProduct' } },
                pagination: { type: 'object' },
                metadata: { type: 'object' },
              },
            },
          },
        },
        SearchProduct: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            slug: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            brand: { type: ['object', 'null'] },
            category: { type: ['object', 'null'] },
            variants: { type: 'array' },
            catalogPrice: { type: 'object' },
            media: { type: 'array' },
            score: { type: 'number' },
          },
        },
        ProductList: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'object',
              properties: {
                data: { type: 'array', items: { $ref: '#/components/schemas/ProductDetail' } },
                pagination: {
                  type: 'object',
                  properties: {
                    limit: { type: 'integer' },
                    nextCursor: { type: ['string', 'null'] },
                    hasMore: { type: 'boolean' },
                  },
                },
              },
            },
            correlationId: { type: 'string' },
          },
        },
        ProductDetail: {
          type: 'object',
          required: ['id', 'slug', 'title'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            slug: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            brand: { type: ['object', 'null'] },
            category: { type: ['object', 'null'] },
            variants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sku: { type: 'string' },
                  attrs: { type: 'object' },
                  price: { type: 'object' },
                  availability: { type: 'string' },
                },
              },
            },
            media: { type: 'array' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateProductRequest: {
          type: 'object',
          required: ['title', 'description', 'categoryId'],
          properties: {
            title: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            categoryId: { type: 'string', format: 'uuid' },
            brandId: { type: 'string', format: 'uuid' },
            attrs: { type: 'object' },
            media: { type: 'array' },
            seo: { type: 'object' },
          },
        },
        CartView: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                status: { type: 'string', enum: ['active', 'converted', 'expired'] },
                items: { type: 'array' },
                itemCount: { type: 'integer' },
                subtotalMinor: { type: 'integer' },
                currency: { type: ['string', 'null'] },
                version: { type: 'integer' },
                hasStalePrices: { type: 'boolean' },
                hasUnavailableItems: { type: 'boolean' },
              },
            },
          },
        },
        AddCartItemRequest: {
          type: 'object',
          properties: {
            sku: { type: 'string', description: 'Variant SKU (preferred)' },
            productId: { type: 'string', format: 'uuid' },
            variantId: { type: 'string', format: 'uuid' },
            qty: { type: 'integer', minimum: 1, maximum: 50 },
            quantity: { type: 'integer', minimum: 1, maximum: 50 },
            expectedVersion: { type: 'integer' },
          },
        },
        UpdateCartItemRequest: {
          type: 'object',
          required: ['expectedVersion'],
          properties: {
            qty: { type: 'integer', minimum: 1, maximum: 50 },
            quantity: { type: 'integer', minimum: 1, maximum: 50 },
            expectedVersion: { type: 'integer', description: 'Optimistic concurrency version' },
          },
        },
        AddWishlistItemRequest: {
          type: 'object',
          properties: {
            sku: { type: 'string' },
            productId: { type: 'string', format: 'uuid' },
            variantId: { type: 'string', format: 'uuid' },
          },
        },
        InventoryAvailability: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'object',
              required: ['sku', 'available', 'status'],
              properties: {
                sku: { type: 'string' },
                available: { type: 'boolean' },
                status: { type: 'string', enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] },
              },
            },
          },
        },
        InventoryRecord: {
          type: 'object',
          required: ['id', 'sku', 'onHand', 'reserved', 'sold', 'available', 'status'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            sku: { type: 'string' },
            productId: { type: 'string', format: 'uuid' },
            variantId: { type: 'string', format: 'uuid' },
            onHand: { type: 'integer', minimum: 0 },
            reserved: { type: 'integer', minimum: 0 },
            sold: { type: 'integer', minimum: 0 },
            available: { type: 'integer', minimum: 0 },
            lowStockThreshold: { type: 'integer', minimum: 0 },
            status: { type: 'string', enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] },
            version: { type: 'integer' },
          },
        },
        InitInventoryRequest: {
          type: 'object',
          properties: {
            sku: { type: 'string' },
            productId: { type: 'string', format: 'uuid' },
            variantId: { type: 'string', format: 'uuid' },
            initialOnHand: { type: 'integer', minimum: 0, maximum: 1000000 },
            lowStockThreshold: { type: 'integer', minimum: 0, maximum: 1000000 },
          },
        },
        AdjustInventoryRequest: {
          type: 'object',
          required: ['delta', 'reason'],
          properties: {
            sku: { type: 'string' },
            inventoryId: { type: 'string', format: 'uuid' },
            delta: { type: 'integer', minimum: -1000000, maximum: 1000000 },
            reason: {
              type: 'string',
              enum: [
                'RECEIPT',
                'DAMAGE',
                'LOSS',
                'RETURN',
                'TRANSFER_IN',
                'TRANSFER_OUT',
                'CYCLE_COUNT',
                'MANUAL_CORRECTION',
              ],
            },
            referenceType: { type: 'string' },
            referenceId: { type: 'string' },
            idempotencyKey: { type: 'string' },
          },
        },
        ReserveStockRequest: {
          type: 'object',
          required: ['sku', 'quantity', 'referenceType', 'referenceId', 'idempotencyKey'],
          properties: {
            sku: { type: 'string' },
            quantity: { type: 'integer', minimum: 1, maximum: 1000 },
            referenceType: { type: 'string' },
            referenceId: { type: 'string' },
            idempotencyKey: { type: 'string', format: 'uuid' },
            ttlSeconds: { type: 'integer', minimum: 60, maximum: 3600 },
          },
        },
        CheckoutAddress: {
          type: 'object',
          required: ['fullName', 'line1', 'city', 'region', 'postalCode', 'country'],
          properties: {
            fullName: { type: 'string', maxLength: 120 },
            phone: { type: ['string', 'null'], maxLength: 32 },
            line1: { type: 'string', maxLength: 200 },
            line2: { type: ['string', 'null'], maxLength: 200 },
            city: { type: 'string', maxLength: 120 },
            region: { type: 'string', maxLength: 120 },
            postalCode: { type: 'string', maxLength: 32 },
            country: { type: 'string', minLength: 2, maxLength: 2 },
          },
        },
        CreateCheckoutRequest: {
          type: 'object',
          required: ['shippingAddress'],
          properties: {
            shippingAddress: { $ref: '#/components/schemas/CheckoutAddress' },
            billingAddress: { $ref: '#/components/schemas/CheckoutAddress' },
            couponCode: { type: ['string', 'null'], maxLength: 64 },
          },
        },
        UpdateCheckoutAddressRequest: {
          type: 'object',
          required: ['shippingAddress', 'expectedVersion'],
          properties: {
            shippingAddress: { $ref: '#/components/schemas/CheckoutAddress' },
            billingAddress: { $ref: '#/components/schemas/CheckoutAddress' },
            expectedVersion: { type: 'integer', minimum: 0 },
          },
        },
        Checkout: {
          type: 'object',
          required: ['id', 'status', 'items', 'pricing', 'currency', 'version'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: ['priced', 'reserved', 'ready', 'completed', 'failed', 'expired', 'cancelled'],
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  variantId: { type: 'string', format: 'uuid' },
                  sku: { type: 'string' },
                  title: { type: 'string' },
                  quantity: { type: 'integer' },
                  unitMinor: { type: 'integer' },
                  currency: { type: 'string' },
                  lineTotalMinor: { type: 'integer' },
                },
              },
            },
            pricing: {
              type: 'object',
              properties: {
                subtotalMinor: { type: 'integer' },
                discountMinor: { type: 'integer' },
                shippingMinor: { type: 'integer' },
                taxMinor: { type: 'integer' },
                grandTotalMinor: { type: 'integer' },
                currency: { type: 'string' },
                couponCode: { type: ['string', 'null'] },
              },
            },
            currency: { type: 'string' },
            shippingAddress: { $ref: '#/components/schemas/CheckoutAddress' },
            billingAddress: { $ref: '#/components/schemas/CheckoutAddress' },
            reservations: { type: 'array' },
            cartId: { type: 'string', format: 'uuid' },
            cartVersion: { type: 'integer' },
            version: { type: 'integer' },
            expiresAt: { type: 'string', format: 'date-time' },
            failReason: { type: ['string', 'null'] },
            orderId: { type: ['string', 'null'] },
          },
        },
        UserProfile: {
          type: 'object',
          required: ['id', 'email', 'name', 'status', 'roles'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            phoneVerified: { type: 'boolean' },
            status: {
              type: 'string',
              enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED'],
            },
            roles: { type: 'array', items: { type: 'string' } },
            emailVerified: { type: 'boolean' },
            preferences: { $ref: '#/components/schemas/UserPreferences' },
            version: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        UserPreferences: {
          type: 'object',
          properties: {
            marketingEmails: { type: 'boolean' },
            orderNotifications: { type: 'boolean' },
            securityNotifications: { type: 'boolean', const: true },
            pushNotifications: { type: 'boolean' },
            smsNotifications: { type: 'boolean' },
            language: { type: 'string' },
            currency: { type: 'string' },
          },
        },
        UpdateProfileRequest: {
          type: 'object',
          properties: {
            firstName: { type: 'string', maxLength: 100 },
            lastName: { type: 'string', maxLength: 100 },
            name: { type: 'string', maxLength: 100 },
            version: { type: 'integer', description: 'Optimistic concurrency version' },
          },
        },
        UpdatePreferencesRequest: {
          type: 'object',
          properties: {
            marketingEmails: { type: 'boolean' },
            orderNotifications: { type: 'boolean' },
            pushNotifications: { type: 'boolean' },
            smsNotifications: { type: 'boolean' },
            language: { type: 'string' },
            currency: { type: 'string' },
            version: { type: 'integer' },
          },
        },
        SessionList: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'object',
              properties: {
                sessions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      sessionId: { type: 'string', format: 'uuid' },
                      device: { type: 'string' },
                      platform: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                      lastUsedAt: { type: 'string', format: 'date-time' },
                      expiresAt: { type: 'string', format: 'date-time' },
                      current: { type: 'boolean' },
                    },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    limit: { type: 'integer' },
                    nextCursor: { type: ['string', 'null'] },
                    hasMore: { type: 'boolean' },
                  },
                },
              },
            },
            correlationId: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { type: 'boolean', const: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
                correlationId: { type: 'string' },
              },
            },
          },
        },
        ValidationError: {
          allOf: [{ $ref: '#/components/schemas/Error' }],
          properties: {
            error: {
              properties: {
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      code: { type: 'string' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token for authenticated endpoints',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'HttpOnly secure refresh token (browser only)',
        },
        webhookSig: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Signature',
          description: 'HMAC signature for webhook verification',
        },
      },
      parameters: {
        CursorParam: {
          name: 'cursor',
          in: 'query',
          schema: { type: 'string' },
          description: 'Opaque cursor for pagination',
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          description: 'Number of results per page',
        },
        CorrelationIdHeader: {
          name: 'X-Correlation-ID',
          in: 'header',
          schema: { type: 'string', format: 'uuid' },
          description: 'Correlation ID for request tracing',
        },
        IdempotencyKeyHeader: {
          name: 'Idempotency-Key',
          in: 'header',
          schema: { type: 'string', format: 'uuid' },
          description: 'Idempotency key for safe retries',
        },
      },
      responses: {
        BadRequest: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        Forbidden: {
          description: 'Access denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        RateLimited: {
          description: 'Rate limit exceeded',
          headers: {
            'Retry-After': { schema: { type: 'integer' } },
            'RateLimit-Limit': { schema: { type: 'integer' } },
            'RateLimit-Remaining': { schema: { type: 'integer' } },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication and authorization' },
      { name: 'Users', description: 'User management' },
      { name: 'Catalog', description: 'Products, categories, brands' },
      { name: 'Search', description: 'Product search, filtering, suggestions' },
      { name: 'Cart', description: 'Shopping cart (display snapshots, optimistic concurrency)' },
      { name: 'Wishlist', description: 'Saved items for later' },
      { name: 'Checkout', description: 'Checkout process' },
      { name: 'Orders', description: 'Order management' },
      { name: 'Payments', description: 'Payment processing' },
      { name: 'Inventory', description: 'Inventory management' },
      { name: 'Admin', description: 'Administrative operations' },
    ],
    security: [{ bearerAuth: {} }],
  };
}
