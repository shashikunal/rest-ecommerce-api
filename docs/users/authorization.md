# Authorization

`src/shared/authorization`: `permissions.ts` (Role → Permission map) +
`authorization.ts` (`requireRole`, `requirePermission`, ownership guards).

Roles: `CUSTOMER, STAFF, SUPPORT, ADMIN, SYSTEM`. Legacy Phase 9 role strings
(`user, admin, ...`) normalize via aliases, so existing tokens keep working.

```text
Role → Permissions → Resource/action
ADMIN → users:suspend, refunds:approve, ... → all resources
SUPPORT → users:read, refunds:initiate (capped) → read-only + capped refunds
STAFF → orders:update, inventory:adjust → fulfilment scope
CUSTOMER → products:read, orders:read → own resources only
```

Resource rule (per `docs/api/authorization.md`): every `:id` route checks
`resource.userId == sub`; cross-user access returns **404** where enumeration
matters (sessions), else **403**. Session revocation uses 404-safe checks;
profile/preference writes are self-scoped by construction (`req.user.id`).
