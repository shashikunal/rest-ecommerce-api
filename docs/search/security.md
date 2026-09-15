# Search Security & Threat Model

## 1. Threat Mitigation Matrix

| Threat / Attack Vector | Mitigation Strategy | Implementation Point |
|---|---|---|
| **NoSQL Operator Injection** (`attributes[$ne]=...`) | Strict Zod validation & type assertions | `catalog.validators.ts`, `search-normalization.ts` |
| **Query Oversizing / DoS** | Hard limit of 100 characters on search text | `normalizeSearchText` |
| **Deep Paging Memory Exhaustion** (`skip=100000`) | Prohibit offset pagination; enforce signed cursor | `decodeSearchCursor` |
| **Cursor Tampering / Privilege Escalation** | HMAC-SHA256 signature + timing-safe comparison | `signPayload`, `timingSafeEqual` |
| **Sort Field Injection** (`sort=__proto__`) | Strict whitelist of approved sort tokens | `normalizeSearchQuery` |
| **Draft / Hidden Product Enumeration** | Enforce `status: 'published'` across all search filters | `MongoProductSearchProvider` |
| **Bot Scraping / Excessive Traffic** | Redis token bucket rate limiting (60-120 req/min) | `rate-limiter.ts` |
| **Sensitive Field Leakage** | Explicit DTO mapping to `SearchProductDocument` | `toSearchDocument` |

---

## 2. In-Depth Injection Defense
HTTP request parameters are never passed directly to database queries:
- Query parameters are strictly parsed into primitive strings or numbers.
- Any object keys with leading `$` or containing `.` are rejected before database queries are formed.
- Prototype pollution attacks (`__proto__`, `constructor`) fail Zod schema checks with 400 Bad Request.
