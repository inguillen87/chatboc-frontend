/** UI vocabulary is supplied by the authenticated backend. */
export const BRAND_UI_KEYS = [
  'studio_label','eyebrow','version_label','toggle_label','presets_label','primary_label','accent_label',
  'primary_picker','accent_picker','input_hint','primary_contrast','accent_contrast','invalid_colors','contrast_scope',
  'verifying','publish_action','refresh_action','discard_action','draft_pending','draft_pristine','comparison_label',
  'comparison_review','comparison_publish','application_label','enabled_label','disabled_label','changed_label',
  'unchanged_label','saved_label','proposed_label','draft_hint','review_label','review_note','keep_draft_action',
  'use_saved_action','preview_title','preview_mobile','preview_desktop','preview_light','preview_dark','preview_invalid',
  'preview_enabled','preview_disabled','preview_logo_alt','organization_fallback','initials_fallback','preview_badge',
  'preview_heading','preview_body','preview_main_action','preview_accent','preview_profile_hint','history_heading',
  'history_row','restore_action','history_empty','history_hint','discard_title','publish_title','restore_title',
  'discard_description','publish_description','restore_draft_warning','cancel_action','confirm_discard','confirm_publish',
  'publish_saved','publish_unchanged','conflict_error','publish_unconfirmed',
] as const;
export type BrandWorkflowCopy = Record<typeof BRAND_UI_KEYS[number],string>;
export function readBrandWorkflowUI(raw:unknown):BrandWorkflowCopy|null {
  if(!raw||typeof raw!=='object')return null;
  const value=raw as Record<string,unknown>;
  if(value.contract_version!=='organization.branding_workflow_ui.v1'||!value.texts||typeof value.texts!=='object')return null;
  const texts=value.texts as Record<string,unknown>;
  if(BRAND_UI_KEYS.some(key=>typeof texts[key]!=='string'||!(texts[key] as string).trim()||(texts[key] as string).length>600
    ||Array.from(texts[key] as string).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127||c==='<'||c==='>')))return null;
  return Object.fromEntries(BRAND_UI_KEYS.map(key=>[key,texts[key]])) as BrandWorkflowCopy;
}
/** Plain text substitution only; the result is rendered as escaped React text. */
export function formatBrandText(template:string,values:Record<string,string|number>):string {
  return template.replace(/\{([a-z_]+)\}/g,(match,key)=>{
    const entry=Object.entries(values).find(([name])=>name===key);return entry?String(entry[1]):match;
  });
}
