export function normalizeSku(raw: string): string {
  return raw.trim().toUpperCase();
}

export function assertValidSku(raw: string): string {
  const sku = normalizeSku(raw);
  if (sku.length < 3 || sku.length > 64) {
    throw new Error(`Invalid SKU length: ${raw}`);
  }
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)) {
    throw new Error(`Invalid SKU format: ${raw}`);
  }
  return sku;
}

export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function assertValidSlug(slug: string): void {
  if (slug.length < 2 || slug.length > 120) {
    throw new Error(`Invalid slug length: ${slug}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Invalid slug format: ${slug}`);
  }
}

const ALLOWED_ATTR_KEYS = ['color', 'size', 'storage', 'material', 'weight', 'capacity'];

export function normalizeAttrs(attrs: Record<string, unknown>): Record<string, string> {
  const entries = Object.entries(attrs ?? {});
  if (entries.length === 0) {
    throw new Error('At least one attribute is required');
  }
  if (entries.length > 10) {
    throw new Error('Too many attributes (max 10)');
  }
  const normalized: Record<string, string> = {};
  for (const [key, value] of entries) {
    const k = key.trim().toLowerCase();
    if (!ALLOWED_ATTR_KEYS.includes(k)) {
      throw new Error(`Unsupported attribute key: ${key}`);
    }
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 64) {
      throw new Error(`Invalid attribute value for ${key}`);
    }
    if (normalized[k] !== undefined) {
      throw new Error(`Duplicate attribute key: ${key}`);
    }
    normalized[k] = value.trim();
  }
  return normalized;
}

export function attributeSignature(attrs: Record<string, string>): string {
  return Object.keys(attrs)
    .sort()
    .map((k) => `${k}=${attrs[k]}`)
    .join('|');
}
