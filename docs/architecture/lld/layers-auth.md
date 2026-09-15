# Layers + Auth + OTP + Authorization (implementation-level, design only)

## Token/session design
Access JWT (15m): `{sub, sid, roles, ver, iat, exp}`; signed HS256/RS256 via secret manager; validated per request (sig+exp+sid-active+ver-match). Refresh: opaque token → `{familyId, tokenHash(SHA256), userId, sid, expiresAt(30d), rotatedTo, revoked}` persisted in sessions; rotation issues new pair + marks old used; reuse of used token → revoke whole family + security event + notify user. Logout: revoke sid; logout-all: revoke all sids + bump `tokenVer`. Lockout: 5 fails/15m per IP+account → 429 generic.
Never store passwords/OTP/raw refresh; only argon2id/bcrypt hashes + SHA256 token/OTP hashes.

## OTP design
Generate crypto 6-digit → SHA256 → Redis `otp:{purpose}:{contactHash}` {hash, attempts, resends, expires 5–10m} + `otp:att:{id}` counter; send via async mail; verify constant-time compare, ≤5 attempts, ≤3 resends + 60s cooldown; success → single-use delete + emit otp.verified; purposes EMAIL_VERIFICATION/LOGIN/PASSWORD_RESET/PHONE_VERIFICATION strictly isolated; generic responses anti-enumeration; abuse monitor on resend/attempt spikes.

## Authorization
Middleware order: authN (extract+validate) → load session/roles → RBAC (role→permissions matrix) → resource policy (owner-check: `resource.userId==sub || admin`; staff/support scoped actions e.g. support:refund ≤ policy cap, no config). All enforced server-side in AppService policies, never frontend-only. Admin routes additionally rate-limited + audited.
