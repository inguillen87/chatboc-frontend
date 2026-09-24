import { apiFetch } from '@/utils/api';
import { assertFollowUpIdentity, assertFollowUpScope, asRecord, followUpRevision, parseFollowUpHistory, parseFollowUpQueue, validScheduledInstant,
  type FollowUpIdentity, type FollowUpSnapshot } from './followUpModel';
export type FollowUpDraft = { notes: string; nextActionAt: string | null };
export type FollowUpSavePhase = 'checking' | 'saving' | 'verifying';
export class FollowUpSessionEnded extends Error {
  constructor() { super('La sesión de seguimiento ya no está activa.'); this.name='FollowUpSessionEnded'; }
}
export class FollowUpConflict extends Error {
  constructor() { super('El seguimiento cambió desde que abriste la ficha. Revisá la versión actual antes de guardar.'); this.name='FollowUpConflict'; }
}
export class FollowUpUnconfirmed extends Error {
  readonly status?: number;
  constructor(public acknowledged: boolean, cause: unknown) {
    super(acknowledged ? 'El servidor aceptó la actualización, pero no pudimos verificar los datos guardados. No se reenviará.' : 'No se confirmó la actualización. Conservamos el borrador y no lo reenviamos.');
    this.name='FollowUpUnconfirmed'; this.status=Number((cause as {status?:number}|null)?.status)||undefined;
  }
}
const pathFor = (identity: FollowUpIdentity, suffix: 'history'|'stage') => {
  assertFollowUpIdentity(identity);
  return `/api/admin/tenants/${encodeURIComponent(identity.tenantSlug)}/contacts/${encodeURIComponent(identity.contactId)}/${suffix}`;
};
export function validateFollowUpDraft(draft: FollowUpDraft): FollowUpDraft {
  const notes = draft.notes.trim();
  if (notes.length > 1200) throw new Error('Las notas admiten hasta 1200 caracteres.');
  if (draft.nextActionAt !== null && !validScheduledInstant(draft.nextActionAt)) throw new Error('La fecha debe ser verificable e incluir su zona horaria.');
  return {notes,nextActionAt:draft.nextActionAt};
}
export const followUpApi = {
  async read(identity: FollowUpIdentity): Promise<FollowUpSnapshot> {
    const raw = await apiFetch<unknown>(pathFor(identity,'history'), {tenantSlug:identity.tenantSlug,persistTenantSlug:false});
    return parseFollowUpHistory(raw,identity);
  },
  async list() {
    const raw = await apiFetch<unknown>('/api/admin/crm/leads?limit=100',{omitTenant:true,persistTenantSlug:false});
    return parseFollowUpQueue(raw);
  },
  async save(baseline: FollowUpSnapshot, draft: FollowUpDraft, onPhase?: (phase: FollowUpSavePhase)=>void, isCurrent: ()=>boolean = ()=>true): Promise<FollowUpSnapshot> {
    const desired = validateFollowUpDraft(draft);
    assertFollowUpIdentity(baseline);
    const ensureCurrent = () => { if (!isCurrent()) throw new FollowUpSessionEnded(); };
    ensureCurrent(); onPhase?.('checking');
    const latest = await followUpApi.read(baseline);
    ensureCurrent();
    if (followUpRevision(latest)!==followUpRevision(baseline)) throw new FollowUpConflict();
    // This preflight detects known changes but is NOT a backend compare-and-swap.
    onPhase?.('saving'); ensureCurrent();
    let acknowledged = false;
    try {
      const raw = await apiFetch<unknown>(pathFor(baseline,'stage'),{method:'PATCH',tenantSlug:baseline.tenantSlug,persistTenantSlug:false,
        body:{owner_notes:desired.notes,next_action_at:desired.nextActionAt}});
      const data=asRecord(raw),contact=asRecord(data.contact);
      assertFollowUpScope(data,baseline);assertFollowUpScope(contact,baseline);
      if(data.ok!==true || String(contact.contact_id ?? '')!==baseline.contactId) throw new Error('Recibo incompatible.');
      acknowledged=true; ensureCurrent(); onPhase?.('verifying');
      const verified = await followUpApi.read(baseline);
      const sameDate = desired.nextActionAt === null ? verified.nextActionAt === null
        : validScheduledInstant(verified.nextActionAt) && Date.parse(desired.nextActionAt)===Date.parse(verified.nextActionAt);
      if(verified.notes!==desired.notes || !sameDate) throw new Error('El registro no coincide con lo solicitado.');
      return verified;
    } catch(error) { throw new FollowUpUnconfirmed(acknowledged,error); }
  },
};
