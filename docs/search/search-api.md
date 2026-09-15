# Search API Specification

## Endpoints

### 1. Search Products
`GET /api/v1/products/search`

Public endpoint for querying published products with multi-dimensional filtering, stable cursor pagination, and relevance ranking.

#### Query Parameters
| Parameter | Type | Required | Description | Constraints / Examples |
|---|---|---|---|---|
| `q` or `query` | string | No | Search query text | Max 100 chars, trimmed & normalized |
| `category` | string | No | Category slug | Hierarchical prefix matching supported |
| `categoryId` | string | No | Category ID | Matches exact category ID |
| `brand` | string | No | Brand slug | e.g. `apple`, `google` |
| `brandId` | string | No | Brand ID | UUID format |
| `attributes` | string / string[] | No | Attribute filters | Repeatable: `key:val1,val2`. AND across keys, OR across values |
| `minPrice` | number | No | Minimum price | Major currency units (e.g. `49.99`). Non-negative |
| `maxPrice` | number | No | Maximum price | Major currency units. Must be >= minPrice |
| `availability` | string | No | Stock availability | `in_stock`, `out_of_stock`, `unknown` |
| `sort` | string | No | Sort order | `relevance` (default when q present), `price_asc`, `price_desc`, `newest` (default when q absent), `name_asc` |
| `limit` | integer | No | Results per page | 1 to 50, default: 20 |
| `cursor` | string | No | Next page cursor | HMAC-SHA256 signed opaque cursor |

#### Response Schema (HTTP 200)
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "123e4567-e89b-42d3-a456-426614174013",
        "slug": "iphone-15-pro",
        "title": "Apple iPhone 15 Pro",
        "description": "A17 Pro titanium flagship smartphone",
        "shortDescription": "Titanium flagship",
        "brand": { "id": "brand-apple", "name": "Apple", "slug": "apple" },
        "category": { "id": "cat-flagships", "name": "Flagship Smartphones", "slug": "flagships" },
        "searchableAttributes": { "os": "ios" },
        "variants": [
          {
            "sku": "IPH15-TIT-128",
            "attrs": { "storage": "128gb", "color": "titanium" },
            "price": { "minor": 99900, "currency": "USD" },
            "availability": "UNKNOWN"
          }
        ],
        "catalogPrice": { "minor": 99900, "currency": "USD" },
        "media": [],
        "status": "published",
        "createdAt": "2026-09-15T12:00:00.000Z",
        "updatedAt": "2026-09-15T12:00:00.000Z",
        "score": 100
      }
    ],
    "pagination": {
      "limit": 20,
      "nextCursor": "eyJib2R5Ijoie...iIsInNpZyI6Ij..." ,
      "hasMore": false
    },
    "metadata": {
      "query": "iphone",
      "normalizedQuery": "iphone",
      "sort": "relevance",
      "total": null,
      "totalRelation": "not_computed",
      "provider": "mongodb-catalog-search",
      "cached": false
    }
  },
  "correlationId": "035a5bba-6316-4c62-9eb3-a832511fc9b3"
}
```

---

### 2. Search Suggestions (Autocomplete)
`GET /api/v1/products/suggestions`

Public low-latency typeahead suggestion endpoint.

#### Query Parameters
| Parameter | Type | Required | Description | Constraints |
|---|---|---|---|---|
| `q` | string | Yes | Query prefix | Min 2 chars, max 100 chars |
| `limit` | integer | No | Max suggestions | 1 to 10, default: 8 |

#### Response Schema (HTTP 200)
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "Apple iPhone 15 Pro",
      "Apple iPhone 13",
      "Apple"
    ],
    "metadata": {
      "query": "iph",
      "cached": false,
      "provider": "mongodb-catalog-search"
    }
  },
  "correlationId": "efb8338e-9ff1-4182-b329-6c9d4c79c200"
}
```
