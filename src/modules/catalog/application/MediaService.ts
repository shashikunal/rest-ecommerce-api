import type { Logger } from '@config/logger';
import { ValidationError } from '@shared/errors/app-error';

import type { MediaStorage } from '../domain/ports/CatalogPorts';

import type { Actor } from './ProductService';

const ALLOWED_OWNER_TYPES = ['product', 'variant', 'category', 'brand'];
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface RequestUploadInput {
  contentType: string;
  sizeBytes: number;
  ownerType: string;
}

export class MediaService {
  constructor(
    private readonly storage: MediaStorage,
    private readonly logger: Logger,
  ) {}

  async requestUploadUrl(
    input: RequestUploadInput,
    actor: Actor,
    correlationId?: string,
  ): Promise<{ uploadUrl: string; objectKey: string; expiresIn: number }> {
    if (!ALLOWED_CONTENT_TYPES.includes(input.contentType)) {
      throw new ValidationError(
        `Unsupported content type: ${input.contentType}`,
        {
          field_0: { field: 'contentType', code: 'INVALID', message: 'Must be jpeg, png, or webp' },
        },
        correlationId,
      );
    }
    if (
      !Number.isInteger(input.sizeBytes) ||
      input.sizeBytes <= 0 ||
      input.sizeBytes > MAX_UPLOAD_BYTES
    ) {
      throw new ValidationError(
        'Invalid file size (max 5MB)',
        { field_0: { field: 'sizeBytes', code: 'INVALID', message: 'Must be 1..5242880' } },
        correlationId,
      );
    }
    if (!ALLOWED_OWNER_TYPES.includes(input.ownerType)) {
      throw new ValidationError(
        `Invalid owner type: ${input.ownerType}`,
        { field_0: { field: 'ownerType', code: 'INVALID', message: 'Unknown owner' } },
        correlationId,
      );
    }
    const extension = input.contentType === 'image/jpeg' ? 'jpg' : input.contentType.split('/')[1]!;
    try {
      const result = await this.storage.createUploadUrl({
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        ownerType: input.ownerType,
        extension,
      });
      this.logger.info('Catalog audit', {
        actor: actor.id,
        action: 'MEDIA_UPLOAD_URL_MINTED',
        resource: 'media',
        resourceId: result.objectKey,
        result: 'success',
        correlationId,
      });
      return result;
    } catch (error) {
      throw new ValidationError(
        (error as Error).message,
        { field_0: { field: 'contentType', code: 'INVALID', message: (error as Error).message } },
        correlationId,
      );
    }
  }
}
