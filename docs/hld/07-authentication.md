# 07 Authentication

JWT access 15m + rotating refresh (httpOnly/secure) + reuse-detect (family revoke) + session list/revoke + device meta + throttle + generic errors. RBAC roles → permissions; resource-authz owner/admin.
```mermaid
sequenceDiagram
  C->>A: POST /auth/login
  A->>R: limits + fails?
  A->>M: verify hash
  A->>M: session + family
  A-->>C: access + refresh
  C->>A: POST /auth/refresh (rotate)
  A->>A: reuse? revoke family + alert
```
Register→OTP verify; logout(-all)→denylist; reset→OTP→change→revoke-others.
