# Security Review (Phase 10)

Verified: broken access control (owner checks on every session op), IDOR/BOLA
(404-safe foreign access, tested A→B), privilege escalation (strict-schemas +
repository allowlist reject `roles/status`), mass assignment (`.strict()` +
explicit field mapping), account takeover (no email mutation endpoint; phone
OTP bound to user+phone hash), session hijacking/fixation (unpredictable UUID
ids, binding to verified `jti`, revocation kills both token halves),
stale sessions (TTL + `isActive` checks in middleware + refresh linkage),
sensitive exposure (DTO-only responses, redacted logs), enumeration (generic
OTP/forgot responses unchanged; 404-safe session access), brute force (Redis
limits: profile 30/min, phone 5/10min fail-closed, deactivate 5/h fail-closed,
session revoke 20/min), malicious input (Zod lengths, strict objects, UUID
params, cursor size cap).

Residual: raw JWT storage in `tokens` (Phase 9 design; hashing deferred with
rotation cutover plan), no device-anomaly detection (event stream exists for a
later worker), email-change workflow absent by design.
