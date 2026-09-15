# Privacy

Classification for user/session responses:

| Class              | Examples                                | Exposure                                          |
| ------------------ | --------------------------------------- | ------------------------------------------------- |
| Public             | name, display profile                   | Own profile only (no public directory)            |
| Private            | email, phone, preferences               | Owner only, authenticated                         |
| Sensitive          | passwordHash, OTPs, raw tokens          | Never in responses, never in logs                 |
| Security-sensitive | token jtis, session internals, IP exact | Never in responses; coarse `device/platform` only |

Session DTOs expose `sessionId, device (truncated UA ≤120), platform
(derived enum), createdAt, lastUsedAt, expiresAt, current`. No raw tokens, no
token hashes, no exact IPs, no full user-agent strings beyond the truncated
device label required by the session-list UX.
