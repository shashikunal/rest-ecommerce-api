# Security Review (Phase 11)

Verified: RBAC via centralized `requirePermission` (no inline role strings);
customer mutations → 403, anonymous → 401; strict Zod schemas reject mass
assignment (`status/version/id` unrepresentable) and oversized/malformed input
(500→400 budget: unknown fields stripped → 400); UUID params; cursor size cap
and `INVALID_CURSOR` mapping; NoSQL-operator-free filters (allowlisted fields
only, no `$` passthrough); media type/size/owner validation with server-side
key generation; rate limits (reads 60/m, writes 60/m, upload 10/h
fail-closed); audit log on every mutation with actor/action/resource (no
secrets); DTOs exclude internals; ETag/Cache-Control on public GETs only;
unique-index backstops for SKU/slug races.
