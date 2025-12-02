export function mapToKnownCategory(
  categoria?: string | null,
  categories?: (string | null | undefined)[] | null
): string {
  const direct = categoria?.toString().trim();
  if (direct) return direct;

  if (Array.isArray(categories)) {
    for (const c of categories) {
      const trimmed = c?.toString().trim();
      if (trimmed) return trimmed;
    }
  }

  return 'General';
}
