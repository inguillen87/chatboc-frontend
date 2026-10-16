import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChatUserPanel from './ChatUserPanel';
import { uploadProfileAvatar } from '@/services/profileAvatarService';

const apiFetchMock = vi.fn();
const safeLocalStorageGetItemMock = vi.fn();
const safeLocalStorageSetItemMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

vi.mock('@/utils/safeLocalStorage', () => ({
  safeLocalStorage: {
    getItem: (...args: unknown[]) => safeLocalStorageGetItemMock(...args),
    setItem: (...args: unknown[]) => safeLocalStorageSetItemMock(...args),
  },
}));

vi.mock('@/services/profileAvatarService', () => ({
  uploadProfileAvatar: vi.fn(),
}));

describe('ChatUserPanel avatar policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    safeLocalStorageGetItemMock.mockImplementation((key: string) => {
      if (key === 'tenantSlug') return 'junin';
      if (key === 'tenant') return JSON.stringify({ id: 1, interaction: { quick_actions: [] } });
      if (key === 'user') return JSON.stringify({ id: 10, name: 'Marcelo Guillen' });
      return null;
    });
    apiFetchMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/api/me') {
        return Promise.resolve({
          name: 'Marcelo Guillen',
          email: 'marcelo@chatboc.test',
          telefono: '+549261000000',
          avatar_url: '',
          avatar_source: '',
          avatar_consent: false,
        });
      }
      if (endpoint.startsWith('/tickets/mis')) return Promise.resolve([]);
      return Promise.resolve({});
    });
  });

  it('shows a safe deterministic fallback instead of implying WhatsApp profile scraping', async () => {
    render(<ChatUserPanel onClose={vi.fn()} />);

    await screen.findByText('Fallback seguro');

    expect(screen.getByText('Fallback seguro')).toBeInTheDocument();
    expect(screen.getByText(/No tomamos fotos de WhatsApp ni usamos scraping/i)).toBeInTheDocument();
    expect(screen.getByText(/Autorizo usar esta imagen en reclamos, pedidos, encuestas y conversaciones/i)).toBeInTheDocument();
    expect(screen.getByText('MG')).toBeInTheDocument();
  });

  it('marks uploaded profile images as real only after consented upload succeeds', async () => {
    vi.mocked(uploadProfileAvatar).mockResolvedValueOnce({
      avatarUrl: 'https://cdn.example.com/profile/marcelo.webp',
      avatarSource: 'profile_upload',
      avatarConsent: true,
      picture: 'https://cdn.example.com/profile/marcelo.webp',
    });

    render(<ChatUserPanel onClose={vi.fn()} />);

    await screen.findByText('Fallback seguro');

    const input = document.querySelector('#profile-avatar-upload') as HTMLInputElement;
    const file = new File(['avatar'], 'marcelo.webp', { type: 'image/webp' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadProfileAvatar).toHaveBeenCalledWith(file, { isWidgetRequest: true });
    });
    expect(await screen.findByText('Imagen real autorizada')).toBeInTheDocument();
  });
});
