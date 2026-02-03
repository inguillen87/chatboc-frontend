type PreviewValue = string | number | boolean | null | undefined | Record<string, unknown> | Array<unknown>;

const DEFAULT_EXCLUDED_KEYS = new Set([
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
