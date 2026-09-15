# Product Model

Collection `products`. Fields: `_id(uuid), title, slug (unique global, auto,
immutable), description, shortDescription, categoryId (single ref), brandId
(optional ref), attrs (validated keys), media[≤10 refs], status
(draft/published/archived), seo{title,desc}, minPrice{amountMinor,currency}
(read projection = min active variant price), version, deletedAt, timestamps`.

Indexes: `uq_slug`, `ix_cat_price {categoryId, minPrice.amountMinor}`,
`txt_search (title, description)`. No status-only index (low selectivity).

Customer `ProductDTO`: `{id,slug,title,description,brand{id,name},
category{id,name,slug},variants[{sku,attrs,price{minor,currency},availability}],
media[],createdAt,updatedAt}` — no `_id/__v/version/cost/internal` fields.
Price filters accept major units (`minPrice=99.99`) converted to minor units
server-side.
