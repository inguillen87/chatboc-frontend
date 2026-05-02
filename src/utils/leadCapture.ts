export const createLeadCaptureIdempotencyKey = (
  tenantSlug?: string | null,
  chatSessionId?: string | null,
  trigger?: string | null,
) => {
  const randomPart =
    typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return [
    'lead',
    tenantSlug?.trim() || 'global',
    chatSessionId?.trim() || 'session',
    trigger?.trim() || 'lead_capture',
    randomPart,
  ].join(':');
};
