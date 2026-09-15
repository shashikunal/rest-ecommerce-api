# 16 Notifications

```mermaid
flowchart LR
  E[Business event: order paid/shipped] --> K[Kafka: notification.send] --> NC[Notify consumer: external worker] --> T[Template + prefs check] --> M[Email day-1 / SMS-push future]
  NC --> DLQ[DLQ + retry exp-jitter 3-5]
```

Prefs (`notificationPreferences`): opt-in/out per type/channel; transactional mail always sent. Dedupe by eventId (inbox). Retry → DLQ → ops replay. Delivery status + audit trail stored. Email async only; never blocks checkout/pay responses.
