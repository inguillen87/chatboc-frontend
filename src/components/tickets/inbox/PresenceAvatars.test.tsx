import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PresenceAvatars } from './PresenceAvatars';

class LoadedImageMock {
  private listeners = new Map<string, Array<() => void>>();

  addEventListener(eventName: string, listener: () => void) {
    const current = this.listeners.get(eventName) || [];
    this.listeners.set(eventName, [...current, listener]);
  }

  removeEventListener(eventName: string, listener: () => void) {
    const current = this.listeners.get(eventName) || [];
    this.listeners.set(
      eventName,
      current.filter((item) => item !== listener),
    );
  }

  set src(_value: string) {
    setTimeout(() => {
      this.listeners.get('load')?.forEach((listener) => listener());
    }, 0);
  }
}

describe('PresenceAvatars', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', LoadedImageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a live user image only when source and consent are present', async () => {
    const { container } = render(
      <PresenceAvatars
        users={[
          {
            id: 'u1',
            name: 'Marcelo Guillen',
            type: 'user',
            status: 'online',
            avatarUrl: 'https://cdn.example.com/profile/marcelo.webp',
            avatarSource: 'profile_upload',
            avatarConsent: true,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/profile/marcelo.webp');
    });
  });

  it('falls back to generated initials when a presence avatar has no consent metadata', () => {
    const { container } = render(
      <PresenceAvatars
        users={[
          {
            id: 'u1',
            name: 'Marcelo Guillen',
            type: 'user',
            status: 'online',
            avatarUrl: 'https://cdn.example.com/profile/marcelo.webp',
          },
        ]}
      />,
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('MG');
  });

  it('renders an internal agent profile image only with explicit consent', async () => {
    const { container } = render(
      <PresenceAvatars
        users={[
          {
            id: 'a1',
            name: 'Operador Junin',
            type: 'agent',
            status: 'online',
            avatarUrl: 'https://cdn.example.com/profile/operator.webp',
            avatarSource: 'agent_profile',
            avatarConsent: true,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/profile/operator.webp');
    });
  });
});
