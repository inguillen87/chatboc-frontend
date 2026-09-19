export const normalizeSetupStatus = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';
const completedStatuses = new Set(['ok', 'ready', 'done', 'completed', 'active', 'online', 'connected', 'approved', 'sender_attached', 'listo']);
const senderStatuses = new Set(['online', 'online:updating', 'connected', 'active', 'approved']);
export const isCompletedSetupStatus = (value: unknown): boolean => completedStatuses.has(normalizeSetupStatus(value));
export const isUsableSenderStatus = (value: unknown): boolean => senderStatuses.has(normalizeSetupStatus(value));

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function checklistConfirmed(items: unknown, id: string): boolean {
  if (!Array.isArray(items)) return false;
  const matching = items.map(record).filter(item => item?.id === id);
  return matching.length === 1 && matching[0]?.done === true && isCompletedSetupStatus(matching[0]?.status);
}

export function assertSetupTenant(value: unknown, slug: string, version: string): Record<string, unknown> {
  const data = record(value);
  if (!data || data.contract_version !== version || record(data.tenant)?.slug !== slug) throw new Error('setup_scope_mismatch');
  return data;
}

export function readSetupContract(response: unknown, slug: string): Record<string, unknown> {
  const data = record(response);
  if (!data) throw new Error('setup_contract_invalid');
  if (data.tenant && record(data.tenant)?.slug !== slug) throw new Error('setup_scope_mismatch');
  return assertSetupTenant(data.contract ?? data, slug, 'twilio.tech_provider.v1');
}
