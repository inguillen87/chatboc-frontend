export const TENANT_TICKET_INVALIDATION_CONTRACT_VERSION = 'tickets.collection.invalidated.v1';

const TENANT_TICKET_INVALIDATION_KEYS = new Set([
  'contract_version',
  'resource',
  'reason',
  'refetch',
]);

export const isTenantTicketCollectionInvalidation = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object') return false;

  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== TENANT_TICKET_INVALIDATION_KEYS.size ||
    keys.some((key) => !TENANT_TICKET_INVALIDATION_KEYS.has(key))
  ) {
    return false;
  }

  return (
    record.contract_version === TENANT_TICKET_INVALIDATION_CONTRACT_VERSION &&
    record.resource === 'tickets' &&
    record.reason === 'collection_changed' &&
    record.refetch === true
  );
};
