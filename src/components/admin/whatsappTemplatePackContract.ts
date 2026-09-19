// The server owns tenant identity, permissions, content and approval evidence.
export type TemplateLifecycle = { state?: string; production_send_allowed?: boolean };
export type TemplatePackItem = {
  intent?: string; intent_label?: string; name: string;
  preview?: { body?: string; cta?: { text?: string; url?: string } | null } | null;
  lifecycle?: TemplateLifecycle; blockers?: string[]; materialized?: boolean;
};
export type TemplatePack = {
  vertical: string; label?: string; pack_id: string; pack_version: string;
  templates: TemplatePackItem[];
  summary?: { total?: number; approved?: number; blocked?: number };
};
export type TemplatePackCatalog = {
  contract_version: 'whatsapp.template_pack.catalog.v1'; catalog_version: string;
  tenant: { id: number | string; slug: string }; provider_calls_performed?: boolean;
  packs: TemplatePack[];
  capabilities?: { read?: boolean; materialize_local_draft?: boolean; required_for_mutation?: string };
  endpoints?: { materialize_template?: string };
  frontend_contract?: { copy?: Record<string, string>; lifecycle_labels?: Record<string, string>; blocker_labels?: Record<string, string> };
};
export const CATALOG_PATH = '/api/admin/whatsapp/template-packs';
export const DRAFT_PATH = `${CATALOG_PATH}/{vertical}/drafts`;
export class TemplatePackContractError extends Error {
  constructor() { super('No pudimos verificar la organización o la versión de las plantillas. Actualizá antes de continuar.'); }
}
export const normalizeTemplateScope = (value?: string | null) => value?.trim().toLowerCase() || '';
const record = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const labels = (value: unknown) => value == null || (record(value) && Object.values(value).every((item) => typeof item === 'string'));
const optionalText = (value: unknown) => value == null || typeof value === 'string';
function isPack(value: unknown): value is TemplatePack {
  if (!record(value) || !text(value.vertical) || !/^[a-z][a-z0-9_-]{0,63}$/.test(value.vertical)
    || !text(value.pack_id) || !text(value.pack_version) || !optionalText(value.label)
    || !Array.isArray(value.templates) || value.templates.length > 100) return false;
  const names = new Set<string>();
  return value.templates.every((item: unknown) => {
    if (!record(item) || !text(item.name) || names.has(item.name)) return false;
    names.add(item.name);
    if (!optionalText(item.intent) || !optionalText(item.intent_label)
      || (item.materialized != null && typeof item.materialized !== 'boolean')
      || (item.blockers != null && (!Array.isArray(item.blockers) || !item.blockers.every(text)))) return false;
    if (item.lifecycle != null && (!record(item.lifecycle) || !optionalText(item.lifecycle.state)
      || (item.lifecycle.production_send_allowed != null && typeof item.lifecycle.production_send_allowed !== 'boolean'))) return false;
    const preview = item.preview;
    return preview == null || (record(preview) && optionalText(preview.body)
      && (preview.cta == null || (record(preview.cta) && optionalText(preview.cta.text) && optionalText(preview.cta.url))));
  });
}
function matchesTenant(value: unknown, scope: string, id?: number | string): boolean {
  return Boolean(record(value) && /^(?:[1-9][0-9]*)$/.test(String(value.id))
    && text(value.slug) && normalizeTemplateScope(value.slug) === scope
    && (id == null || String(value.id) === String(id)));
}
export function readTemplateCatalog(value: unknown, scope: string): TemplatePackCatalog {
  if (!scope || !record(value) || value.contract_version !== 'whatsapp.template_pack.catalog.v1'
    || !matchesTenant(value.tenant, scope) || !text(value.catalog_version)
    || !Array.isArray(value.packs) || value.packs.length > 30 || !value.packs.every(isPack)) throw new TemplatePackContractError();
  if (new Set(value.packs.map((pack: TemplatePack) => pack.vertical)).size !== value.packs.length
    || !record(value.capabilities) || value.capabilities.read !== true
    || (value.capabilities.materialize_local_draft != null && typeof value.capabilities.materialize_local_draft !== 'boolean')
    || (value.endpoints != null && (!record(value.endpoints) || value.endpoints.materialize_template !== DRAFT_PATH))) throw new TemplatePackContractError();
  if (value.frontend_contract != null && (!record(value.frontend_contract)
    || !labels(value.frontend_contract.copy) || !labels(value.frontend_contract.lifecycle_labels)
    || !labels(value.frontend_contract.blocker_labels))) throw new TemplatePackContractError();
  return value as TemplatePackCatalog;
}
export function readDraftReceipt(value: unknown, catalog: TemplatePackCatalog, pack: TemplatePack): TemplatePack {
  if (!record(value) || value.ok !== true || value.provider_calls_performed !== false
    || !matchesTenant(value.tenant, normalizeTemplateScope(catalog.tenant.slug), catalog.tenant.id)
    || !isPack(value.pack) || value.pack.vertical !== pack.vertical
    || value.pack.pack_id !== pack.pack_id || value.pack.pack_version !== pack.pack_version
    || value.pack.templates.length !== pack.templates.length
    || value.pack.templates.some((item: TemplatePackItem) => item.materialized !== true || !pack.templates.some((prior) => prior.name === item.name))) throw new TemplatePackContractError();
  return value.pack;
}
export function displayedTemplateState(template: TemplatePackItem): string {
  const state = template.lifecycle?.state || 'local_draft';
  return state === 'approved' && (template.lifecycle?.production_send_allowed !== true || Boolean(template.blockers?.length))
    ? 'unverified' : state;
}
export function templateDraftKey(pack: TemplatePack): string {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Este navegador no permite preparar una operación segura.');
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return `template-pack:${pack.vertical}:${Array.from(bytes, (item) => item.toString(16).padStart(2, '0')).join('')}`;
}
