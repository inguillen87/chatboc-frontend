export const DEFAULT_CATEGORIES = [
  'Alumbrado',
  'Bache',
  'Limpieza',
  'Arbolado',
  'General'
];

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapToKnownCategory(categoria?: string | null): string {
  if (!categoria) return 'General';
  const target = normalize(categoria);
  const match = DEFAULT_CATEGORIES.find(c => normalize(c) === target);
  return match || 'General';
}
