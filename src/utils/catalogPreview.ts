export type PreviewValue = string | number | boolean | null | undefined | Record<string, unknown> | Array<unknown>;

const normalizePreviewKey = (key: unknown): string =>
  String(key)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();

const DEFAULT_EXCLUDED_KEYS = new Set([
  '_rowIndex',
  'id',
  'image_url',
  'imageUrl',
  'nombre',
  'name',
  'precio',
  'price',
  'sku',
  'category',
  'categoria',
  'stock',
  'description',
  'descripcion',
].map(normalizePreviewKey));

const formatPreviewValue = (value: PreviewValue): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map((entry) => formatPreviewValue(entry as PreviewValue)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
};

export const getPreviewMetadataEntries = (
  item: Record<string, PreviewValue>,
  extraExcludedKeys: string[] = []
): Array<{ key: string; value: string }> => {
  const excludedKeys = new Set([
    ...DEFAULT_EXCLUDED_KEYS,
    ...extraExcludedKeys.map(normalizePreviewKey),
  ]);
  return Object.entries(item)
    .filter(
      ([key, value]) =>
        !excludedKeys.has(normalizePreviewKey(key)) && value !== undefined && value !== null && value !== ''
    )
    .map(([key, value]) => ({
      key,
      value: formatPreviewValue(value),
    }))
    .filter((entry) => entry.value.length > 0);
};

export const getPreviewFieldValue = (
  item: Record<string, PreviewValue>,
  keys: string[]
): PreviewValue | undefined => {
  const normalizedItem = new Map(
    Object.entries(item).map(([key, value]) => [normalizePreviewKey(key), { key, value }])
  );
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
    const normalized = normalizedItem.get(normalizePreviewKey(key));
    if (normalized && normalized.value !== undefined && normalized.value !== null && normalized.value !== '') {
      return normalized.value;
    }
  }
  return undefined;
};

export const parsePreviewNumber = (value: PreviewValue): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const hasMeaningfulValue = (value: PreviewValue): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

export const getPreviewFallbackValue = (
  item: Record<string, PreviewValue>,
  extraExcludedKeys: string[] = []
): PreviewValue | undefined => {
  const excludedKeys = new Set([
    ...DEFAULT_EXCLUDED_KEYS,
    ...extraExcludedKeys.map(normalizePreviewKey),
  ]);

  for (const [key, value] of Object.entries(item)) {
    if (excludedKeys.has(normalizePreviewKey(key))) {
      continue;
    }
    if (hasMeaningfulValue(value)) {
      return value;
    }
  }
  return undefined;
};
