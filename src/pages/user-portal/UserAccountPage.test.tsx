import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserAccountPage from './UserAccountPage';
import { deleteProfileAvatar, uploadProfileAvatar } from '@/services/profileAvatarService';

const accountMocks = vi.hoisted(() => ({
  user: {
    id: 1,
    name: 'Marcelo Guillen',
    email: 'marcelo@chatboc.test',
    avatar_url: undefined as string | undefined,
    avatar_source: undefined as string | undefined,
    avatar_consent: false as boolean | string | number | null,
  },
  setUser: vi.fn(),
  refreshUser: vi.fn(),
  registerWidgetProfile: vi.fn(),
  uploadProfileAvatar: vi.fn(),
  deleteProfileAvatar: vi.fn(),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: accountMocks.user,
    setUser: accountMocks.setUser,
    refreshUser: accountMocks.refreshUser,
  }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/hooks/usePortalContent', () => ({
  usePortalContent: () => ({
    publicProfile: { name: 'Marcelo Guillen', email: 'marcelo@chatboc.test', canRegister: false },
    registrationResult: null,
    registrationError: null,
    registerWidgetProfile: accountMocks.registerWidgetProfile,
  }),
}));

vi.mock('@/services/profileAvatarService', () => ({
  uploadProfileAvatar: accountMocks.uploadProfileAvatar,
  deleteProfileAvatar: accountMocks.deleteProfileAvatar,
}));

describe('UserAccountPage identity avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountMocks.user = {
      id: 1,
      name: 'Marcelo Guillen',
      email: 'marcelo@chatboc.test',
      avatar_url: undefined,
      avatar_source: undefined,
      avatar_consent: false,
    };
    accountMocks.refreshUser.mockResolvedValue(undefined);
  });

  it('shows a deterministic fallback and the consent policy when there is no profile photo', () => {
    render(<UserAccountPage />);

    expect(screen.getByText('Identidad visual')).toBeInTheDocument();
    expect(screen.getByText('Avatar generativo estable hasta que subas una foto consentida.')).toBeInTheDocument();
    expect(screen.getByText('No usamos scraping ni fotos de WhatsApp sin consentimiento.')).toBeInTheDocument();
    expect(screen.getByText('MG')).toBeInTheDocument();
  });

  it('uploads a consented profile image and updates the local user context', async () => {
    accountMocks.uploadProfileAvatar.mockResolvedValueOnce({
      avatarUrl: 'https://cdn.example.com/profile/marcelo.webp',
      avatarSource: 'profile_upload',
      avatarConsent: true,
      picture: 'https://cdn.example.com/profile/marcelo.webp',
    });

    render(<UserAccountPage />);

    const input = document.querySelector('#profile-avatar-upload') as HTMLInputElement;
    const file = new File(['avatar'], 'marcelo.webp', { type: 'image/webp' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadProfileAvatar).toHaveBeenCalledWith(file, { isWidgetRequest: true });
    });
    expect(accountMocks.setUser).toHaveBeenCalledWith(expect.objectContaining({
      avatar_url: 'https://cdn.example.com/profile/marcelo.webp',
      avatar_source: 'profile_upload',
      avatar_consent: true,
      picture: 'https://cdn.example.com/profile/marcelo.webp',
    }));
    expect(screen.getByText('Foto de perfil actualizada.')).toBeInTheDocument();
  });

  it('deletes a consented profile image and keeps the generated fallback', async () => {
    accountMocks.user = {
      ...accountMocks.user,
      avatar_url: 'https://cdn.example.com/profile/marcelo.webp',
      avatar_source: 'profile_upload',
      avatar_consent: true,
    };
    accountMocks.deleteProfileAvatar.mockResolvedValueOnce({
      avatarUrl: '',
      avatarSource: '',
      avatarConsent: false,
      picture: '',
    });

    render(<UserAccountPage />);

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));

    await waitFor(() => {
      expect(deleteProfileAvatar).toHaveBeenCalledWith({ isWidgetRequest: true });
    });
    expect(accountMocks.setUser).toHaveBeenCalledWith(expect.objectContaining({
      avatar_url: undefined,
      avatar_source: undefined,
      avatar_consent: false,
      picture: undefined,
    }));
    expect(screen.getByText('Foto eliminada. Se usa avatar generativo seguro.')).toBeInTheDocument();
  });

  it('rejects unsupported profile image formats before calling the API', () => {
    render(<UserAccountPage />);

    const input = document.querySelector('#profile-avatar-upload') as HTMLInputElement;
    const file = new File(['avatar'], 'marcelo.gif', { type: 'image/gif' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(uploadProfileAvatar).not.toHaveBeenCalled();
    expect(screen.getByText('Usa una imagen JPG, PNG o WebP.')).toBeInTheDocument();
  });
});
