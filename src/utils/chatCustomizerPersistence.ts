export type ChatCustomizerConfig = {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  animation: string;
  borderRadius: number;
  userMsgColor: string;
  chatBackground: string;
  showLogo: boolean;
  logoUrl: string;
  mode: string;
  botName: string;
  welcomeMessage: string;
  ctaMessage: string;
  faqSuggestions: string[];
  soundEnabled: boolean;
  autoOpen: boolean;
  autoOpenDelay: number;
  position: string;
  sideOffset: number;
  bottomOffset: number;
  allowedDomains: string;
  privacyMode: string;
  zIndex: number;
  mobileHidden: boolean;
  showBranding: boolean;
};

export type TenantRuntimeWidgetConfig = {
  theme_json?: unknown;
  welcome_message?: unknown;
  welcome_subtitle?: unknown;
  avatar_url?: unknown;
  primary_color?: unknown;
  secondary_color?: unknown;
  bottom?: unknown;
  side_offset?: unknown;
  bubble_shape?: unknown;
  font_family?: unknown;
  default_open?: unknown;
  [key: string]: unknown;
};

export type TenantRuntimeWidgetUpdate = {
  theme_json: Record<string, unknown>;
  welcome_message: string;
  welcome_subtitle: string;
  avatar_url: string;
  primary_color: string;
  secondary_color: string;
  bottom: string;
  side_offset: string;
  position: 'left' | 'right';
  bubble_shape: string;
  cta_messages: Array<{ text: string }>;
  font_family: string;
  default_open: boolean;
};

export type ChatCustomizerDraft = {
  contract_version: 'tenant.widget.appearance.draft.v1';
  tenant_slug: string;
  updated_at: string;
  config: ChatCustomizerConfig;
};

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const CHAT_CUSTOMIZER_DRAFT_PREFIX = 'chatboc:widget-appearance-draft:v1:';

const normalizeDraftTenantSlug = (tenantSlug: string | null | undefined): string =>
  String(tenantSlug ?? '').trim().toLowerCase();

export const chatCustomizerDraftStorageKey = (tenantSlug: string): string =>
  `${CHAT_CUSTOMIZER_DRAFT_PREFIX}${encodeURIComponent(normalizeDraftTenantSlug(tenantSlug))}`;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const asFiniteNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asStringArray = (value: unknown, fallback: string[]): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : fallback;

const asDraftString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const normalizeDraftConfig = (
  value: unknown,
  defaults: ChatCustomizerConfig,
): ChatCustomizerConfig => {
  const draft = asRecord(value);
  return {
    primaryColor: asDraftString(draft.primaryColor, defaults.primaryColor),
    accentColor: asDraftString(draft.accentColor, defaults.accentColor),
    fontFamily: asDraftString(draft.fontFamily, defaults.fontFamily),
    animation: asDraftString(draft.animation, defaults.animation),
    borderRadius: asFiniteNumber(draft.borderRadius, defaults.borderRadius),
    userMsgColor: asDraftString(draft.userMsgColor, defaults.userMsgColor),
    chatBackground: asDraftString(draft.chatBackground, defaults.chatBackground),
    showLogo: asBoolean(draft.showLogo, defaults.showLogo),
    logoUrl: asDraftString(draft.logoUrl, defaults.logoUrl),
    mode: asDraftString(draft.mode, defaults.mode),
    botName: asDraftString(draft.botName, defaults.botName),
    welcomeMessage: asDraftString(draft.welcomeMessage, defaults.welcomeMessage),
    ctaMessage: asDraftString(draft.ctaMessage, defaults.ctaMessage),
    faqSuggestions: asStringArray(draft.faqSuggestions, defaults.faqSuggestions),
    soundEnabled: asBoolean(draft.soundEnabled, defaults.soundEnabled),
    autoOpen: asBoolean(draft.autoOpen, defaults.autoOpen),
    autoOpenDelay: asFiniteNumber(draft.autoOpenDelay, defaults.autoOpenDelay),
    position: asDraftString(draft.position, defaults.position),
    sideOffset: asFiniteNumber(draft.sideOffset, defaults.sideOffset),
    bottomOffset: asFiniteNumber(draft.bottomOffset, defaults.bottomOffset),
    allowedDomains: asDraftString(draft.allowedDomains, defaults.allowedDomains),
    privacyMode: asDraftString(draft.privacyMode, defaults.privacyMode),
    zIndex: asFiniteNumber(draft.zIndex, defaults.zIndex),
    mobileHidden: asBoolean(draft.mobileHidden, defaults.mobileHidden),
    showBranding: asBoolean(draft.showBranding, defaults.showBranding),
  };
};

export const readChatCustomizerDraft = (
  storage: DraftStorage | null | undefined,
  tenantSlug: string | null | undefined,
  defaults: ChatCustomizerConfig,
): ChatCustomizerDraft | null => {
  const normalizedTenant = normalizeDraftTenantSlug(tenantSlug);
  if (!storage || !normalizedTenant) return null;

  try {
    const raw = storage.getItem(chatCustomizerDraftStorageKey(normalizedTenant));
    if (!raw) return null;
    const parsed = asRecord(JSON.parse(raw));
    if (
      parsed.contract_version !== 'tenant.widget.appearance.draft.v1' ||
      normalizeDraftTenantSlug(String(parsed.tenant_slug ?? '')) !== normalizedTenant ||
      !parsed.config ||
      typeof parsed.config !== 'object' ||
      Array.isArray(parsed.config)
    ) {
      return null;
    }

    return {
      contract_version: 'tenant.widget.appearance.draft.v1',
      tenant_slug: normalizedTenant,
      updated_at: asDraftString(parsed.updated_at, ''),
      config: normalizeDraftConfig(parsed.config, defaults),
    };
  } catch {
    return null;
  }
};

export const writeChatCustomizerDraft = (
  storage: DraftStorage | null | undefined,
  tenantSlug: string | null | undefined,
  config: ChatCustomizerConfig,
  updatedAt = new Date().toISOString(),
): boolean => {
  const normalizedTenant = normalizeDraftTenantSlug(tenantSlug);
  if (!storage || !normalizedTenant) return false;

  const draft: ChatCustomizerDraft = {
    contract_version: 'tenant.widget.appearance.draft.v1',
    tenant_slug: normalizedTenant,
    updated_at: updatedAt,
    config: {
      ...config,
      faqSuggestions: [...config.faqSuggestions],
    },
  };

  try {
    storage.setItem(chatCustomizerDraftStorageKey(normalizedTenant), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
};

export const clearChatCustomizerDraft = (
  storage: DraftStorage | null | undefined,
  tenantSlug: string | null | undefined,
): void => {
  const normalizedTenant = normalizeDraftTenantSlug(tenantSlug);
  if (!storage || !normalizedTenant) return;
  try {
    storage.removeItem(chatCustomizerDraftStorageKey(normalizedTenant));
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
};

const normalizeDomains = (value: string): string =>
  value
    .split('\n')
    .map((domain) => domain.trim())
    .filter(Boolean)
    .join('\n');

const deepMergeRecords = (
  base: Record<string, unknown>,
  update: Record<string, unknown>,
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(update)) {
    const current = merged[key];
    if (
      current &&
      value &&
      typeof current === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(current) &&
      !Array.isArray(value)
    ) {
      merged[key] = deepMergeRecords(
        current as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      merged[key] = value;
    }
  }
  return merged;
};

const firstCtaText = (value: unknown): string => {
  if (!Array.isArray(value)) return '';
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) return item.trim();
    const record = asRecord(item);
    const text = record.text;
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return '';
};

export const readChatCustomizerConfig = (
  payload: TenantRuntimeWidgetConfig | null | undefined,
  defaults: ChatCustomizerConfig,
): ChatCustomizerConfig => {
  const source = payload ?? {};
  const theme = asRecord(source.theme_json);
  const light = asRecord(theme.light);
  const behavior = asRecord(theme.behavior);
  const security = asRecord(theme.security);
  const advanced = asRecord(theme.advanced);
  const content = asRecord(theme.content);
  const branding = asRecord(theme.branding);

  const allowedDomains = asStringArray(security.allowed_domains, defaults.allowedDomains.split('\n'));

  return {
    ...defaults,
    // WidgetSettings top-level fields are the runtime source of truth. Nested
    // theme keys remain a legacy fallback for older tenant records.
    primaryColor: asString(source.primary_color, asString(light.primary, defaults.primaryColor)),
    accentColor: asString(source.secondary_color, asString(light.secondary, defaults.accentColor)),
    fontFamily: asString(source.font_family, asString(theme.font_family, defaults.fontFamily)),
    animation: asString(theme.animation, defaults.animation),
    borderRadius: asFiniteNumber(theme.border_radius, defaults.borderRadius),
    userMsgColor: asString(light.foreground, defaults.userMsgColor),
    chatBackground: asString(light.background, defaults.chatBackground),
    showLogo: asBoolean(branding.show_logo, defaults.showLogo),
    logoUrl: asString(source.avatar_url, asString(branding.logo_url, defaults.logoUrl)),
    mode: asString(theme.mode, defaults.mode),
    botName: asString(source.welcome_subtitle, asString(content.bot_name, defaults.botName)),
    welcomeMessage: asString(source.welcome_message, asString(content.welcome_message, defaults.welcomeMessage)),
    ctaMessage: asString(firstCtaText(source.cta_messages), asString(content.cta_message, defaults.ctaMessage)),
    faqSuggestions: asStringArray(content.faq_suggestions, defaults.faqSuggestions),
    soundEnabled: asBoolean(theme.sound_enabled, defaults.soundEnabled),
    autoOpen: asBoolean(source.default_open, asBoolean(behavior.auto_open, defaults.autoOpen)),
    autoOpenDelay: asFiniteNumber(behavior.auto_open_delay, defaults.autoOpenDelay),
    position: asString(source.position, asString(behavior.position, defaults.position)),
    sideOffset: asFiniteNumber(source.side_offset, asFiniteNumber(behavior.side_offset, defaults.sideOffset)),
    bottomOffset: asFiniteNumber(source.bottom, asFiniteNumber(behavior.bottom_offset, defaults.bottomOffset)),
    allowedDomains: normalizeDomains(allowedDomains.join('\n')),
    privacyMode: asString(security.privacy_mode, defaults.privacyMode),
    zIndex: asFiniteNumber(advanced.z_index, defaults.zIndex),
    mobileHidden: asBoolean(advanced.mobile_hidden, defaults.mobileHidden),
    showBranding: asBoolean(advanced.show_branding, defaults.showBranding),
  };
};

export const buildTenantRuntimeWidgetUpdate = (
  config: ChatCustomizerConfig,
  existingPayload?: TenantRuntimeWidgetConfig | null,
): TenantRuntimeWidgetUpdate => {
  const allowedDomains = normalizeDomains(config.allowedDomains)
    .split('\n')
    .filter(Boolean);

  const ownedThemeFields: Record<string, unknown> = {
    contract_version: 'tenant.widget.appearance.v1',
    mode: config.mode,
    light: {
      primary: config.primaryColor,
      secondary: config.accentColor,
      background: config.chatBackground,
      foreground: config.userMsgColor,
    },
    font_family: config.fontFamily,
    animation: config.animation,
    border_radius: config.borderRadius,
    sound_enabled: config.soundEnabled,
    behavior: {
      auto_open: config.autoOpen,
      auto_open_delay: config.autoOpenDelay,
      position: config.position,
      side_offset: config.sideOffset,
      bottom_offset: config.bottomOffset,
    },
    security: {
      allowed_domains: allowedDomains,
      privacy_mode: config.privacyMode,
    },
    advanced: {
      z_index: config.zIndex,
      mobile_hidden: config.mobileHidden,
      show_branding: config.showBranding,
    },
    branding: {
      logo_url: config.logoUrl,
      show_logo: config.showLogo,
    },
    content: {
      bot_name: config.botName,
      welcome_message: config.welcomeMessage,
      cta_message: config.ctaMessage,
      faq_suggestions: config.faqSuggestions,
    },
  };
  const themeJson = deepMergeRecords(
    asRecord(existingPayload?.theme_json),
    ownedThemeFields,
  );

  return {
    theme_json: themeJson,
    welcome_message: config.welcomeMessage,
    welcome_subtitle: config.botName,
    avatar_url: config.logoUrl,
    primary_color: config.primaryColor,
    secondary_color: config.accentColor,
    bottom: `${config.bottomOffset}px`,
    side_offset: `${config.sideOffset}px`,
    position: config.position === 'left' ? 'left' : 'right',
    bubble_shape: config.borderRadius >= 999 ? 'round' : 'rounded',
    cta_messages: config.ctaMessage.trim() ? [{ text: config.ctaMessage.trim() }] : [],
    font_family: config.fontFamily,
    default_open: config.autoOpen,
  };
};

const readPublicAttributes = (payload: TenantRuntimeWidgetConfig): Record<string, unknown> => {
  const widget = asRecord(payload.widget);
  const builder = asRecord(payload.builder_config);
  return {
    ...asRecord(builder.attributes),
    ...asRecord(widget.attributes),
    ...asRecord(asRecord(widget.builder_config).attributes),
  };
};

/** Fields that the public embed contract currently consumes and can verify. */
export const findPublicWidgetRuntimeMismatches = (
  expected: ChatCustomizerConfig,
  payload: TenantRuntimeWidgetConfig | null | undefined,
): string[] => {
  if (!payload) return ['contrato público'];
  const canonicalExpected = canonicalizeBackendRuntimeConfig(expected);
  const theme = asRecord(payload.theme_config ?? asRecord(payload.theme).config);
  const light = asRecord(theme.light);
  const interaction = asRecord(payload.interaction);
  const attributes = readPublicAttributes(payload);
  const position = asString(
    payload.position ?? attributes['data-position'],
    'right',
  );
  const sideAttribute = position === 'left' ? attributes['data-left'] : attributes['data-right'];
  const cta = firstCtaText(payload.cta_messages ?? interaction.cta_messages);
  const checks: Array<[boolean, string]> = [
    [asString(payload.primary_color ?? light.primary, '') === canonicalExpected.primaryColor, 'color primario'],
    [asString(payload.secondary_color ?? light.secondary, '') === canonicalExpected.accentColor, 'color secundario'],
    [
      asString(payload.welcome_title ?? interaction.welcome_title, '') === canonicalExpected.welcomeMessage,
      'mensaje de bienvenida',
    ],
    [
      asString(payload.welcome_subtitle ?? interaction.welcome_subtitle, '') === canonicalExpected.botName,
      'nombre del asistente',
    ],
    [asString(payload.logo_url ?? attributes['data-logo-url'], '') === canonicalExpected.logoUrl, 'logo'],
    [asString(payload.font_family ?? attributes['data-font-family'], '') === canonicalExpected.fontFamily, 'tipografía'],
    [asBoolean(payload.default_open ?? interaction.default_open, false) === canonicalExpected.autoOpen, 'apertura automática'],
    [position === canonicalExpected.position, 'posición'],
    [asFiniteNumber(payload.bottom ?? attributes['data-bottom'], -1) === canonicalExpected.bottomOffset, 'separación inferior'],
    [asFiniteNumber(payload.side_offset ?? sideAttribute, -1) === canonicalExpected.sideOffset, 'separación lateral'],
    [asFiniteNumber(payload.border_radius ?? attributes['data-border-radius'], -1) === canonicalExpected.borderRadius, 'redondeo'],
    [cta === canonicalExpected.ctaMessage, 'llamada a la acción'],
  ];
  return checks.filter(([matches]) => !matches).map(([, label]) => label);
};

const canonicalizeBackendRuntimeConfig = (config: ChatCustomizerConfig): ChatCustomizerConfig => ({
  ...config,
  primaryColor: config.primaryColor.trim().toLowerCase(),
  accentColor: config.accentColor.trim().toLowerCase(),
  fontFamily: config.fontFamily.trim(),
  botName: config.botName.trim(),
  welcomeMessage: config.welcomeMessage.trim(),
  ctaMessage: config.ctaMessage.trim(),
  position: config.position.trim().toLowerCase(),
});

const comparableConfig = (config: ChatCustomizerConfig) => ({
  ...canonicalizeBackendRuntimeConfig(config),
  allowedDomains: normalizeDomains(config.allowedDomains),
  faqSuggestions: [...config.faqSuggestions],
});

const CONFIG_LABELS: Record<keyof ChatCustomizerConfig, string> = {
  primaryColor: 'color primario',
  accentColor: 'color secundario',
  fontFamily: 'tipografía',
  animation: 'animación',
  borderRadius: 'redondeo',
  userMsgColor: 'color de mensajes',
  chatBackground: 'fondo',
  showLogo: 'visibilidad del logo',
  logoUrl: 'logo',
  mode: 'modo visual',
  botName: 'nombre del asistente',
  welcomeMessage: 'mensaje de bienvenida',
  ctaMessage: 'llamada a la acción',
  faqSuggestions: 'preguntas sugeridas',
  soundEnabled: 'sonido',
  autoOpen: 'apertura automática',
  autoOpenDelay: 'demora de apertura',
  position: 'posición',
  sideOffset: 'separación lateral',
  bottomOffset: 'separación inferior',
  allowedDomains: 'dominios permitidos',
  privacyMode: 'privacidad',
  zIndex: 'nivel de superposición',
  mobileHidden: 'visibilidad móvil',
  showBranding: 'marca Chatboc',
};

export const findTenantRuntimePersistenceMismatches = (
  expected: ChatCustomizerConfig,
  persistedPayload: TenantRuntimeWidgetConfig | null | undefined,
  defaults: ChatCustomizerConfig,
): string[] => {
  const expectedComparable = comparableConfig(expected);
  const persistedComparable = comparableConfig(readChatCustomizerConfig(persistedPayload, defaults));

  return (Object.keys(CONFIG_LABELS) as Array<keyof ChatCustomizerConfig>)
    .filter((key) => JSON.stringify(expectedComparable[key]) !== JSON.stringify(persistedComparable[key]))
    .map((key) => CONFIG_LABELS[key]);
};
