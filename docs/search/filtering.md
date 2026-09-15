# Multi-Dimensional Filtering Architecture

## 1. Supported Filters

Search supports filtering by:
- **Category**: By slug (`category=electronics`) or ID (`categoryId=cat-123`).
- **Brand**: By slug (`brand=apple`) or ID (`brandId=brand-123`).
- **Attributes**: Multi-key, multi-value (`attributes=color:black,blue&attributes=storage:256gb`).
- **Price Range**: Min and max price in major currency units (`minPrice=100&maxPrice=500`).
- **Availability Boundary**: `in_stock`, `out_of_stock`, `unknown`.
- **Product Visibility**: Restricted strictly to `published` products with active parent categories and brands.

---

## 2. Category Hierarchy Traversal

Phase 4 defines category tree hierarchy using materialized paths (`path: "electronics/phones/smartphones"`).

When a user filters by parent category `category=electronics`:
1. Find the target category: `c.slug === 'electronics'` -> `path: "electronics"`.
2. Locate all active descendants using prefix match:
   `c.id === target.id || c.path.startsWith('electronics/')`.
3. Extract set of matching category IDs.
4. Filter products whose `categoryId` is contained within the descendant set.

This eliminates recursive database calls and works efficiently in memory or via index prefix queries.

---

## 3. Attribute Matching Semantics

```text
attributes=color:red,blue&attributes=storage:256gb
```

- **Across different keys**: **AND** logic. Product must match `color` AND `storage`.
- **Across values for the same key**: **OR** logic. Product/variant matches if color is `red` OR `blue`.
- **Product vs Variant Boundary**: Attributes exist at both the product level (common attributes like `os`) and variant level (differentiating attributes like `color`, `size`, `storage`). A match at either the product or any active variant satisfies the filter.

---

## 4. Price Filtering Boundary

Price is expressed in major currency units (e.g. `29.99`) in client requests and converted to integer minor units (e.g. `2999` cents) internally.
- Validated: `minPrice >= 0`, `maxPrice >= 0`, and `minPrice <= maxPrice`.
- Compares against `product.minPrice.amountMinor` (calculated automatically as the minimum price of all active variants).
