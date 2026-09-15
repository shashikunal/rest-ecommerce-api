# Preferences

`UserPreferences`: `marketingEmails, orderNotifications, securityNotifications,
pushNotifications, smsNotifications, language, currency`.

Rules:

- Defaults: marketing/sms off, transactional/push on, `en`/`USD`.
- `securityNotifications` is forced `true` on every merge — marketing opt-out
  never silences security mail. Separate channels for security, transactional,
  and marketing notifications.
- `language` allowlist: `en es fr de hi`; `currency`: `USD EUR GBP INR`.
  Unknown values yield `422 INVALID_PROFILE`, not silent coercion.
- Version-checked like profile updates (`409` on conflict).

No caching: profile/preference reads hit MongoDB directly. Correctness beats
latency here; the documents are tiny and indexed by `_id`.
