export function mapToKnownCategory(categoria?: string | null): string {
  return categoria?.toString().trim() || 'General';
}
