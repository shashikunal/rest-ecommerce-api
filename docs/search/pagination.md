# Cursor Pagination Architecture & Security

## 1. Why Offset/Skip is Rejected for Search

Traditional SQL/NoSQL `OFFSET` (e.g. `skip=100000, limit=20`) suffers from two major flaws:
1. **Performance Degeneration (O(N))**: The database must scan through 100,000 documents, load them into memory, and discard them just to return 20 documents.
2. **Page Drift**: If products are inserted or deleted while a customer paginates, the offset window shifts, showing duplicate items or skipping products entirely.

---

## 2. Cryptographically Signed Cursor Design

The platform uses **opaque, signed cursor tokens**.

### Cursor Payload Structure
```typescript
export interface SearchCursorPayload {
  v: 1;
  sort: SearchSort;
  sortValue: string | number;
  productId: string;
  issuedAt: number;
}
```

### Tamper Protection via HMAC-SHA256
Raw cursors are never exposed directly to the client. The payload is serialized, HMAC-SHA256 signed with an internal secret, and encoded as base64url:
```typescript
function signPayload(payload: string): string {
  return createHash('sha256').update(`${payload}.${CURSOR_SECRET}`).digest('hex');
}

export function encodeSearchCursor(payload: Omit<SearchCursorPayload, 'v' | 'issuedAt'>): string {
  const body = JSON.stringify({ ...payload, v: 1, issuedAt: Date.now() });
  const sig = signPayload(body);
  return Buffer.from(JSON.stringify({ body, sig })).toString('base64url');
}
```

### Cursor Validation Guarantees
1. **Timing-Safe Verification**: `crypto.timingSafeEqual` prevents timing side-channel attacks on signatures.
2. **Sort Invariance**: If a client acquires a cursor with `sort=price_asc` and attempts to reuse it with `sort=price_desc`, the request is rejected with `INVALID_CURSOR`.
3. **Cursor Expiration**: Cursors expire after 6 hours (`cursorTtlMs: 21,600,000 ms`), preventing stale state references.
4. **Length Clamping**: Oversized cursor strings (> 500 chars) are immediately rejected.
