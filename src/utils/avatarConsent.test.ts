import { describe, expect, it } from 'vitest';

import {
  resolveConsentedAvatar,
  shouldRenderProfileImage,
} from './avatarConsent';

describe('avatarConsent', () => {
  it('allows user uploads and social-login images with consent metadata', () => {
    expect(
      shouldRenderProfileImage({
        avatarUrl: 'https://cdn.example.com/profile/avatar.jpg',
        source: 'profile_upload',
      }),
    ).toBe(true);

    expect(
      resolveConsentedAvatar({
        profile_picture_url: 'https://cdn.example.com/profile/google.jpg',
        profile_picture_source: 'google',
      }).avatarUrl,
    ).toBe('https://cdn.example.com/profile/google.jpg');
  });

  it('allows a manual profile URL only when explicit consent is present', () => {
    expect(
      shouldRenderProfileImage({
        avatarUrl: 'https://cdn.example.com/profile/manual.jpg',
        source: 'profile_url',
        consented: true,
      }),
    ).toBe(true);
  });

  it('blocks WhatsApp profile pictures even when a URL is present', () => {
    const resolved = resolveConsentedAvatar({
      avatar_url: 'https://cdn.example.com/profile/whatsapp.jpg',
      avatar_source: 'whatsapp_profile',
      avatar_consent: true,
    });

    expect(resolved.avatarUrl).toBeUndefined();
    expect(resolved.consented).toBe(false);
  });

  it('blocks scraped, mock, synthetic or fake avatar sources', () => {
    for (const source of ['whatsapp_scraped', 'mock_avatar', 'synthetic_profile', 'realistic_generated']) {
      expect(
        shouldRenderProfileImage({
          avatarUrl: 'https://cdn.example.com/profile/avatar.jpg',
          source,
          consented: true,
        }),
      ).toBe(false);
    }
  });

  it('does not trust internal agent photos without explicit consent metadata', () => {
    expect(
      resolveConsentedAvatar({
        avatar_url: 'https://cdn.example.com/agents/agente.jpg',
        avatar_source: 'agente',
      }).avatarUrl,
    ).toBeUndefined();

    expect(
      resolveConsentedAvatar({
        avatar_url: 'https://cdn.example.com/agents/agente.jpg',
        avatar_source: 'agente',
        avatar_consent: true,
      }).avatarUrl,
    ).toBe('https://cdn.example.com/agents/agente.jpg');
  });
});
