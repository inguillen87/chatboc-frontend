import { describe, expect, it } from 'vitest';

import { buildClerkProfile } from './ClerkAuthBridge';

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
});
