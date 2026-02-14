import { describe, expect, it } from 'vitest';
import { hasBotSettingsErrors, sanitizeBotSettingsPayload, validateBotSettings } from '@/utils/botSettings';

describe('botSettings utils', () => {
  it('validates invalid urls and colors', () => {
    const validation = validateBotSettings({
      tenant_id: 1,
      fallback_behavior: 'auto_reply',
      branding: {
        logo_url: 'ftp://invalid',
        primary_color: 'blue',
        secondary_color: '#12345',
      },
    });

    expect(validation.logo_url).toBeTruthy();
    expect(validation.primary_color).toBeTruthy();
    expect(validation.secondary_color).toBeTruthy();
    expect(hasBotSettingsErrors(validation)).toBe(true);
  });

  it('sanitizes empty values and trims payload', () => {
    const payload = sanitizeBotSettingsPayload(
      {
        tenant_id: 999,
        name: '  Bot Uno  ',
        tone: ' ',
        system_prompt: '  responder con contexto  ',
        fallback_behavior: 'silent',
        branding: {
          logo_url: '  https://cdn.example.com/logo.png  ',
          primary_color: ' #123456 ',
          secondary_color: '',
        },
      },
      15,
    );

    expect(payload.tenant_id).toBe(15);
    expect(payload.name).toBe('Bot Uno');
    expect(payload.tone).toBeUndefined();
    expect(payload.system_prompt).toBe('responder con contexto');
    expect(payload.branding?.logo_url).toBe('https://cdn.example.com/logo.png');
    expect(payload.branding?.primary_color).toBe('#123456');
    expect(payload.branding?.secondary_color).toBeUndefined();
  });
});
