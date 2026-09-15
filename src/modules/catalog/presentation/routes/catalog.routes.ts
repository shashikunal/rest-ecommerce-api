import { requirePermission } from '@shared/authorization/authorization';
import { Router, type RequestHandler } from 'express';

import type { MediaService } from '../../application/MediaService';
import type { ProductSearchService } from '../../application/ProductSearchService';
import type { ProductService } from '../../application/ProductService';
import type { TaxonomyService } from '../../application/TaxonomyService';
import type { VariantService } from '../../application/VariantService';
import { AdminCatalogController, PublicCatalogController } from '../controllers/catalog.controller';
import {
  validateCategorySlugParam,
  validateCreateBrand,
  validateCreateCategory,
  validateCreateProduct,
  validateCreateVariant,
  validateProductIdParam,
  validateProductListQuery,
  validateSlugParam,
  validateUpdateBrand,
  validateUpdateCategory,
  validateUpdateProduct,
  validateUpdateVariant,
  validateUploadUrl,
  validateVariantIdParam,
} from '../validators/catalog.validators';

export interface CatalogRouteDeps {
  productService: ProductService;
  variantService: VariantService;
  taxonomyService: TaxonomyService;
  mediaService: MediaService;
  searchService?: ProductSearchService;
  authMiddleware: RequestHandler;
}

export function createCatalogRoutes(deps: CatalogRouteDeps): Router {
  const router = Router();
  const publicController = new PublicCatalogController(
    deps.productService,
    deps.taxonomyService,
    deps.searchService,
  );
  const admin = new AdminCatalogController(
    deps.productService,
    deps.variantService,
    deps.taxonomyService,
    deps.mediaService,
  );
  const auth = deps.authMiddleware;
  const canWrite = requirePermission('products:create', 'products:update');
  const canPublish = requirePermission('products:publish');
  const canArchive = requirePermission('products:archive');
  const canMedia = requirePermission('products:manage-media');

  router.get('/products/search', publicController.searchProducts);
  router.get('/products/suggestions', publicController.suggestProducts);
  router.get('/products', validateProductListQuery, publicController.listProducts);
  router.get('/products/:slug', validateSlugParam, publicController.getProduct);
  router.get('/categories', publicController.listCategories);
  router.get('/categories/:slug', validateCategorySlugParam, publicController.getCategory);
  router.get('/brands', publicController.listBrands);
  router.get('/brands/:slug', validateCategorySlugParam, publicController.getBrand);

  router.post('/products', auth, canWrite, validateCreateProduct, admin.createProduct);
  router.patch(
    '/products/:id',
    auth,
    canWrite,
    validateProductIdParam,
    validateUpdateProduct,
    admin.updateProduct,
  );
  router.get('/products/:id/detail', auth, canWrite, validateProductIdParam, admin.getProduct);
  router.post(
    '/products/:id/publish',
    auth,
    canPublish,
    validateProductIdParam,
    admin.publishProduct,
  );
  router.post(
    '/products/:id/unpublish',
    auth,
    canPublish,
    validateProductIdParam,
    admin.unpublishProduct,
  );
  router.post(
    '/products/:id/archive',
    auth,
    canArchive,
    validateProductIdParam,
    admin.archiveProduct,
  );
  router.post(
    '/products/:id/variants',
    auth,
    canWrite,
    validateProductIdParam,
    validateCreateVariant,
    admin.createVariant,
  );
  router.patch(
    '/products/:id/variants/:variantId',
    auth,
    canWrite,
    validateVariantIdParam,
    validateUpdateVariant,
    admin.updateVariant,
  );
  router.delete(
    '/products/:id/variants/:variantId',
    auth,
    canWrite,
    validateVariantIdParam,
    admin.deleteVariant,
  );

  router.post('/categories', auth, canWrite, validateCreateCategory, admin.createCategory);
  router.patch(
    '/categories/:id',
    auth,
    canWrite,
    validateProductIdParam,
    validateUpdateCategory,
    admin.updateCategory,
  );
  router.post(
    '/categories/:id/archive',
    auth,
    canArchive,
    validateProductIdParam,
    admin.archiveCategory,
  );

  router.post('/brands', auth, canWrite, validateCreateBrand, admin.createBrand);
  router.patch(
    '/brands/:id',
    auth,
    canWrite,
    validateProductIdParam,
    validateUpdateBrand,
    admin.updateBrand,
  );
  router.post('/brands/:id/archive', auth, canArchive, validateProductIdParam, admin.archiveBrand);

  router.post('/media/upload-url', auth, canMedia, validateUploadUrl, admin.requestUploadUrl);

  return router;
}
