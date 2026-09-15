import { randomUUID } from 'crypto';

import type { Logger } from '@config/logger';

import type { Brand, Category } from '../domain/entities/Taxonomy';
import { buildCategoryPath } from '../domain/entities/Taxonomy';
import {
  BrandNotFoundError,
  CategoryInUseError,
  CategoryNotFoundError,
  InvalidCategoryError,
  SlugExistsError,
} from '../domain/errors/CatalogErrors';
import { assertValidSlug, slugify } from '../domain/policies/catalog-policies';
import type { CatalogCache } from '../domain/ports/CatalogPorts';
import type { ProductRepository } from '../domain/repositories/ProductRepository';
import type {
  BrandRepository,
  CategoryRepository,
} from '../domain/repositories/TaxonomyRepository';

import type { Actor } from './ProductService';

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

function audit(
  logger: Logger,
  action: string,
  actor: Actor,
  resource: string,
  resourceId: string,
  correlationId?: string,
): void {
  logger.info('Catalog audit', {
    actor: actor.id,
    action,
    resource,
    resourceId,
    result: 'success',
    correlationId,
  });
}

export class TaxonomyService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly brands: BrandRepository,
    private readonly products: ProductRepository,
    private readonly cache: CatalogCache,
    private readonly logger: Logger,
  ) {}

  async createCategory(
    input: {
      name: string;
      slug?: string;
      description?: string;
      parentId?: string;
      sortOrder?: number;
    },
    actor: Actor,
    correlationId?: string,
  ): Promise<Category> {
    let parent: Category | null = null;
    if (input.parentId) {
      parent = await this.categories.findById(input.parentId);
      if (!parent || parent.status !== 'active') {
        throw new InvalidCategoryError('Parent category not found', correlationId);
      }
      if (parent.parentId !== null) {
        throw new InvalidCategoryError(
          'Categories support a single level of nesting only',
          correlationId,
        );
      }
    }
    const slug = (input.slug ?? slugify(input.name)).toLowerCase();
    try {
      assertValidSlug(slug);
    } catch {
      throw new SlugExistsError(slug, correlationId);
    }
    if (await this.categories.existsBySlug(slug)) {
      throw new SlugExistsError(slug, correlationId);
    }
    const now = new Date();
    const category: Category = {
      id: randomUUID(),
      name: input.name.trim(),
      slug,
      description: input.description,
      parentId: parent ? parent.id : null,
      path: buildCategoryPath(parent ? parent.path : null, slug),
      sortOrder: input.sortOrder ?? 0,
      status: 'active',
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.categories.create(category);
    await this.cache.invalidate('categories:*');
    audit(this.logger, 'CATEGORY_CREATED', actor, 'category', category.id, correlationId);
    return category;
  }

  async updateCategory(
    id: string,
    input: { name?: string; description?: string; sortOrder?: number },
    actor: Actor,
    correlationId?: string,
  ): Promise<Category> {
    const category = await this.categories.findById(id);
    if (!category) throw new CategoryNotFoundError('Category not found', correlationId);
    const updates: Partial<Category> = {};
    if (input.name !== undefined) (updates as { name?: string }).name = input.name.trim();
    if (input.description !== undefined) {
      (updates as { description?: string }).description = input.description;
    }
    if (input.sortOrder !== undefined) {
      (updates as { sortOrder?: number }).sortOrder = input.sortOrder;
    }
    await this.categories.update(id, updates);
    await this.cache.invalidate('categories:*');
    audit(this.logger, 'CATEGORY_UPDATED', actor, 'category', id, correlationId);
    const updated = await this.categories.findById(id);
    if (!updated) throw new CategoryNotFoundError('Category not found', correlationId);
    return updated;
  }

  async archiveCategory(id: string, actor: Actor, correlationId?: string): Promise<Category> {
    const category = await this.categories.findById(id);
    if (!category) throw new CategoryNotFoundError('Category not found', correlationId);
    const children = await this.categories.findChildren(id);
    if (children.length > 0) {
      throw new CategoryInUseError(
        'Category has subcategories and cannot be archived',
        correlationId,
      );
    }
    const referencing = await this.products.countByCategory(id, ['draft', 'published']);
    if (referencing > 0) {
      throw new CategoryInUseError(
        `Category is referenced by ${referencing} product(s)`,
        correlationId,
      );
    }
    await this.categories.update(id, {
      status: 'archived',
      deletedAt: new Date(),
    } as Partial<Category>);
    await this.cache.invalidate('categories:*');
    audit(this.logger, 'CATEGORY_ARCHIVED', actor, 'category', id, correlationId);
    const updated = await this.categories.findById(id);
    if (!updated) throw new CategoryNotFoundError('Category not found', correlationId);
    return updated;
  }

  async getCategoryTree(): Promise<CategoryNode[]> {
    const cached = await this.cache.get<CategoryNode[]>('categories:tree');
    if (cached) return cached;
    const roots = await this.categories.findRoots();
    const tree = await Promise.all(
      roots
        .filter((r) => r.status === 'active')
        .map(async (root) => ({
          ...root,
          children: (await this.categories.findChildren(root.id)).filter(
            (c) => c.status === 'active',
          ) as CategoryNode[],
        })),
    );
    await this.cache.set('categories:tree', tree, 600);
    return tree;
  }

  async getCategoryBySlug(slug: string, correlationId?: string): Promise<Category> {
    const category = await this.categories.findBySlug(slug.toLowerCase());
    if (!category || category.status !== 'active') {
      throw new CategoryNotFoundError('Category not found', correlationId);
    }
    return category;
  }

  async createBrand(
    input: {
      name: string;
      slug?: string;
      description?: string;
      logo?: { key: string; url: string };
    },
    actor: Actor,
    correlationId?: string,
  ): Promise<Brand> {
    const slug = (input.slug ?? slugify(input.name)).toLowerCase();
    try {
      assertValidSlug(slug);
    } catch {
      throw new SlugExistsError(slug, correlationId);
    }
    if (await this.brands.existsBySlug(slug)) {
      throw new SlugExistsError(slug, correlationId);
    }
    const now = new Date();
    const brand: Brand = {
      id: randomUUID(),
      name: input.name.trim(),
      slug,
      description: input.description,
      logo: input.logo,
      status: 'active',
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.brands.create(brand);
    await this.cache.invalidate('brands:*');
    audit(this.logger, 'BRAND_CREATED', actor, 'brand', brand.id, correlationId);
    return brand;
  }

  async updateBrand(
    id: string,
    input: { name?: string; description?: string; logo?: { key: string; url: string } },
    actor: Actor,
    correlationId?: string,
  ): Promise<Brand> {
    const brand = await this.brands.findById(id);
    if (!brand) throw new BrandNotFoundError('Brand not found', correlationId);
    const updates: Partial<Brand> = {};
    if (input.name !== undefined) (updates as { name?: string }).name = input.name.trim();
    if (input.description !== undefined) {
      (updates as { description?: string }).description = input.description;
    }
    if (input.logo !== undefined) (updates as { logo?: Brand['logo'] }).logo = input.logo;
    await this.brands.update(id, updates);
    await this.cache.invalidate('brands:*');
    audit(this.logger, 'BRAND_UPDATED', actor, 'brand', id, correlationId);
    const updated = await this.brands.findById(id);
    if (!updated) throw new BrandNotFoundError('Brand not found', correlationId);
    return updated;
  }

  async archiveBrand(id: string, actor: Actor, correlationId?: string): Promise<Brand> {
    const brand = await this.brands.findById(id);
    if (!brand) throw new BrandNotFoundError('Brand not found', correlationId);
    const referencing = await this.products.countByBrand(id, ['draft', 'published']);
    if (referencing > 0) {
      throw new CategoryInUseError(
        `Brand is referenced by ${referencing} product(s)`,
        correlationId,
      );
    }
    await this.brands.update(id, {
      status: 'archived',
      deletedAt: new Date(),
    } as Partial<Brand>);
    await this.cache.invalidate('brands:*');
    audit(this.logger, 'BRAND_ARCHIVED', actor, 'brand', id, correlationId);
    const updated = await this.brands.findById(id);
    if (!updated) throw new BrandNotFoundError('Brand not found', correlationId);
    return updated;
  }

  async listBrands(): Promise<Brand[]> {
    const cached = await this.cache.get<Brand[]>('brands:list');
    if (cached) return cached;
    const brands = (await this.brands.findAll()).filter((b) => b.status === 'active');
    await this.cache.set('brands:list', brands, 600);
    return brands;
  }

  async getBrandBySlug(slug: string, correlationId?: string): Promise<Brand> {
    const brand = await this.brands.findBySlug(slug.toLowerCase());
    if (!brand || brand.status !== 'active') {
      throw new BrandNotFoundError('Brand not found', correlationId);
    }
    return brand;
  }
}
