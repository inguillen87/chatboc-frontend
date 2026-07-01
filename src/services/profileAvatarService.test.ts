import { describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/utils/api';
import { uploadProfileAvatar } from './profileAvatarService';

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(),
}));

describe('uploadProfileAvatar', () => {
  it('uploads a consented avatar through the profile endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      avatar_url: 'https://cdn.example.com/profile/avatar.png',
      avatar_source: 'profile_upload',
      avatar_consent: true,
      upload: {
        original_name: 'avatar.png',
        mimetype: 'image/png',
        size: 128,
        thumb_url: 'https://cdn.example.com/profile/avatar-thumb.webp',
      },
    });

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    const result = await uploadProfileAvatar(file, { isWidgetRequest: true });

    expect(apiFetch).toHaveBeenCalledWith(
      '/auth/profile/avatar',
      expect.objectContaining({
        method: 'POST',
        isWidgetRequest: true,
        preserveAuthOn401: true,
        body: expect.any(FormData),
      }),
    );
    expect(result).toEqual({
      avatarUrl: 'https://cdn.example.com/profile/avatar.png',
      avatarSource: 'profile_upload',
      avatarConsent: true,
      picture: '',
      upload: {
        originalName: 'avatar.png',
        mimetype: 'image/png',
        size: 128,
        thumbUrl: 'https://cdn.example.com/profile/avatar-thumb.webp',
      },
    });
  });
});
