# Authentication + Sessions + OTP APIs (contract only)

Hybrid token model (per LLD): access JWT in `Authorization: Bearer` (15m) + refresh in `HttpOnly; Secure; SameSite=Lax` cookie (`refreshToken`, 30d, path `/api/v1/auth`). CSRF: refresh/logout/rotation endpoints require `X-CSRF-Token` header matching `csrfToken` readable cookie (rotated per session); SameSite=Lax + Origin check. Access exposed only in memory on client; refresh never in JSON.

| Method + Path | Auth | Req | Resp | Limits | Notes |
|---|---|---|---|---|---|
| POST /auth/register | public | {email,password,firstName?,lastName?} | 201 {user{id,email,firstName,lastName,emailVerified:false}} + verification OTP mailed | 10/h/IP | generic 201 even if email exists? No — 409 EMAIL_EXISTS is allowed here (registration inherently reveals); password argon2id server-side |
| POST /auth/login | public | {email,password} | 200 {accessToken,expiresIn:900,user{…}} + refresh cookie | 5/15m IP+acct | generic 401 INVALID_CREDENTIALS; throttle; lockout flag after 5 |
| POST /auth/refresh | cookie | {csrfToken} via header | 200 new access + rotated refresh cookie | 30/m/session | reuse detected → 401 TOKEN_REUSED + whole family revoked + security mail |
| POST /auth/logout | customer | — | 204 + clear cookie | 30/m | revokes current sid |
| POST /auth/verify-email | customer | {otp} | 200 {emailVerified:true} | 5/OTP | EMAIL_VERIFICATION purpose, single-use |
| POST /auth/request-otp | public | {email,purpose: EMAIL_VERIFICATION\|LOGIN\|PASSWORD_RESET} | 200 {sent:true,cooldownSec:60} (always generic) | 4/10m/contact | anti-enumeration: identical response for unknown emails |
| POST /auth/verify-otp | public | {email,purpose,otp} | 200 purpose-dependent (verify flag or resetToken) | 5/OTP | invalidate on success; 410 OTP_EXPIRED; 429 OTP_LOCKED |
| POST /auth/forgot-password | public | {email} | 200 {sent:true} generic | 3/15m/acct | same anti-enumeration |
| POST /auth/reset-password | public | {resetToken,newPassword} | 204 + revoke-other-sessions | 5/h/acct | single-use token 15m |
| POST /auth/change-password | customer | {currentPassword,newPassword} | 204 + revoke-others + notify | 5/h | re-auth; 401 on mismatch (generic) |
| GET /sessions | customer | — | 200 [{id,current,device{ua,ip},lastActivity,createdAt}] | 60/m | never token hashes |
| DELETE /sessions/{id} | customer+owner | — | 204 | 30/m | owner or admin |
| POST /sessions/revoke-all | customer | — | 204 + bump tokenVer | 10/h | keeps current, revokes rest |

Error cases: 400 VALIDATION_ERROR (Zod) · 401 INVALID_CREDENTIALS/TOKEN_EXPIRED/TOKEN_REUSED · 404 SESSION_NOT_FOUND (owner-scoped, no leak) · 409 EMAIL_EXISTS · 410 OTP_EXPIRED · 422 OTP_INVALID (with attemptsLeft) · 429 + Retry-After everywhere above.
