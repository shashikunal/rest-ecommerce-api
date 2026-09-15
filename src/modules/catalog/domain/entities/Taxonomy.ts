export type CategoryStatus = 'active' | 'archived';

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly parentId: string | null;
  readonly path: string;
  readonly sortOrder: number;
  readonly status: CategoryStatus;
  readonly deletedAt?: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const MAX_CATEGORY_DEPTH = 2;

export function buildCategoryPath(parentPath: string | null, slug: string): string {
  return parentPath ? `${parentPath}/${slug}` : `/${slug}`;
}

export type BrandStatus = 'active' | 'archived';

export interface BrandLogo {
  key: string;
  url: string;
}

export interface Brand {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly logo?: BrandLogo;
  readonly status: BrandStatus;
  readonly deletedAt?: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
