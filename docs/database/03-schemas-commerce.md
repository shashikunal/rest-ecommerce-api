# 03 Commerce Schemas (all money/history fields I=immutable)

## inventory
{skuId unique ref, available int≥0, reserved int≥0, sold int≥0, version, updatedAt}. Invariant: available+reserved+sold == totalReceived (adjustments via stock-in ops only); each ≥0 enforced by cond-update.

## inventoryReservations
{_id, orderId ref, skuId, qty, status active/committed/released/expired, expiresAt (index+sweep), idemKey, createdAt}. Indexes (orderId), (skuId,status), (expiresAt,status).

## orders (historical record; rebuildable without products collection)
{orderNo unique human-readable, userId ref, status (+version), items[] {skuId, productId, nameSnap I, variantSnap I, unitMinor I, qty, discountMinor I, taxMinor I, lineTotal I}, priceSnap {subtotal, discounts, tax, shipping, total, currency, couponCode} I, addrSnap {shipping, billing} I, customerSnap {name, email} I, paymentId ref, couponCode, idemKey unique, createdAt/updatedAt}. Items embedded (snapshot); user→orders by reference.

## payments
{orderId index, attemptNo, provider enum, providerRef (sparse unique), amountMinor, currency, status INITIATED/AUTHORIZED/CAPTURED/FAILED/REFUNDING/REFUNDED + version, idemKey unique, failCode/msg, createdAt/updatedAt}. No card data ever.

## paymentWebhooks
{provider, providerEventId unique-per-provider, eventType, status received/processed/failed, sigOk bool, processedAt, createdAt}. Payload stored truncated (≤4KB) + full in object store if needed; dedupe by providerEventId.

## refunds
{rmaId unique ref, orderId, paymentId, amountMinor (≤ remaining), reason, status PENDING/SUCCEEDED/FAILED + version, providerRef, idemKey unique, createdAt}. Dup blocked by (rmaId unique + idemKey unique + amount-cap check in tx).

## returns
{rmaId unique, orderId, items[{skuId, qty, condition}], reason, state REQUESTED/APPROVED/PICKED/INSPECTED/REFUNDING/REFUNDED/REJECTED + version, refundId, createdAt/updatedAt}. Independent lifecycle from order.

## coupons
{codeNormalized unique upper-trim, type pct/fixed, valueMinor/pct, window {from,to}, globalCap + usedGlobal (atomic), perUserCap, minOrderMinor, scope {skus,cats}, stackRule, status, createdAt}. Concurrency: `$inc usedGlobal where used<cap` + per-user unique usage doc.

## promotions
{_id, name, priority, window, scope, rule {type, value, caps}, stackable bool, status}. No executable code stored.

## reviews
{productId, userId, orderId (verified), rating 1–5, title/text ≤2KB, status pending/approved/rejected, createdAt} unique(productId,userId); idx (productId,status,createdAt), (userId), moderation queue (status,createdAt).

## notifications / prefs
notifications {eventId unique, userId, type, channel email, templateId, status queued/sent/failed, attempts, createdAt} TTL 90d; prefs {userId unique, channels {email opt per type}}.

## auditLogs (immutable)
{actor{type,id}, action, resource{type,id}, corrId, ip, before/after summary (no secrets), at}. No updates/deletes (app-level deny).

## outboxEvents / inboxEvents / idempotencyRecords
outbox {eventId unique, type, ver, aggregate{type,id}, payload, corrId/causationId, status PENDING/CLAIMED/SENT/FAILED, attempts, nextRetryAt, createdAt} idx (status,nextRetryAt),(aggregate). inbox {consumer, eventId unique-per-consumer, type, status, attempts, err, processedAt}. idem {key unique, scope, reqHash, resp, status, createdAt} TTL 90d.
