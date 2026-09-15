# Interview Prep — User + Session Management (Phase 10)

1. **AuthN vs AuthZ**: authentication proves identity (tokens); authorization
   decides access (roles + ownership). Separate middleware layers so a valid
   token alone never implies resource access.
2. **RBAC vs ABAC**: RBAC maps roles to permission sets (cheap, auditable);
   ABAC evaluates attributes per request (flexible, costly). We use RBAC for
   coarse gates plus ownership checks (a degenerate ABAC rule:
   `resource.userId == sub`).
3. **BOLA/IDOR**: accessing objects by id without ownership checks. Prevented
   by loading the resource and comparing `userId` to the principal; 404-safe
   responses avoid confirming existence.
4. **Mass assignment**: never `update(req.body)`. Strict Zod schemas plus an
   explicit service→repository field map; protected fields are unrepresentable.
5. **Server-revocable sessions**: pure stateless JWTs cannot be revoked before
   expiry. A server session record gives instant revocation (logout, theft,
   deactivation) at one DB lookup per request.
6. **JWT vs sessions**: JWTs scale verification; sessions give control. Hybrid:
   short access JWT + revocable server session + rotating refresh.
7. **Why a session record with JWT**: binds each token to a device context,
   enables per-device listing/revocation and anomaly detection.
8. **Rotation + sessions**: each refresh mints a linked successor session and
   revokes the predecessor; reuse of an old refresh token signals theft
   (`TOKEN_REUSED`) and should trigger family revocation + alert.
9. **Revoke-all**: single `updateMany` over user sessions plus token revocation;
   keep-current uses `_id != current` so the caller survives.
10. **Multi-device**: one session row per login; list shows `current` flag;
    per-device revoke without touching others.
11. **Hijacking**: short TTLs, rotation, binding to `jti`, revocation on
    signal, rate-limited auth endpoints; transport secured by TLS/HSTS.
12. **Concurrent revocation**: idempotent state transition (`isActive=false`);
    double-revoke converges without errors.
13. **Optimistic concurrency**: `version` per user; stale writes get 409 instead
    of silently clobbering — required when profile edits race deactivation.
14. **Indexes**: `{userId,isActive}` for lists, unique `tokenId`, sparse
    `refreshTokenId`, TTL on `expiresAt`, `{status}` for lifecycle queries.
15. **Cache policy**: don't cache profiles/sessions — tiny indexed reads,
    correctness-critical, invalidation bugs become security bugs.
16. **Deactivation vs deletion**: deactivation flips state and revokes access;
    deletion would destroy order/payment/audit history and violate retention.
17. **History survives**: orders snapshot buyer identity; user rows are retained
    (anonymized where required) so references never dangle.
18. **100M users**: shard `users` by `_id`, `sessions` by `userId`; read
    replicas for profile reads; Redis for limits/OTP only; cursor pagination
    everywhere; archive expired sessions.
19. **Suspicious sessions**: new device/country + velocity rules over the
    session event stream (worker, Phase 25) → step-up auth + `SESSION_REVOKED`.
20. **Monolith → services**: module boundaries (ports/adapters, no cross-imports
    of implementations) let users/sessions extract with only transport changes.
