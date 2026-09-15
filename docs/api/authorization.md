# Authorization Matrix (contract only; enforced server-side per LLD policies)

Roles: customer · staff (fulfilment) · support (read + policy-capped refunds) · admin · system/internal · webhook (HMAC, no JWT).

| Endpoint group | Public | Customer(+owner) | Staff | Support | Admin |
|---|---|---|---|---|---|
| Catalog browse/search | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cart/wishlist/addresses | — | ✓ owner only | — | — | — |
| Checkout/orders (own) | — | ✓ owner only | read-fulfil | read | ✓ |
| Order cancel (own, CREATED/PENDING only) | — | ✓ owner | — | — | ✓ |
| Returns request (own delivered) | — | ✓ owner | triage | triage | ✓ |
| Refund initiate | — | — | — | ≤cap | ✓ |
| Payments create (own order) | — | ✓ owner | — | — | — |
| Reviews create/update | — | ✓ owner (verified) | moderate | — | ✓ |
| Notifications/prefs | — | ✓ owner | — | — | — |
| Catalog/inventory/coupon/promo write | — | — | — | — | ✓ |
| Users read/write | — | self only | — | read | ✓ |
| Audit/analytics | — | — | — | — | ✓ |
| Webhooks `/webhooks/payment/{provider}` | HMAC only (no role) | — | — | — | — |

Resource rules: every `:id` route checks `resource.userId == sub || admin` (or scoped staff/support action); cross-user access → 404 (not 403) where enumeration matters (orders/sessions), else 403. Admin never bypasses validation/idempotency; all admin writes audited.
