import type { Logger } from '@config/logger';
import { v4 as uuidv4 } from 'uuid';

import type {
  MediaStorage,
  UploadUrlRequest,
  UploadUrlResult,
} from '../../domain/ports/CatalogPorts';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const UPLOAD_URL_TTL_SECONDS = 900;

export class LocalDevMediaStorage implements MediaStorage {
  constructor(
    private readonly cdnBaseUrl: string,
    private readonly logger: Logger,
  ) {}

  async createUploadUrl(request: UploadUrlRequest): Promise<UploadUrlResult> {
    const extension = ALLOWED_MIME[request.contentType];
    if (!extension) {
      throw new Error(`Unsupported content type: ${request.contentType}`);
    }
    if (request.sizeBytes <= 0 || request.sizeBytes > MAX_MEDIA_BYTES) {
      throw new Error(`Invalid size: ${request.sizeBytes}`);
    }
    const safeOwner = request.ownerType.replace(/[^a-z-]/g, '').slice(0, 20) || 'product';
    const objectKey = `${safeOwner}/${uuidv4()}.${extension}`;
    this.logger.debug('Upload URL minted', { objectKey });
    return {
      uploadUrl: `${this.cdnBaseUrl}/media/upload/${objectKey}?expiresIn=${UPLOAD_URL_TTL_SECONDS}`,
      objectKey,
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    };
  }

  publicUrlFor(objectKey: string): string {
    return `${this.cdnBaseUrl}/media/${objectKey}`;
  }
}
