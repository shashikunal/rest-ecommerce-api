export type Availability = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';

export interface InventoryLookup {
  availabilityFor(skus: string[]): Promise<Record<string, Availability>>;
}

export class NullInventoryLookup implements InventoryLookup {
  async availabilityFor(skus: string[]): Promise<Record<string, Availability>> {
    const result: Record<string, Availability> = {};
    for (const sku of skus) result[sku] = 'UNKNOWN';
    return result;
  }
}

export interface UploadUrlRequest {
  contentType: string;
  sizeBytes: number;
  ownerType: string;
  extension: string;
}

export interface UploadUrlResult {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
}

export interface MediaStorage {
  createUploadUrl(request: UploadUrlRequest): Promise<UploadUrlResult>;
  publicUrlFor(objectKey: string): string;
}

export interface CatalogCache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

export class NullCatalogCache implements CatalogCache {
  async get<T>(): Promise<T | null> {
    return null;
  }

  async set(): Promise<void> {
    return undefined;
  }

  async invalidate(): Promise<void> {
    return undefined;
  }
}
