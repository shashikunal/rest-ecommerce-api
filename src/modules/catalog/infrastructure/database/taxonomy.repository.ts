import type { Logger } from '@config/logger';

import type { Brand, Category } from '../../domain/entities/Taxonomy';
import type {
  BrandRepository,
  CategoryRepository,
} from '../../domain/repositories/TaxonomyRepository';

import { BrandModel, CategoryModel } from './taxonomy.schema';

export class MongoCategoryRepository implements CategoryRepository {
  constructor(private readonly logger: Logger) {}

  async create(category: Category): Promise<void> {
    const doc = new CategoryModel({
      _id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      path: category.path,
      sortOrder: category.sortOrder,
      status: category.status,
      deletedAt: category.deletedAt ?? null,
    });
    await doc.save();
    this.logger.debug('Category created', { categoryId: category.id });
  }

  async findById(id: string): Promise<Category | null> {
    const doc = await CategoryModel.findById(id).select('-__v').lean().exec();
    return doc ? this.toCategory(doc) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const doc = await CategoryModel.findOne({ slug: slug.toLowerCase() })
      .select('-__v')
      .lean()
      .exec();
    return doc ? this.toCategory(doc) : null;
  }

  async findChildren(parentId: string): Promise<Category[]> {
    const docs = await CategoryModel.find({ parentId })
      .select('-__v')
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec();
    return docs.map((d) => this.toCategory(d));
  }

  async findRoots(): Promise<Category[]> {
    const docs = await CategoryModel.find({ parentId: null })
      .select('-__v')
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec();
    return docs.map((d) => this.toCategory(d));
  }

  async findAll(): Promise<Category[]> {
    const docs = await CategoryModel.find({})
      .select('-__v')
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec();
    return docs.map((d) => this.toCategory(d));
  }

  async update(id: string, updates: Partial<Category>): Promise<void> {
    const allowed: Record<string, unknown> = {};
    if (updates.name !== undefined) allowed.name = updates.name;
    if (updates.description !== undefined) allowed.description = updates.description;
    if (updates.parentId !== undefined) allowed.parentId = updates.parentId;
    if (updates.path !== undefined) allowed.path = updates.path;
    if (updates.sortOrder !== undefined) allowed.sortOrder = updates.sortOrder;
    if (updates.status !== undefined) allowed.status = updates.status;
    if (updates.deletedAt !== undefined) allowed.deletedAt = updates.deletedAt;
    allowed.updatedAt = new Date();
    await CategoryModel.findByIdAndUpdate(id, allowed).exec();
    this.logger.debug('Category updated', { categoryId: id });
  }

  async existsBySlug(slug: string, exceptId?: string): Promise<boolean> {
    const filter: Record<string, unknown> = { slug: slug.toLowerCase() };
    if (exceptId) filter._id = { $ne: exceptId };
    return (await CategoryModel.countDocuments(filter).exec()) > 0;
  }

  private toCategory(doc: Record<string, unknown>): Category {
    const d = doc as unknown as {
      _id: string;
      name: string;
      slug: string;
      description?: string;
      parentId: string | null;
      path: string;
      sortOrder: number;
      status: Category['status'];
      deletedAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: String(d._id),
      name: d.name,
      slug: d.slug,
      description: d.description,
      parentId: d.parentId ?? null,
      path: d.path,
      sortOrder: d.sortOrder ?? 0,
      status: d.status,
      deletedAt: d.deletedAt ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}

export class MongoBrandRepository implements BrandRepository {
  constructor(private readonly logger: Logger) {}

  async create(brand: Brand): Promise<void> {
    const doc = new BrandModel({
      _id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      logo: brand.logo,
      status: brand.status,
      deletedAt: brand.deletedAt ?? null,
    });
    await doc.save();
    this.logger.debug('Brand created', { brandId: brand.id });
  }

  async findById(id: string): Promise<Brand | null> {
    const doc = await BrandModel.findById(id).select('-__v').lean().exec();
    return doc ? this.toBrand(doc) : null;
  }

  async findBySlug(slug: string): Promise<Brand | null> {
    const doc = await BrandModel.findOne({ slug: slug.toLowerCase() }).select('-__v').lean().exec();
    return doc ? this.toBrand(doc) : null;
  }

  async findAll(): Promise<Brand[]> {
    const docs = await BrandModel.find({}).select('-__v').sort({ name: 1 }).lean().exec();
    return docs.map((d) => this.toBrand(d));
  }

  async update(id: string, updates: Partial<Brand>): Promise<void> {
    const allowed: Record<string, unknown> = {};
    if (updates.name !== undefined) allowed.name = updates.name;
    if (updates.description !== undefined) allowed.description = updates.description;
    if (updates.logo !== undefined) allowed.logo = updates.logo;
    if (updates.status !== undefined) allowed.status = updates.status;
    if (updates.deletedAt !== undefined) allowed.deletedAt = updates.deletedAt;
    allowed.updatedAt = new Date();
    await BrandModel.findByIdAndUpdate(id, allowed).exec();
    this.logger.debug('Brand updated', { brandId: id });
  }

  async existsBySlug(slug: string, exceptId?: string): Promise<boolean> {
    const filter: Record<string, unknown> = { slug: slug.toLowerCase() };
    if (exceptId) filter._id = { $ne: exceptId };
    return (await BrandModel.countDocuments(filter).exec()) > 0;
  }

  private toBrand(doc: Record<string, unknown>): Brand {
    const d = doc as unknown as {
      _id: string;
      name: string;
      slug: string;
      description?: string;
      logo?: Brand['logo'];
      status: Brand['status'];
      deletedAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: String(d._id),
      name: d.name,
      slug: d.slug,
      description: d.description,
      logo: d.logo,
      status: d.status,
      deletedAt: d.deletedAt ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
