export { ProductService, validateMediaRefs, type Actor } from './application/ProductService';
export { VariantService } from './application/VariantService';
export { TaxonomyService } from './application/TaxonomyService';
export { MediaService } from './application/MediaService';
export { createCatalogDependencies, type CatalogDependencies } from './factory';
export { createCatalogRoutes } from './presentation/routes/catalog.routes';
export * from './domain/errors/CatalogErrors';
