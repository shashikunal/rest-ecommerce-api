import type { AuthRequest } from '@modules/auth/middleware/auth.middleware';
import { AppErrorFactory } from '@shared/errors/app-error-factory';
import { asyncHandler, sendSuccessResponse } from '@shared/http/response';
import type { Response } from 'express';

import type { MediaService } from '../../application/MediaService';
import type { ProductSearchService } from '../../application/ProductSearchService';
import type { Actor, ProductService } from '../../application/ProductService';
import type { TaxonomyService } from '../../application/TaxonomyService';
import type { VariantService } from '../../application/VariantService';
import type { ProductSort } from '../../domain/repositories/ProductRepository';

function requireActor(req: AuthRequest): Actor {
  if (!req.user) throw AppErrorFactory.unauthorized('Authentication required');
  return { id: req.user.id, email: req.user.email };
}

function toActor(req: AuthRequest): Actor {
  return { id: req.user?.id ?? 'anonymous', email: req.user?.email ?? '' };
}

export class PublicCatalogController {
  constructor(
    private readonly products: ProductService,
    private readonly taxonomy: TaxonomyService,
    private readonly searchService?: ProductSearchService,
  ) {}

  searchProducts = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!this.searchService) {
      return this.listProducts(req, res, () => undefined);
    }
    const result = await this.searchService.search(req.query as Record<string, unknown>);
    res.setHeader('Cache-Control', 'public, max-age=60');
    sendSuccessResponse(res, result);
  });

  suggestProducts = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!this.searchService) {
      sendSuccessResponse(res, { suggestions: [], metadata: { query: '', cached: false } });
      return;
    }
    const result = await this.searchService.suggest(req.query.q, req.query.limit);
    res.setHeader('Cache-Control', 'public, max-age=60');
    sendSuccessResponse(res, result);
  });

  listProducts = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const query = req.query as Record<string, string>;
    const toMinor = (value: string | undefined): number | undefined => {
      if (value === undefined) return undefined;
      const major = Number(value);
      return Number.isFinite(major) ? Math.round(major * 100) : undefined;
    };
    const categorySlug = query.category;
    const brandSlug = query.brand;
    let categoryId: string | undefined;
    let brandId: string | undefined;
    if (categorySlug) {
      try {
        categoryId = (await this.taxonomy.getCategoryBySlug(categorySlug)).id;
      } catch {
        sendSuccessResponse(res, {
          data: [],
          pagination: { limit: Number(query.limit ?? 20), nextCursor: null, hasMore: false },
        });
        return;
      }
    }
    if (brandSlug) {
      try {
        brandId = (await this.taxonomy.getBrandBySlug(brandSlug)).id;
      } catch {
        sendSuccessResponse(res, {
          data: [],
          pagination: { limit: Number(query.limit ?? 20), nextCursor: null, hasMore: false },
        });
        return;
      }
    }
    const result = await this.products.getPublicList({
      filters: {
        categoryId,
        brandId,
        minPriceMinor: toMinor(query.minPrice),
        maxPriceMinor: toMinor(query.maxPrice),
        search: query.search,
      },
      sort: (query.sort ?? 'createdAt') as ProductSort,
      limit: Number(query.limit ?? 20),
      cursor: query.cursor,
    });
    res.setHeader('Cache-Control', 'public, max-age=60');
    sendSuccessResponse(res, result);
  });

  getProduct = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { dto, etag } = await this.products.getPublicDetail(req.params.slug as string);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      res.status(304).send();
      return;
    }
    sendSuccessResponse(res, dto);
  });

  listCategories = asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
    const tree = await this.taxonomy.getCategoryTree();
    res.setHeader('Cache-Control', 'public, max-age=60');
    sendSuccessResponse(res, tree);
  });

  getCategory = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const category = await this.taxonomy.getCategoryBySlug(
      req.params.slug as string,
      req.correlationId,
    );
    res.setHeader('Cache-Control', 'public, max-age=60');
    sendSuccessResponse(res, category);
  });

  listBrands = asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
    const brands = await this.taxonomy.listBrands();
    res.setHeader('Cache-Control', 'public, max-age=60');
    sendSuccessResponse(res, brands);
  });

  getBrand = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const brand = await this.taxonomy.getBrandBySlug(req.params.slug as string, req.correlationId);
    res.setHeader('Cache-Control', 'public, max-age=60');
    sendSuccessResponse(res, brand);
  });
}

export class AdminCatalogController {
  constructor(
    private readonly products: ProductService,
    private readonly variants: VariantService,
    private readonly taxonomy: TaxonomyService,
    private readonly media: MediaService,
  ) {}

  createProduct = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const product = await this.products.createProduct(req.body, actor, req.correlationId);
    sendSuccessResponse(res, product, 201);
  });

  updateProduct = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const product = await this.products.updateProduct(
      req.params.id as string,
      req.body,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, product);
  });

  getProduct = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await this.products.getAdminProduct(req.params.id as string);
    sendSuccessResponse(res, result);
  });

  publishProduct = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const product = await this.products.publishProduct(
      req.params.id as string,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, product);
  });

  unpublishProduct = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const product = await this.products.unpublishProduct(
      req.params.id as string,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, product);
  });

  archiveProduct = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const product = await this.products.archiveProduct(
      req.params.id as string,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, product);
  });

  createVariant = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const variant = await this.variants.createVariant(
      req.params.id as string,
      req.body,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, variant, 201);
  });

  updateVariant = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const variant = await this.variants.updateVariant(
      req.params.variantId as string,
      req.body,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, variant);
  });

  deleteVariant = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    await this.variants.removeVariant(req.params.variantId as string, actor, req.correlationId);
    res.status(204).send();
  });

  createCategory = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const category = await this.taxonomy.createCategory(req.body, actor, req.correlationId);
    sendSuccessResponse(res, category, 201);
  });

  updateCategory = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const category = await this.taxonomy.updateCategory(
      req.params.id as string,
      req.body,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, category);
  });

  archiveCategory = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const category = await this.taxonomy.archiveCategory(
      req.params.id as string,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, category);
  });

  createBrand = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const brand = await this.taxonomy.createBrand(req.body, actor, req.correlationId);
    sendSuccessResponse(res, brand, 201);
  });

  updateBrand = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const brand = await this.taxonomy.updateBrand(
      req.params.id as string,
      req.body,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, brand);
  });

  archiveBrand = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const brand = await this.taxonomy.archiveBrand(
      req.params.id as string,
      actor,
      req.correlationId,
    );
    sendSuccessResponse(res, brand);
  });

  requestUploadUrl = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await this.media.requestUploadUrl(req.body, toActor(req), req.correlationId);
    sendSuccessResponse(res, result, 201);
  });
}
