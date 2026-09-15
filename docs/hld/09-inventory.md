# 09 Inventory

```mermaid
stateDiagram-v2
  [*] --> AVAILABLE --> RESERVED --> SOLD
  RESERVED --> RELEASED --> AVAILABLE
```
Last-item race: single conditional `$inc` (`available>0`) wins; loser 409; reserve TTL 15m; release on expiry/fail/cancel/return via tx + sweeper; oversell impossible. No distributed locks.
