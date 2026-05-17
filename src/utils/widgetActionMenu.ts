const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const readMenuString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

export const asActionArray = (value: unknown): unknown[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (!isPlainRecord(value)) return [];

  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.options)) return value.options;
  if (Array.isArray(value.buttons)) return value.buttons;
  if (Array.isArray(value.botones)) return value.botones;
  if (Array.isArray(value.actions)) return value.actions;
  if (Array.isArray(value.primary_actions)) return value.primary_actions;
  if (Array.isArray(value.quick_menu)) return value.quick_menu;
  if (Array.isArray(value.quick_replies)) return value.quick_replies;
  if (Array.isArray(value.starter_messages)) return value.starter_messages;
  return [];
};

const readActionKey = (item: Record<string, unknown>) =>
  readMenuString(
    item.action_id,
    item.action,
    item.intent,
    item.id,
    item.key,
    item.label,
    item.title,
    item.texto,
  );

export const mergeActionMenus = (...sources: unknown[]) => {
  const seen = new Set<string>();
  const items: unknown[] = [];

  sources.forEach((source) => {
    asActionArray(source).forEach((item) => {
      if (!isPlainRecord(item)) return;
      if (item.enabled === false) return;
      const key = readActionKey(item);
      if (!key || seen.has(key)) return;
      seen.add(key);
      items.push(item);
    });
  });

  return items;
};

export const readWorkspaceActionMenu = (
  workspace: Record<string, any> | null | undefined,
  sector?: string | null,
  rubro?: string | null,
) => {
  if (!workspace || typeof workspace !== "object") return [];

  const normalizedSector = readMenuString(
    sector,
    workspace.sector,
    workspace.demo_sector,
  ).toLowerCase();
  const normalizedRubro = readMenuString(
    rubro,
    workspace.rubro,
    workspace.rubro_slug,
    workspace.rubro_clave,
  ).toLowerCase();
  const activeVertical = readMenuString(
    workspace.active_vertical,
    workspace.vertical,
    workspace.experience_blueprint?.active_vertical,
    normalizedRubro,
    normalizedSector,
  );
  const verticals = isPlainRecord(workspace.verticals) ? workspace.verticals : {};
  const activeVerticalConfig =
    (activeVertical && isPlainRecord(verticals[activeVertical])
      ? verticals[activeVertical]
      : null) ||
    (normalizedRubro && isPlainRecord(verticals[normalizedRubro])
      ? verticals[normalizedRubro]
      : null) ||
    (normalizedSector && isPlainRecord(verticals[normalizedSector])
      ? verticals[normalizedSector]
      : null);

  return mergeActionMenus(
    workspace.primary_actions,
    workspace.quick_menu,
    workspace.default_menu,
    workspace.quick_replies,
    workspace.chat_bootstrap?.primary_actions,
    workspace.chat_bootstrap?.quick_menu,
    workspace.chat_bootstrap?.default_menu,
    workspace.chat_bootstrap?.payload?.primary_actions,
    workspace.chat_bootstrap?.payload?.quick_menu,
    workspace.chat_bootstrap?.payload?.default_menu,
    activeVerticalConfig,
    activeVerticalConfig?.actions,
    activeVerticalConfig?.primary_actions,
    activeVerticalConfig?.quick_menu,
    workspace.government,
    workspace.government?.primary_actions,
    workspace.government?.quick_menu,
    workspace.government?.actions,
    workspace.gobierno,
    workspace.gobierno?.primary_actions,
    workspace.gobierno?.quick_menu,
    workspace.gobierno?.actions,
    workspace.municipio,
    workspace.municipio?.primary_actions,
    workspace.municipio?.quick_menu,
    workspace.municipio?.actions,
    workspace.education?.primary_actions,
    workspace.education?.quick_menu,
    workspace.education_profile?.primary_actions,
    workspace.education_profile?.quick_menu,
    workspace.education?.whatsapp_playbook?.primary_actions,
    workspace.education?.whatsapp_playbook?.quick_menu,
    workspace.education?.whatsapp_playbook?.actions,
    workspace.pyme,
    workspace.pyme?.primary_actions,
    workspace.pyme?.quick_menu,
    workspace.pyme?.actions,
    workspace.business,
    workspace.business?.primary_actions,
    workspace.business?.quick_menu,
    workspace.business?.actions,
    workspace.commerce,
    workspace.commerce?.primary_actions,
    workspace.commerce?.quick_menu,
    workspace.commerce?.actions,
    workspace.operational_menu,
    workspace.operational_menu?.primary_actions,
    workspace.operational_menu?.quick_menu,
    workspace.operational_menu?.actions,
    workspace.conversion_ctas?.actions,
    workspace.experience_blueprint?.conversion_ctas?.actions,
  );
};
