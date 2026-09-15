# Category Model

Collection `categories`: `_id, name, slug (unique), description, parentId
(null|ref), path (materialized `/root/child`), sortOrder, status
(active/archived), deletedAt, timestamps`. Index `uq_slug`, `ix_parent`.

One level of nesting only: a parent must itself be a root (`parentId: null`).
This makes cycles structurally impossible (no graph traversal needed) and
keeps tree reads to two indexed queries (roots + children). Slugs immutable,
so paths are stable forever.

Deletion: no hard delete. Archive requires zero children and zero
draft/published products referencing the category (`409 CATEGORY_IN_USE`
otherwise). Archived categories disappear from the tree; products keep their
`categoryId` reference for history.
