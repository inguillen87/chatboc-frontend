export type PreviewValue = string | number | boolean | null | undefined | Record<string, unknown> | Array<unknown>;

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
]);

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
  const excludedKeys = new Set([...DEFAULT_EXCLUDED_KEYS, ...extraExcludedKeys]);
  return Object.entries(item)
    .filter(([key, value]) => !excludedKeys.has(key) && value !== undefined && value !== null && value !== '')
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
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
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
