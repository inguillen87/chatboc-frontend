import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/utils/api';
import { deleteProfileAvatar, uploadProfileAvatar } from './profileAvatarService';

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(),
}));

describe('uploadProfileAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    const formData = vi.mocked(apiFetch).mock.calls[0]?.[1]?.body as FormData;
    expect(formData.get('avatar_consent')).toBe('true');
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

  it('does not assume upload consent when the backend omits consent metadata', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      avatar_url: 'https://cdn.example.com/profile/avatar.png',
      avatar_source: 'profile_upload',
    });

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    const result = await uploadProfileAvatar(file);

    expect(result.avatarUrl).toBe('https://cdn.example.com/profile/avatar.png');
    expect(result.avatarConsent).toBe(false);
  });

  it('deletes the consented avatar and returns an empty profile image', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      avatar_url: null,
      avatar_source: null,
      avatar_consent: false,
    });

    const result = await deleteProfileAvatar({ isWidgetRequest: false });

    expect(apiFetch).toHaveBeenCalledWith(
      '/auth/profile/avatar',
      expect.objectContaining({
        method: 'DELETE',
        isWidgetRequest: false,
        preserveAuthOn401: true,
      }),
    );
    expect(result).toEqual({
      avatarUrl: '',
      avatarSource: '',
      avatarConsent: false,
      picture: '',
    });
  });
});
