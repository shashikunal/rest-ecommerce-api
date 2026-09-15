# Topics + Partitions + Ordering (grouped by aggregate; justified counts)

| Topic | Purpose/producers→consumers | Partitions | Key | Retention/cleanup | Order |
|---|---|---|---|---|---|
| commerce.user.events.v1 | auth→notify,audit,analytics | 3 | userId | 7d/delete | per-user |
| commerce.catalog.events.v1 | catalog→search-indexer,audit | 3 | productId | 7d/delete | per-product |
| commerce.inventory.events.v1 | checkout/inventory→order,analytics,ops-notify | 6 (hottest) | skuId | 7d/delete | per-sku |
| commerce.order.events.v1 | checkout/order/returns→payment-starter,ship,notify,analytics,audit | 6 | orderId | 7d/delete | per-order strict |
| commerce.payment.events.v1 | payment→order,notify,analytics | 6 | orderId | 7d/delete | per-order strict |
| commerce.notification.events.v1 | any→notify-worker→(sent/failed back) | 3 | userId | 3d/delete | per-user |
| commerce.search.events.v1 | catalog→search-indexer | 3 | productId | 3d/delete | per-product |
| *.DLQ (per topic) | failed→ops | 1 | same key | 30d/delete | none |
| retry.1m/5m/30m (shared) | delayed redelivery | 3 | same key | 7d/delete | none |

Grouping: one topic per aggregate-domain (not per event) — bounds topic sprawl while preserving per-entity order via key. Partition counts are capacity assumptions (≈500 orders/d → 6 gives headroom + parallelism; inventory hottest → 6). Never change partition count casually: increasing breaks per-key order assumptions during transition — do only with versioned consumer + drain. Random keys forbidden where order matters. Expected throughput day-1 <1 msg/s avg; size cap 64KB/event (ids + deltas, media as S3 refs). Scale: 10x → 12 partitions order/payment/inventory + 3 workers/group; 100x → 24–48 + key-hash review for hot sku; 1000x → split inventory topic by region-hash + dedicated payment topic partitions; retention unchanged (replay window, not storage).
