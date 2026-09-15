# Search Suggestions & Typeahead Architecture

## 1. Overview
The typeahead suggestion endpoint (`GET /api/v1/products/suggestions?q=iph&limit=8`) provides real-time autocomplete suggestions as the user types in the storefront search bar.

---

## 2. Multi-Entity Matching
Suggestions are extracted from three indexed catalog dimensions:
1. **Product Titles**: e.g., `"Apple iPhone 15 Pro"`, `"Apple iPhone 13"`.
2. **Brand Names**: e.g., `"Apple"`, `"Google"`.
3. **Category Names**: e.g., `"Smartphones"`, `"Electronics"`.

Suggestions are deduplicated and limited to `1..10` items (default: 8).

---

## 3. Security & Anti-Abuse Protections
Because autocomplete triggers on every keystroke:
1. **Dedicated Rate Limiting**: Clamped to 120 requests/minute per IP (`rl:search_sug` policy).
2. **Minimum Prefix Length**: Requests with queries shorter than 2 characters immediately return `[]` without querying the database or cache.
3. **Cache Strategy**: Results are cached in Redis with a 60-second TTL under `suggest:v1:{normalizedQuery}:{limit}`.
4. **Information Hiding**: Only public, published titles/brands/categories are suggested. No internal IDs, draft products, or inventory levels are exposed.
