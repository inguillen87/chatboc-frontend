import { describe, expect, it } from 'vitest';

import { buildClerkProfile, resolveClerkOnboardingHandoff } from './ClerkAuthBridge';

describe('buildClerkProfile', () => {
  it('keeps consentable social profile images for backend validation', () => {
    const profile = buildClerkProfile({
      id: 'user_123',
      firstName: 'Marcelo',
      lastName: 'Guillen',
      imageUrl: 'https://img.clerk.test/users/user_123.webp',
      primaryEmailAddressId: 'email_1',
      emailAddresses: [
        {
          id: 'email_1',
          emailAddress: 'marcelo@chatboc.test',
          verification: { status: 'verified' },
        },
      ],
      externalAccounts: [
        {
          id: 'google_1',
          provider: 'oauth_google',
          imageUrl: 'https://lh3.googleusercontent.test/avatar.jpg',
        },
      ],
    });

    expect(profile.image_url).toBe('https://img.clerk.test/users/user_123.webp');
    expect(profile.picture).toBe('https://img.clerk.test/users/user_123.webp');
    expect(profile.external_accounts?.[0]).toMatchObject({
      provider: 'oauth_google',
      image_url: 'https://lh3.googleusercontent.test/avatar.jpg',
      picture: 'https://lh3.googleusercontent.test/avatar.jpg',
    });
  });

  it('uses the backend primary channel action when OAuth has no return path', () => {
    const handoff = resolveClerkOnboardingHandoff({
      contract_version: 'auth.clerk.v1',
      auth_provider: 'clerk',
      user: { id: 42 },
      tenant: { id: 7, slug: 'junin' },
      channel_activation: {
        contract_version: 'tenant.channel_activation.v1',
        summary: {
          primary_next_action: {
            id: 'connect_whatsapp',
            label: 'Conectar WhatsApp',
            href: '/t/junin/integracion?channel=whatsapp',
            kind: 'link',
          },
        },
      },
    });

    expect(handoff).toEqual({
      destination: '/t/junin/integracion?channel=whatsapp',
      actionLabel: 'Conectar WhatsApp',
      showPanelAction: true,
    });
  });
});
