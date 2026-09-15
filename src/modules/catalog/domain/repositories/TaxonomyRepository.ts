import type { Brand, Category } from '../entities/Taxonomy';

export interface CategoryRepository {
  create(category: Category): Promise<void>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  findChildren(parentId: string): Promise<Category[]>;
  findRoots(): Promise<Category[]>;
  findAll(): Promise<Category[]>;
  update(id: string, updates: Partial<Category>): Promise<void>;
  existsBySlug(slug: string, exceptId?: string): Promise<boolean>;
}

export interface BrandRepository {
  create(brand: Brand): Promise<void>;
  findById(id: string): Promise<Brand | null>;
  findBySlug(slug: string): Promise<Brand | null>;
  findAll(): Promise<Brand[]>;
  update(id: string, updates: Partial<Brand>): Promise<void>;
  existsBySlug(slug: string, exceptId?: string): Promise<boolean>;
}
