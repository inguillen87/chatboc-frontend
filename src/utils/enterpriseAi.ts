export const MAX_ORDER_DRAFT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ORDER_DRAFT_ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

export const hasAllowedOrderDraftExtension = (filename: string) => {
  const normalized = filename.toLowerCase();
  return ORDER_DRAFT_ALLOWED_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

export const validateOrderDraftFile = (file: File | null): { valid: boolean; message?: string } => {
  if (!file) return { valid: false, message: 'No se seleccionó archivo.' };
  if (!hasAllowedOrderDraftExtension(file.name)) {
    return { valid: false, message: 'Formato de archivo no permitido.' };
  }
  if (file.size > MAX_ORDER_DRAFT_FILE_SIZE_BYTES) {
    return { valid: false, message: 'El archivo supera el límite de 5MB.' };
  }
  return { valid: true };
};

const normalizeStatus = (status: string) => status.trim().toLowerCase();

export const isMatchedStatus = (status: string) => {
  const normalized = normalizeStatus(status);
  if (!normalized) return false;
  if (normalized.includes('unmatch') || normalized.includes('not_match') || normalized.includes('not-matched')) return false;
  return normalized.includes('match');
};

export const countMatchStatuses = (items: Array<{ match_status?: string }>) => {
  const matched = items.filter((item) => isMatchedStatus(item.match_status ?? '')).length;
  const unmatched = items.length - matched;
  return { matched, unmatched };
};
