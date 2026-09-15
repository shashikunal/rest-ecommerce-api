# Media

Catalog stores references only: `{mediaId,key,url,type,altText,sortOrder,
width,height,bytes}`, max 10 per product, unique `sortOrder`, MIME allowlist
`jpeg/png/webp`. Binaries live in S3/CDN; MongoDB never holds blobs (ADR-012).

```text
Catalog → Media Reference (key/url) → Object Storage/CDN
```

Upload flow: `POST /api/v1/media/upload-url {contentType,sizeBytes,ownerType}`
(admin + `products:manage-media`, 10/hour fail-closed) validates type/size/owner
and returns `{uploadUrl,objectKey,expiresIn: 900}` via the `MediaStorage` port.
Current adapter is `LocalDevMediaStorage` (dev URL minting); the port is
S3-compatible so a presigned-URL adapter swaps in without touching services.
Client-provided `filename`/`Content-Type` are never trusted — the key and
extension derive server-side. Product media attach only stores validated refs.
