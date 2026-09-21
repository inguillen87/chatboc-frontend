const textKeys = ['title','description','provider_notice','refresh','pack_label','search_label','search_placeholder',
  'state_label','all_states','results','no_results','clear_filters','empty','create','created','creating',
  'confirm_title','confirm_description','confirm_action','cancel','selection_label','tenant_label','stale',
  'unverified','approval_note'] as const;
export type TemplateWorkspaceUI = Record<typeof textKeys[number], string> & {
  contract_version: 'whatsapp.template_pack.workspace_ui.v1';
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Presentation copy only: never grants permission or approval. No local fallback. */
export function readTemplateWorkspaceUI(value: unknown): TemplateWorkspaceUI | null {
  if (!record(value) || value.contract_version !== 'whatsapp.template_pack.workspace_ui.v1') return null;
  if (!textKeys.every(key => typeof value[key] === 'string' && !!(value[key] as string).trim()
    && (value[key] as string).length <= 1800 && !/\p{Cc}/u.test(value[key] as string))) return null;
  const tokens = (value.results as string).match(/\{[^{}]*\}/g)?.sort();
  if (JSON.stringify(tokens) !== JSON.stringify(['{total}', '{visible}'])) return null;
  return {contract_version: value.contract_version,
    ...Object.fromEntries(textKeys.map(key => [key, value[key]]))} as TemplateWorkspaceUI;
}
