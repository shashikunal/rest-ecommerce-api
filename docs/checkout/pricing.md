# Checkout — Pricing

Authoritative price always comes from the catalog (`priceRef.amountMinor`);
the cart display price and any client total are ignored. Creation resolves
every line fresh; `validate`/`reserve` re-resolve and fail the checkout on
any drift (`PRICE_CHANGED` carries the sku; the client rebuilds).

Money rules:

- Integer minor units end to end (`quantity × unitMinor`, summed). No floats,
  no client arithmetic, single currency per checkout (mixed → 409).
- `DefaultCheckoutPricing` computes `subtotal`; discount/shipping/tax are
  persisted as `0` — no approved logic exists to compute them, and none is
  invented here.

Future seams (Phase 20):

- `CheckoutPricingPort.price(lines, currency)` — coupon/tax/shipping engines
  implement this interface; the service already threads `couponCode` through
  (stored, zero price impact, clearly unvalidated).
- `pricing.couponCode` is client-supplied metadata today: accepted, stored,
  ignored by totals. Phase 20 will validate it against the coupon engine
  during `validate`/`reserve`.
