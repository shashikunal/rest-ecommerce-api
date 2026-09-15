# 18 Media

```mermaid
flowchart LR
  C[Client] --> P[API: presigned URL] --> S[S3-compatible] --> CDN[CDN] --> C
```

API validates MIME/size/role, issues presigned PUT; client uploads direct to S3; CDN serves; Mongo stores URLs + metadata only (never blobs). Delete revokes refs + lifecycle policy. Limits: 5MB/image, 10/h/user (rate-limit doc).
