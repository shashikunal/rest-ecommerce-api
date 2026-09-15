import type { Logger } from '@config/logger';

import type { Product } from '../../domain/entities/Product';
import type {
  ProductListOptions,
  ProductListResult,
  ProductRepository,
} from '../../domain/repositories/ProductRepository';

import { ProductModel } from './product.schema';

interface ProductCursor {
  sortKey: number | string;
  id: string;
}

function encodeCursor(cursor: ProductCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

function decodeCursor(raw: string): ProductCursor {
  const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')) as ProductCursor;
  if (typeof decoded.id !== 'string' || decoded.sortKey === undefined) {
    throw new Error('Invalid cursor');
  }
  return decoded;
}

export class MongoProductRepository implements ProductRepository {
  constructor(private readonly logger: Logger) {}

  async create(product: Product): Promise<void> {
    const doc = new ProductModel({
      _id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      categoryId: product.categoryId,
      brandId: product.brandId,
      attrs: product.attrs,
      media: product.media,
      status: product.status,
      seo: product.seo,
      minPrice: product.minPrice,
      version: product.version,
      deletedAt: product.deletedAt ?? null,
    });
    await doc.save();
    this.logger.debug('Product created', { productId: product.id });
  }

  async findById(id: string): Promise<Product | null> {
    const doc = await ProductModel.findById(id).select('-__v').lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const doc = await ProductModel.findOne({ slug: slug.toLowerCase() })
      .select('-__v')
      .lean()
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async list(options: ProductListOptions): Promise<ProductListResult> {
    const limit = Math.min(Math.max(options.limit, 1), 50);
    const { filters, sort } = options;
    const filter: Record<string, unknown> = {};
    if (filters.categoryId) filter.categoryId = filters.categoryId;
    if (filters.brandId) filter.brandId = filters.brandId;
    if (filters.status) filter.status = filters.status;
    if (filters.minPriceMinor !== undefined || filters.maxPriceMinor !== undefined) {
      const price: Record<string, number> = {};
      if (filters.minPriceMinor !== undefined) price.$gte = filters.minPriceMinor;
      if (filters.maxPriceMinor !== undefined) price.$lte = filters.maxPriceMinor;
      filter['minPrice.amountMinor'] = price;
    }
    if (filters.search) {
      filter.$text = { $search: filters.search };
    }

    const descending = sort.startsWith('-');
    const sortField = sort === 'price' || sort === '-price' ? 'minPrice.amountMinor' : 'createdAt';
    const direction = descending ? -1 : 1;

    if (options.cursor) {
      let cursor: ProductCursor;
      try {
        cursor = decodeCursor(options.cursor);
      } catch {
        throw new Error('INVALID_CURSOR');
      }
      const cmp = descending ? '$lt' : '$gt';
      const cmpEq = descending ? '$lte' : '$gte';
      filter.$or = [
        { [sortField]: { [cmp]: cursor.sortKey } },
        { [sortField]: cursor.sortKey, _id: { [cmpEq === '$lte' ? '$lt' : '$gt']: cursor.id } },
      ];
    }

    const docs = await ProductModel.find(filter)
      .select('-__v')
      .sort({ [sortField]: direction, _id: direction })
      .limit(limit + 1)
      .lean()
      .exec();

    const page = docs.slice(0, limit);
    const hasMore = docs.length > limit;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            sortKey:
              sortField === 'createdAt'
                ? new Date(last.createdAt).getTime()
                : (last.minPrice?.amountMinor ?? 0),
            id: String(last._id),
          })
        : null;

    return { products: page.map((d) => this.toDomain(d)), nextCursor };
  }

  async update(id: string, updates: Partial<Product>): Promise<void> {
    const allowed: Record<string, unknown> = {};
    if (updates.title !== undefined) allowed.title = updates.title;
    if (updates.description !== undefined) allowed.description = updates.description;
    if (updates.shortDescription !== undefined) allowed.shortDescription = updates.shortDescription;
    if (updates.categoryId !== undefined) allowed.categoryId = updates.categoryId;
    if (updates.brandId !== undefined) allowed.brandId = updates.brandId;
    if (updates.attrs !== undefined) allowed.attrs = updates.attrs;
    if (updates.media !== undefined) allowed.media = updates.media;
    if (updates.seo !== undefined) allowed.seo = updates.seo;
    if (updates.minPrice !== undefined) allowed.minPrice = updates.minPrice;
    if (updates.version !== undefined) allowed.version = updates.version;
    if (updates.deletedAt !== undefined) allowed.deletedAt = updates.deletedAt;
    allowed.updatedAt = new Date();
    await ProductModel.findByIdAndUpdate(id, allowed).exec();
    this.logger.debug('Product updated', { productId: id });
  }

  async updateStatus(id: string, status: Product['status'], version: number): Promise<void> {
    await ProductModel.findByIdAndUpdate(id, { status, version, updatedAt: new Date() }).exec();
    this.logger.debug('Product status updated', { productId: id, status });
  }

  async clearMinPrice(id: string): Promise<void> {
    await ProductModel.findByIdAndUpdate(id, {
      $unset: { minPrice: 1 },
      updatedAt: new Date(),
    }).exec();
    this.logger.debug('Product minPrice cleared', { productId: id });
  }

  async existsBySlug(slug: string, exceptId?: string): Promise<boolean> {
    const filter: Record<string, unknown> = { slug: slug.toLowerCase() };
    if (exceptId) filter._id = { $ne: exceptId };
    const count = await ProductModel.countDocuments(filter).exec();
    return count > 0;
  }

  async countByCategory(categoryId: string, statuses?: Product['status'][]): Promise<number> {
    const filter: Record<string, unknown> = { categoryId };
    if (statuses) filter.status = { $in: statuses };
    return ProductModel.countDocuments(filter).exec();
  }

  async countByBrand(brandId: string, statuses?: Product['status'][]): Promise<number> {
    const filter: Record<string, unknown> = { brandId };
    if (statuses) filter.status = { $in: statuses };
    return ProductModel.countDocuments(filter).exec();
  }

  private toDomain(doc: Record<string, unknown>): Product {
    const d = doc as unknown as {
      _id: string;
      title: string;
      slug: string;
      description: string;
      shortDescription?: string;
      categoryId: string;
      brandId?: string;
      attrs: Record<string, string>;
      media: Product['media'];
      status: Product['status'];
      seo?: Product['seo'];
      minPrice?: Product['minPrice'];
      version: number;
      deletedAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: String(d._id),
      title: d.title,
      slug: d.slug,
      description: d.description,
      shortDescription: d.shortDescription,
      categoryId: d.categoryId,
      brandId: d.brandId,
      attrs: d.attrs ?? {},
      media: d.media ?? [],
      status: d.status,
      seo: d.seo,
      minPrice: d.minPrice,
      version: d.version ?? 0,
      deletedAt: d.deletedAt ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
