# 02 Core Schemas (logical; R=required O=optional; M=mutable I=immutable after create)

## users
_id ObjectId; email string R/I (display); emailNormalized string R/I lower-trim, unique; passwordHash string R/M (argon2id); firstName/lastName string O/M; roles string[] R/M (enum customer/staff/support/admin); status enum active/locked/deleted R/M; emailVerifiedAt date|null M; tokenVer int R/M (bump on logout-all); createdAt/updatedAt R; deletedAt null|date M; version int. NEVER expose passwordHash/tokenVer internals; email unique case-insensitive via emailNormalized.

## sessions
_id; userId ref→users R/I; familyId uuid R/I; tokenHash SHA256 R/I; sid uuid R/I; device {ua, ip} O; expiresAt date R (TTL); revokedAt null|date M; rotatedTo null|tokenHash M; createdAt R. Raw refresh never stored.

## OTP
Redis-primary (see LLD): `otp:{purpose}:{contactHash}`. Mongo only `securityEvents` (append to auditLogs: {type otp.sent/verified/failed, contactHash, purpose, ip, at}) for abuse forensics — no OTP values stored anywhere.

## products
_id; title R/M; slug unique R/M (auto, scoped global); description M; categoryId ref R/M; brandId ref O/M; attrs object M (validated keys); media [{key, url, type, w, h, bytes}] M (S3 refs, ≤10); status draft/published/archived M; seo {title, desc} O/M; createdAt/updatedAt; deletedAt (soft-delete → status archived + deletedAt); version. Variant data NOT embedded (independent query/lifecycle; avoids giant docs).

## productVariants
_id; productId ref R/I; sku string R/I unique (upper-trim); barcode O/M; attrs (color/size) R/I; dims {l,w,h,weight} O/M; status active/discontinued M; priceRef {amountMinor, currency} M (current price; history lives in orders); createdAt/updatedAt; version.

## categories / brands
categories: {_id, name, slug unique, parentId null|ref (one-level + path string `path` for traversal), sort int, status, deletedAt}. brands: {_id, name, slug unique, logo {key,url}, status}. No graph DB; path-based filtering + index.

## media
Embedded in products as above (key/url/type/dims/bytes/owner/status/at). Binaries in S3/CDN only.

## pricing persistence
Current price on variant.priceRef + promotions{code-window rules}; historical price ONLY in order snapshots (§03). No separate prices collection (unjustified).

## carts
{_id, userId unique, lines [{skuId ref, qty 1..50, priceMinorCached, validatedAt}] cap 50, version (optimistic), expiresAt TTL 30d, updatedAt}. Stale lines flagged on read (price/inv/coupon change); never unbounded.

## wishlists
{userId unique, skus [ref] unique-set, updatedAt}. Dup prevented by set-add.

## addresses
{_id, userId ref, label, lines, city, region, postal, country, phone, isDefault, createdAt, deletedAt}. Orders embed snapshots (never live-ref).
