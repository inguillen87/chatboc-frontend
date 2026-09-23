import { apiFetch } from '@/utils/api';
import { assertIdentity, assertStageReceipt, commercialPath, isCommercialStage, parseCommercialList, parseCommercialTimeline, validateCommercialNote,
  type CommercialIdentity, type CommercialStage } from './commercialFollowUp';

export const commercialFollowUpApi = {
  async list(tenantSlug: string) {
    assertIdentity({ tenantSlug, ticketType: 'municipio', ticketId: '1' });
    const raw = await apiFetch<unknown>(`/api/admin/tenants/${encodeURIComponent(tenantSlug)}/leads?limit=100`, { tenantSlug, persistTenantSlug: false });
    return parseCommercialList(raw, tenantSlug);
  },
  async timeline(identity: CommercialIdentity) {
    const raw = await apiFetch<unknown>(commercialPath(identity, 'timeline'), { tenantSlug: identity.tenantSlug, persistTenantSlug: false });
    return parseCommercialTimeline(raw, identity);
  },
  async addNote(identity: CommercialIdentity, note: string) {
    const value = validateCommercialNote(note);
    const raw = await apiFetch<unknown>(commercialPath(identity, 'timeline'), {
      method: 'POST', body: { note: value }, tenantSlug: identity.tenantSlug, persistTenantSlug: false,
    });
    const events = parseCommercialTimeline(raw, identity, true);
    if (!events[0] || !['note', 'tenant_note'].includes(events[0].event) || events[0].note !== value) {
      throw new Error('El servidor no confirmó el contenido de la nota.');
    }
    return events;
  },
  async changeStage(identity: CommercialIdentity, stage: CommercialStage, reason: string) {
    if (!isCommercialStage(stage)) throw new Error('La etapa no es válida.');
    const note = validateCommercialNote(reason);
    const raw = await apiFetch<unknown>(commercialPath(identity, 'stage'), {
      method: 'PATCH', body: { stage, note }, tenantSlug: identity.tenantSlug, persistTenantSlug: false,
    });
    assertStageReceipt(raw, identity, stage);
  },
};
