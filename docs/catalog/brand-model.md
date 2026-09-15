# Brand Model

Collection `brands`: `_id, name, slug (unique), description, logo{key,url},
status (active/archived), deletedAt, timestamps`. Index `uq_slug`.

Lifecycle mirrors categories: create (slug auto, `409 SLUG_EXISTS`), update
(name/description/logo — slug immutable), archive (blocked with `409` while
draft/published products reference the brand). Brand reads are cached
(`brands:list`, 10m, write-invalidate).
