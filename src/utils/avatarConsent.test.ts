import { describe, expect, it } from 'vitest';

import {
  isSafeAvatarUrl,
  resolveConsentedAvatar,
  shouldRenderProfileImage,
} from './avatarConsent';

describe('avatarConsent', () => {
  it('allows user uploads and social-login images with consent metadata', () => {
    expect(
      shouldRenderProfileImage({
        avatarUrl: 'https://cdn.example.com/profile/avatar.jpg',
        source: 'profile_upload',
        consented: true,
      }),
    ).toBe(true);

    expect(
      resolveConsentedAvatar({
        profile_picture_url: 'https://cdn.example.com/profile/google.jpg',
        profile_picture_source: 'google',
        profile_picture_consent: true,
      }).avatarUrl,
    ).toBe('https://cdn.example.com/profile/google.jpg');
  });

  it('allows internal staff avatars only when profile source and consent are explicit', () => {
    expect(
      shouldRenderProfileImage({
        avatarUrl: 'https://cdn.example.com/profile/operator.webp',
        source: 'agent_profile',
        consented: true,
      }),
    ).toBe(true);

    expect(
      shouldRenderProfileImage({
        avatarUrl: 'https://cdn.example.com/profile/operator.webp',
        source: 'agent_profile',
      }),
    ).toBe(false);
  });

  it('resolves consented avatars from nested CRM identity contracts', () => {
    expect(
      resolveConsentedAvatar({
        contact: {
          identity: {
            avatar_url: 'https://cdn.example.com/profile/contact.webp',
            avatar_source: 'oauth_google',
            avatar_consent: true,
          },
        },
      }).avatarUrl,
    ).toBe('https://cdn.example.com/profile/contact.webp');

    expect(
      resolveConsentedAvatar({
        customer_profile: {
          avatar_url: 'https://cdn.example.com/profile/customer.webp',
          avatar_source: 'social_login_linkedin',
          profile_picture_consent: true,
        },
      }).source,
    ).toBe('social_login_linkedin');
  });

  it('requires explicit consent even for upload or social-login sources', () => {
    expect(
      shouldRenderProfileImage({
        avatarUrl: 'https://cdn.example.com/profile/avatar.jpg',
        source: 'profile_upload',
      }),
    ).toBe(false);

    expect(
      resolveConsentedAvatar({
        profile_picture_url: 'https://cdn.example.com/profile/google.jpg',
        profile_picture_source: 'google',
      }).avatarUrl,
    ).toBeUndefined();
  });

  it('allows a manual profile URL only when explicit consent is present', () => {
    expect(
      shouldRenderProfileImage({
        avatarUrl: 'https://cdn.example.com/profile/manual.jpg',
        source: 'profile_url',
        consented: true,
      }),
    ).toBe(true);

    expect(
      shouldRenderProfileImage({
        avatarUrl: 'https://cdn.example.com/profile/manual.jpg',
        source: 'profile_url',
      }),
    ).toBe(false);
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

  it('blocks nested WhatsApp or scraped avatar contracts even with consent', () => {
    for (const source of ['whatsapp-profile', 'WhatsApp Avatar', 'wa profile', 'profile scrape']) {
      const resolved = resolveConsentedAvatar({
        contact: {
          identity: {
            avatar_url: 'https://cdn.example.com/profile/unsafe.jpg',
            avatar_source: source,
            avatar_consent: true,
          },
        },
      });

      expect(resolved.avatarUrl).toBeUndefined();
      expect(resolved.consented).toBe(false);
    }
  });

  it('blocks executable, data and protocol-relative URLs before rendering', () => {
    for (const avatarUrl of ['javascript:alert(1)', 'data:image/svg+xml,<svg />', '//cdn.example.com/avatar.jpg']) {
      expect(isSafeAvatarUrl(avatarUrl)).toBe(false);
      expect(
        shouldRenderProfileImage({
          avatarUrl,
          source: 'profile_upload',
          consented: true,
        }),
      ).toBe(false);
    }
  });

  it('allows HTTPS, localhost development URLs and approved internal upload paths', () => {
    expect(isSafeAvatarUrl('https://cdn.example.com/profile/avatar.jpg')).toBe(true);
    expect(isSafeAvatarUrl('http://localhost:5173/uploads/avatar.jpg')).toBe(true);
    expect(isSafeAvatarUrl('/uploads/profile/avatar.webp')).toBe(true);
    expect(isSafeAvatarUrl('/not-public/avatar.webp')).toBe(false);
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

  it('does not trust generic contact-profile source as a real customer image', () => {
    expect(
      shouldRenderProfileImage({
        avatarUrl: 'https://cdn.example.com/profile/contact.jpg',
        source: 'contact_profile',
        consented: true,
      }),
    ).toBe(false);
  });

  it('does not trust internal agent photos as customer identity avatars', () => {
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
    ).toBeUndefined();
  });
});
