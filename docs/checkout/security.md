# Checkout — Security

- Ownership: every route derives `userId` from `req.user`; lookups are
  `(id + userId)` — foreign ids return 404, never 403 (no enumeration
  oracle). `userId/ownerId/customerId/cartId/items/pricing/reservations/
status/version` in bodies are rejected by strict schemas (mass-assignment
  safe); the only client-controlled version is `expectedVersion`.
- Price tampering impossible by construction: totals are computed server-side
  from catalog `priceRef`; any `price/subtotal/total/discount/tax/shipping`
  field → 400.
- Address ownership: no address book exists yet, so addresses are inline
  snapshots validated structurally (length caps, 2-letter country) and
  frozen at creation; later profile changes cannot mutate them. The
  `CheckoutAddressPort` is the seam where `addressId` resolution will land
  without changing the snapshot contract.
- Reservation manipulation: clients never see inventory ids or keys — only
  checkout-owned refs; all stock calls use server-derived
  `<checkoutId>:<sku>` idempotency keys.
- Abuse: `CHECKOUT` 10/min (pre-existing), strict zod bounds, integer-only
  money, NoSQL-safe parameterized queries, UUID-validated ids.
- Sweep: `requireRole('ADMIN', 'SYSTEM')`; no admin inspection surface beyond
  it (owner-only reads; §30 satisfied by RBAC + audit logs on mutations).
