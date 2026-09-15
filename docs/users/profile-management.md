# Profile Management

`GET /api/v1/users/me` returns `PublicProfile` — explicit DTO, never the Mongo
document. `passwordHash`, token hashes, and internal flags are unrepresentable
by construction (`toPublicProfile` picks fields).

```mermaid
flowchart TD
  Client --> A[Authenticate] --> Z[Authorize: self] --> V[Validate strict Zod]
  V --> S[UserService.updateProfile] --> D[Domain: trim, name sync, OCC]
  D --> R[userRepository.update allowlist] --> M[(MongoDB)]
  S --> E[USER_PROFILE_UPDATED event + audit log]
  E --> RES[200 PublicProfile + correlationId]
```

## Editable fields

`firstName`, `lastName`, `name` (explicit `name` wins; otherwise synced as
`"<first> <last>"` to keep Phase 9 `name` consumers working). Everything else —
`userId, roles, status, passwordHash, emailVerified, createdAt, security
metadata` — is rejected (400) or ignored by the repository allowlist.

## Email and phone

Email is immutable via this endpoint. Phone changes require the OTP workflow
(`POST /users/me/phone/request` → `POST /users/me/phone/verify`): the OTP
identifier binds `sha256(userId + phone)` so a code issued for one number
cannot verify another. OTP values are never logged or returned.
