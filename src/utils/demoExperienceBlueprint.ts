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
  twilioTrial?: {
    display_number?: string;
    join_phrase?: string;
    wa_deeplink?: string;
    security_limits?: {
      messages_per_session?: number;
      upgrade_required_for?: string[];
    };
  };
  activationState?: {
    activated?: boolean;
    max_activations?: number;
    activations_used?: number;
  };
  activationEndpoint?: string;
  onboardingQuickMenu: ExperienceBlueprintItem[];
  featureFlags?: Record<string, boolean>;
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

  const twilioTrialRaw =
    demoOnboarding && isRecord(demoOnboarding) && isRecord(demoOnboarding.twilio_trial)
      ? demoOnboarding.twilio_trial
      : undefined;

  const twilioTrial = twilioTrialRaw
    ? {
        display_number:
          typeof twilioTrialRaw.display_number === "string"
            ? twilioTrialRaw.display_number.trim()
            : undefined,
        join_phrase:
          typeof twilioTrialRaw.join_phrase === "string"
            ? twilioTrialRaw.join_phrase.trim()
            : undefined,
        wa_deeplink:
          typeof twilioTrialRaw.wa_deeplink === "string"
            ? twilioTrialRaw.wa_deeplink.trim()
            : undefined,
        security_limits: isRecord(twilioTrialRaw.security_limits)
          ? {
              messages_per_session:
                typeof twilioTrialRaw.security_limits.messages_per_session ===
                "number"
                  ? twilioTrialRaw.security_limits.messages_per_session
                  : undefined,
              upgrade_required_for: Array.isArray(
                twilioTrialRaw.security_limits.upgrade_required_for,
              )
                ? twilioTrialRaw.security_limits.upgrade_required_for
                    .filter((item): item is string => typeof item === "string")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : undefined,
            }
          : undefined,
      }
    : undefined;

  const activationStateRaw =
    demoOnboarding &&
    isRecord(demoOnboarding) &&
    isRecord(demoOnboarding.activation_state)
      ? demoOnboarding.activation_state
      : undefined;

  const activationState = activationStateRaw
    ? {
        activated: activationStateRaw.activated === true,
        max_activations:
          typeof activationStateRaw.max_activations === "number"
            ? activationStateRaw.max_activations
            : undefined,
        activations_used:
          typeof activationStateRaw.activations_used === "number"
            ? activationStateRaw.activations_used
            : undefined,
      }
    : undefined;

  const activationEndpoint =
    demoOnboarding &&
    isRecord(demoOnboarding) &&
    typeof demoOnboarding.activation_endpoint === "string"
      ? demoOnboarding.activation_endpoint.trim()
      : undefined;

  const featureFlags =
    demoOnboarding &&
    isRecord(demoOnboarding) &&
    isRecord(demoOnboarding.feature_flags)
      ? Object.entries(demoOnboarding.feature_flags).reduce<
          Record<string, boolean>
        >((acc, [key, value]) => {
          if (value === true || value === false) {
            acc[key] = value;
          }
          return acc;
        }, {})
      : undefined;

  const onboardingQuickMenu = normalizeItemList(
    demoOnboarding && isRecord(demoOnboarding)
      ? demoOnboarding.quick_menu
      : undefined,
  );

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
    twilioTrial,
    activationState,
    activationEndpoint,
    onboardingQuickMenu,
    featureFlags,
    demoOnboarding: demoOnboardingBlueprint,
    widget: widgetBlueprint,
    quickMenu,
  };
};
