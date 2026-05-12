export const PRODUCT_IMAGE_KEYS = [
  "imagen_url",
  "image_url",
  "imageUrl",
  "thumbnail",
  "foto",
  "photo",
  "public_url",
];

export const PRODUCT_GALLERY_KEYS = [
  "gallery_urls",
  "galleryUrls",
  "imagenes",
  "images",
  "image_urls",
  "imageUrls",
  "fotos",
  "photos",
];

export const PRODUCT_IMAGE_COLUMN_ALIASES = [
  "imagen_url",
  "image_url",
  "foto",
  "photo",
  "thumbnail",
  "gallery_urls",
  "imagenes",
  "images",
  "image_urls",
  "fotos",
  "photos",
];

const readString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const readObjectString = (value: unknown, keys: string[]): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = readString(record[key]);
    if (candidate) return candidate;
  }
  return null;
};

export const normalizeGalleryUrls = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        const direct = readString(item);
        if (direct) return [direct];
        const nested = readObjectString(item, PRODUCT_IMAGE_KEYS);
        return nested ? [nested] : [];
      })
      .filter(Boolean);
  }
  const raw = readString(value);
  if (!raw) return [];
  return raw
    .split(/[\n,;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const getProductPrimaryImage = (
  product: Record<string, unknown>,
): string | null => {
  for (const key of PRODUCT_IMAGE_KEYS) {
    const value = readString(product[key]);
    if (value) return value;
  }
  for (const key of PRODUCT_GALLERY_KEYS) {
    const [first] = normalizeGalleryUrls(product[key]);
    if (first) return first;
  }
  return null;
};

export const getProductGalleryUrls = (
  product: Record<string, unknown>,
): string[] => {
  const urls = PRODUCT_GALLERY_KEYS.flatMap((key) => normalizeGalleryUrls(product[key]));
  return Array.from(new Set(urls));
};

export const getProductImageAlt = (
  product: Record<string, unknown>,
  fallback = "Producto",
): string => {
  return (
    readString(product.image_alt) ||
    readString(product.alt) ||
    readString(product.nombre) ||
    readString(product.name) ||
    fallback
  );
};

export const getProductImageStatus = (
  product: Record<string, unknown>,
): "ready" | "missing" | string => {
  const status = readString(product.image_status);
  if (status) return status;
  return getProductPrimaryImage(product) ? "ready" : "missing";
};

export const looksLikeImageColumn = (label: string): boolean => {
  const normalized = label.trim().toLowerCase();
  return PRODUCT_IMAGE_COLUMN_ALIASES.some((alias) => normalized.includes(alias));
};
