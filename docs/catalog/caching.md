# Caching

| Entry          | Key                       | TTL  | Invalidation                             |
| -------------- | ------------------------- | ---- | ---------------------------------------- |
| Product detail | `catalog:product:{slug}`  | 300s | `product:*` on any product/variant write |
| Category tree  | `catalog:categories:tree` | 600s | `categories:*` on taxonomy writes        |
| Brand list     | `catalog:brands:list`     | 600s | `brands:*` on brand writes               |

MongoDB is the source of truth; Redis is a best-effort overlay. Redis
unavailable → bypass to MongoDB (fail-open for cache; rate limits keep their
own fail-closed policy). HTTP layer adds `Cache-Control: public, max-age=60`
and weak `ETag (version + updatedAt)` with `304` support on public GETs —
never on admin/private responses.
