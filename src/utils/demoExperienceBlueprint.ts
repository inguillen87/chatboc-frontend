export interface ExperienceBlueprintItem {
  id?: string;
  label: string;
  description?: string;
  channel?: string;
}

export interface ExperienceBlueprint {
  component_pack: ExperienceBlueprintItem[];
  channel_playbooks: Record<string, ExperienceBlueprintItem[]>;
}

export interface DemoExperienceSources {
  demoOnboarding?: ExperienceBlueprint;
  widget?: ExperienceBlueprint;
  quickMenu: ExperienceBlueprintItem[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeItem = (raw: unknown): ExperienceBlueprintItem | null => {
  if (!isRecord(raw)) return null;
  const labelCandidate =
    typeof raw.label === "string"
      ? raw.label
      : typeof raw.title === "string"
        ? raw.title
        : "";
  const label = labelCandidate.trim();
  if (!label) return null;
  return {
    id: typeof raw.id === "string" ? raw.id.trim() : undefined,
    label,
    description:
      typeof raw.description === "string" ? raw.description.trim() : undefined,
    channel: typeof raw.channel === "string" ? raw.channel.trim() : undefined,
  };
};

const normalizeItemList = (raw: unknown): ExperienceBlueprintItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => normalizeItem(entry))
    .filter((entry): entry is ExperienceBlueprintItem => Boolean(entry));
};

export const normalizeExperienceBlueprint = (
  raw: unknown,
): ExperienceBlueprint | undefined => {
  if (!isRecord(raw)) return undefined;

  const componentPack = normalizeItemList(raw.component_pack);

  const channelPlaybooks = isRecord(raw.channel_playbooks)
    ? Object.entries(raw.channel_playbooks).reduce<
        Record<string, ExperienceBlueprintItem[]>
      >((acc, [channel, items]) => {
        const normalized = normalizeItemList(items);
        if (normalized.length > 0) {
          acc[channel] = normalized;
        }
        return acc;
      }, {})
    : {};

  if (componentPack.length === 0 && Object.keys(channelPlaybooks).length === 0) {
    return undefined;
  }

  return {
    component_pack: componentPack,
    channel_playbooks: channelPlaybooks,
  };
};

export const extractDemoExperienceSources = (
  integrationPayload: unknown,
  widgetPayload: unknown,
): DemoExperienceSources => {
  const integration = isRecord(integrationPayload) ? integrationPayload : {};
  const widget = isRecord(widgetPayload) ? widgetPayload : {};

  const demoOnboarding =
    (isRecord(integration.demoOnboarding) && integration.demoOnboarding) ||
    (isRecord(integration.demo_onboarding) && integration.demo_onboarding) ||
    undefined;

  const demoOnboardingBlueprint = normalizeExperienceBlueprint(
    demoOnboarding && isRecord(demoOnboarding)
      ? demoOnboarding.experience_blueprint
      : integration.experience_blueprint,
  );

  const widgetBlueprint = normalizeExperienceBlueprint(
    (isRecord(widget.widget) && widget.widget.experience_blueprint) ||
      widget.experience_blueprint,
  );

  const quickMenu = normalizeItemList(
    (isRecord(widget.builder_config) && widget.builder_config.quick_menu) ||
      (isRecord(widget.widget) &&
        isRecord(widget.widget.builder_config) &&
        widget.widget.builder_config.quick_menu),
  );

  return {
    demoOnboarding: demoOnboardingBlueprint,
    widget: widgetBlueprint,
    quickMenu,
  };
};
