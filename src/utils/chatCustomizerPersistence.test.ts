import { describe, expect, it } from 'vitest';

import {
  buildTenantRuntimeWidgetUpdate,
  clearChatCustomizerDraft,
  findPublicWidgetRuntimeMismatches,
  findTenantRuntimePersistenceMismatches,
  readChatCustomizerDraft,
  readChatCustomizerConfig,
  writeChatCustomizerDraft,
  type ChatCustomizerConfig,
} from '@/utils/chatCustomizerPersistence';

const config: ChatCustomizerConfig = {
  primaryColor: '#0f8f4f',
  accentColor: '#075f36',
  fontFamily: 'Inter',
  animation: 'fade',
  borderRadius: 18,
  userMsgColor: '#ffffff',
  chatBackground: '#f6fff9',
  showLogo: true,
  logoUrl: 'https://cdn.example.com/junin.svg',
  mode: 'light',
  botName: 'Asistente Junín',
  welcomeMessage: 'Hola, ¿en qué podemos ayudarte?',
  ctaMessage: 'Iniciá tu consulta',
  faqSuggestions: ['Hacer un reclamo', 'Consultar un trámite'],
  soundEnabled: false,
  autoOpen: true,
  autoOpenDelay: 4,
  position: 'left',
  sideOffset: 24,
  bottomOffset: 18,
  allowedDomains: 'junin.gob.ar\ntramites.junin.gob.ar',
  privacyMode: 'private',
  zIndex: 12000,
  mobileHidden: false,
  showBranding: false,
};

describe('chatCustomizerPersistence', () => {
  it('maps every editor field to the runtime WidgetSettings contract', () => {
    const payload = buildTenantRuntimeWidgetUpdate(config);

    expect(payload).toMatchObject({
      welcome_message: config.welcomeMessage,
      welcome_subtitle: config.botName,
      avatar_url: config.logoUrl,
      primary_color: config.primaryColor,
      secondary_color: config.accentColor,
      bottom: '18px',
      side_offset: '24px',
      font_family: 'Inter',
      default_open: true,
    });
    expect(payload.theme_json).toMatchObject({
      contract_version: 'tenant.widget.appearance.v1',
      behavior: {
        auto_open: true,
        auto_open_delay: 4,
        position: 'left',
      },
      branding: {
        logo_url: config.logoUrl,
        show_logo: true,
      },
      content: {
        bot_name: config.botName,
        cta_message: config.ctaMessage,
        faq_suggestions: config.faqSuggestions,
      },
      security: {
        allowed_domains: ['junin.gob.ar', 'tramites.junin.gob.ar'],
      },
    });
  });

  it('rehydrates the exact editor state returned by GET /api/tenant/config', () => {
    const payload = buildTenantRuntimeWidgetUpdate(config);
    const rehydrated = readChatCustomizerConfig(payload, { ...config, primaryColor: '#000000' });

    expect(rehydrated).toEqual(config);
    expect(findTenantRuntimePersistenceMismatches(config, payload, config)).toEqual([]);
  });

  it('accepts the exact trim and lowercase canonicalization applied by the backend', () => {
    const submitted: ChatCustomizerConfig = {
      ...config,
      primaryColor: ' #AABBCC ',
      accentColor: '#DDEEFF',
      fontFamily: ' Inter ',
      botName: ' Asistente Junín ',
      welcomeMessage: ' Bienvenido al municipio ',
      ctaMessage: ' Participar ahora ',
      position: ' LEFT ',
    };
    const persisted = buildTenantRuntimeWidgetUpdate(submitted);
    persisted.primary_color = '#aabbcc';
    persisted.secondary_color = '#ddeeff';
    persisted.font_family = 'Inter';
    persisted.welcome_subtitle = 'Asistente Junín';
    persisted.welcome_message = 'Bienvenido al municipio';
    persisted.cta_messages = [{ text: 'Participar ahora' }];
    persisted.position = 'left';

    expect(findTenantRuntimePersistenceMismatches(submitted, persisted, config)).toEqual([]);

    const theme = persisted.theme_json as Record<string, any>;
    const publicPayload = {
      primary_color: persisted.primary_color,
      secondary_color: persisted.secondary_color,
      welcome_title: persisted.welcome_message,
      welcome_subtitle: persisted.welcome_subtitle,
      logo_url: persisted.avatar_url,
      font_family: persisted.font_family,
      default_open: persisted.default_open,
      position: persisted.position,
      bottom: persisted.bottom,
      side_offset: persisted.side_offset,
      border_radius: theme.border_radius,
      cta_messages: persisted.cta_messages,
      theme_config: { light: theme.light },
    };
    expect(findPublicWidgetRuntimeMismatches(submitted, publicPayload)).toEqual([]);
  });

  it('prefers the top-level runtime fields when legacy theme values diverge', () => {
    const payload = buildTenantRuntimeWidgetUpdate(config);
    payload.primary_color = '#112233';
    payload.secondary_color = '#445566';
    payload.welcome_subtitle = 'Asistente publicado';
    payload.welcome_message = 'Mensaje publicado';
    payload.position = 'right';
    payload.side_offset = '31px';
    payload.bottom = '27px';
    payload.cta_messages = [{ text: 'Acción publicada' }];

    const rehydrated = readChatCustomizerConfig(payload, config);

    expect(rehydrated).toMatchObject({
      primaryColor: '#112233',
      accentColor: '#445566',
      botName: 'Asistente publicado',
      welcomeMessage: 'Mensaje publicado',
      position: 'right',
      sideOffset: 31,
      bottomOffset: 27,
      ctaMessage: 'Acción publicada',
    });
  });

  it('detects an acknowledgement that ignored requested brand changes', () => {
    const stalePayload = buildTenantRuntimeWidgetUpdate({
      ...config,
      primaryColor: '#123456',
      botName: 'Nombre anterior',
    });

    expect(findTenantRuntimePersistenceMismatches(config, stalePayload, config)).toEqual(
      expect.arrayContaining(['color primario', 'nombre del asistente']),
    );
  });

  it('preserves unknown and dark-theme keys owned by other control-plane editors', () => {
    const payload = buildTenantRuntimeWidgetUpdate(config, {
      theme_json: {
        dark: { background: '#020617', foreground: '#f8fafc' },
        extension: { keep: true },
      },
    });

    expect(payload.theme_json).toMatchObject({
      dark: { background: '#020617', foreground: '#f8fafc' },
      extension: { keep: true },
      light: { primary: config.primaryColor },
    });
  });

  it('verifies the fields exposed by the public widget contract', () => {
    const update = buildTenantRuntimeWidgetUpdate(config);
    const theme = update.theme_json as Record<string, any>;
    const publicPayload = {
      primary_color: update.primary_color,
      secondary_color: update.secondary_color,
      welcome_title: update.welcome_message,
      welcome_subtitle: update.welcome_subtitle,
      logo_url: update.avatar_url,
      font_family: update.font_family,
      default_open: update.default_open,
      position: update.position,
      bottom: update.bottom,
      side_offset: update.side_offset,
      border_radius: theme.border_radius,
      cta_messages: update.cta_messages,
      theme_config: { light: theme.light },
    };

    expect(findPublicWidgetRuntimeMismatches(config, publicPayload)).toEqual([]);
    expect(findPublicWidgetRuntimeMismatches(config, { ...publicPayload, position: 'right' })).toContain('posición');
  });

  it('stores and clears session drafts under an exact tenant-scoped key', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const juninDraft = { ...config, botName: 'Borrador Junín' };
    const chivilcoyDraft = { ...config, botName: 'Borrador Chivilcoy' };

    expect(writeChatCustomizerDraft(storage, 'Junin', juninDraft, '2026-08-26T15:00:00.000Z')).toBe(true);
    expect(writeChatCustomizerDraft(storage, 'chivilcoy', chivilcoyDraft, '2026-08-26T15:01:00.000Z')).toBe(true);
    expect(readChatCustomizerDraft(storage, 'junin', config)?.config.botName).toBe('Borrador Junín');
    expect(readChatCustomizerDraft(storage, 'chivilcoy', config)?.config.botName).toBe('Borrador Chivilcoy');

    clearChatCustomizerDraft(storage, 'junin');
    expect(readChatCustomizerDraft(storage, 'junin', config)).toBeNull();
    expect(readChatCustomizerDraft(storage, 'chivilcoy', config)?.config.botName).toBe('Borrador Chivilcoy');
  });

  it('rejects a stored draft whose embedded tenant does not match its key', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    writeChatCustomizerDraft(storage, 'junin', config);
    const [key, raw] = Array.from(values.entries())[0];
    values.set(key, raw.replace('"tenant_slug":"junin"', '"tenant_slug":"chivilcoy"'));

    expect(readChatCustomizerDraft(storage, 'junin', config)).toBeNull();
  });
});
