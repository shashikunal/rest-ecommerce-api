# Variant Model

Collection `productVariants` — variants are independent documents (never
embedded; independent lifecycle, avoids giant product docs). Fields:
`_id, productId (immutable ref), sku (R/I, unique global, upper-trim),
barcode, attrs{color,size,...} (R/I, validated keys), attrSignature (derived
sorted `k=v|…`, unique per product), dims{l,w,h,weight}, status
(active/discontinued), priceRef{amountMinor,currency} (current catalog price;
history lives only in order snapshots), version, timestamps`.

Indexes: `uq_sku`, `ix_product {productId}`, `uq_product_attrs
{productId,attrSignature}`.

Rules: SKU immutable after create (identity for inventory/orders); attribute
combination unique per product (`RED+M` twice rejected); update allowlist is
`barcode/dims/status/priceRef` only; deletion allowed only for draft products
(unpublish first) so published assortments and order history stay stable.
