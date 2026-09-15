# Authorization

Built on Phase 10 primitives (`requirePermission`, role map). Public catalog
reads need no auth; every mutation needs Bearer + permission:

| Permission               | Who    | Endpoints                                                      |
| ------------------------ | ------ | -------------------------------------------------------------- |
| (public)                 | anyone | `GET /products`, `/products/:slug`, `/categories*`, `/brands*` |
| `products:create/update` | ADMIN  | product/variant/category/brand CRUD                            |
| `products:publish`       | ADMIN  | publish/unpublish                                              |
| `products:archive`       | ADMIN  | archive product/category/brand                                 |
| `products:manage-media`  | ADMIN  | upload-url                                                     |

Category/brand writes reuse the `products:*` family (documented choice to avoid
permission sprawl; matrix requires admin-only catalog writes, which holds).
STAFF/SUPPORT keep read access only. No `role === 'ADMIN'` string checks in
routes — all gates go through `requirePermission`.
