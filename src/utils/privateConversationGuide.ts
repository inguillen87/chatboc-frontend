import type { ConversationMenuData } from '@/features/evaluation/ConversationMenu';

type Tenant = { id: number; slug: string };
const copyKeys = ['heading', 'description', 'open', 'start', 'back_to_menu', 'source_label', 'loading', 'error'] as const;
export type GuideCopy = Record<typeof copyKeys[number], string>;
export interface GuideAccess {
  contract_version: 'tenant.conversation_guide_access.v1'; tenant: Tenant;
  guide_id: string; evaluation_only: true; endpoint: string; ui: GuideCopy;
}
export interface PrivateGuide {
  tenant: Tenant; guide_id: string; guide_sha256: string;
  source: { sha256: string; page_count: number; label: string; approval_status: string };
  menu: ConversationMenuData; ui: GuideCopy;
}
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 2000): v is string => typeof v === 'string' && !!v.trim() && v.length <= max;
const copy = (v: unknown): v is GuideCopy => object(v) && copyKeys.every(key => text(v[key]));
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const identity = (v: unknown, tenant: Tenant) => object(v) && v.id === tenant.id && v.slug === tenant.slug;

export function readGuideAccess(value: unknown, tenant: Tenant): GuideAccess | null {
  if (!object(value) || value.contract_version !== 'tenant.conversation_guide_access.v1'
    || !Number.isSafeInteger(tenant.id) || tenant.id < 1 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(tenant.slug)
    || !identity(value.tenant, tenant) || value.evaluation_only !== true || !text(value.guide_id, 120)
    || value.endpoint !== `/api/admin/tenants/${encodeURIComponent(tenant.slug)}/conversation-guide` || !copy(value.ui)) return null;
  return { contract_version: value.contract_version, tenant: { ...tenant }, guide_id: value.guide_id,
    evaluation_only: true, endpoint: value.endpoint, ui: Object.fromEntries(copyKeys.map(k => [k, value.ui[k]])) as GuideCopy };
}

/** Rebuild only the public presentation fields of an authenticated, matching response. */
export function readPrivateGuide(value: unknown, access: GuideAccess): PrivateGuide | null {
  if (!object(value) || value.contract_version !== 'tenant.conversation_guide.v1' || !identity(value.tenant, access.tenant)
    || value.guide_id !== access.guide_id || value.evaluation_only !== true || !hash(value.guide_sha256)
    || value.writes_performed !== false || value.provider_calls_performed !== false || !object(value.policy)
    || !['accepts_personal_data', 'creates_real_cases', 'queries_official_records', 'sends_notifications', 'stores_feedback']
      .every(key => value.policy[key] === false) || !object(value.source) || !hash(value.source.sha256)
    || !Number.isSafeInteger(value.source.page_count) || value.source.page_count < 1 || value.source.page_count > 10000
    || !text(value.source.label) || !text(value.source.approval_status, 100) || !copy(value.ui)) return null;
  const menu = value.menu;
  if (!object(menu) || !text(menu.id, 120) || !text(menu.title, 400) || !text(menu.text, 20000) || !text(menu.kind, 80)
    || !Array.isArray(menu.source_pages) || !menu.source_pages.length || menu.source_pages.length > value.source.page_count
    || menu.source_pages.some((p: unknown) => !Number.isSafeInteger(p) || Number(p) < 1 || Number(p) > value.source.page_count)
    || new Set(menu.source_pages).size !== menu.source_pages.length || !Array.isArray(menu.actions) || menu.actions.length > 30
    || menu.actions.some((a: unknown) => !object(a) || !text(a.code, 16) || !text(a.label, 400) || !text(a.target, 120))
    || new Set(menu.actions.map((a: { code: string }) => a.code)).size !== menu.actions.length) return null;
  const source = { sha256: value.source.sha256, page_count: value.source.page_count,
    label: value.source.label, approval_status: value.source.approval_status };
  return { tenant: { ...access.tenant }, guide_id: access.guide_id, guide_sha256: value.guide_sha256, source,
    ui: Object.fromEntries(copyKeys.map(k => [k, value.ui[k]])) as GuideCopy,
    menu: { id: menu.id, title: menu.title, text: menu.text, kind: menu.kind, source_pages: [...menu.source_pages],
      actions: menu.actions.map((a: { code: string; label: string; target: string }) => ({ code: a.code, label: a.label, target: a.target })),
      source: { label: source.label, approval_status: source.approval_status } } };
}
