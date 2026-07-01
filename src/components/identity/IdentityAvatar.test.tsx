import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getIdentityAvatarPattern,
  getIdentityAvatarTone,
  getIdentityInitials,
  IdentityAvatar,
} from './IdentityAvatar';

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

describe('IdentityAvatar', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', LoadedImageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds stable initials for single and full names', () => {
    expect(getIdentityInitials('Marcelo')).toBe('MA');
    expect(getIdentityInitials('Ana Maria Lopez')).toBe('AL');
    expect(getIdentityInitials('')).toBe('??');
  });

  it('keeps fallback color stable for the same identity', () => {
    expect(getIdentityAvatarTone('Marcelo')).toBe(getIdentityAvatarTone('Marcelo'));
    expect(getIdentityAvatarTone('Marcelo')).not.toEqual('');
  });

  it('keeps generated fallback geometry stable for the same identity', () => {
    expect(getIdentityAvatarPattern('Marcelo')).toEqual(getIdentityAvatarPattern('Marcelo'));
    expect(getIdentityAvatarPattern('Marcelo')).not.toEqual(getIdentityAvatarPattern('Ana'));
  });

  it('renders a real avatar image when an url has a consented source', async () => {
    const { container } = render(
      <IdentityAvatar
        name="Marcelo Guillen"
        avatarUrl="https://cdn.example.com/avatar.jpg"
        source="social"
        consented
      />,
    );

    await waitFor(() => {
      const image = container.querySelector('img');
      expect(image).toHaveAttribute('src', 'https://cdn.example.com/avatar.jpg');
      expect(image).toHaveAttribute('alt', 'Marcelo Guillen');
    });
  });

  it('does not render profile images without a consented source', () => {
    const { container } = render(
      <IdentityAvatar
        name="Marcelo Guillen"
        avatarUrl="https://cdn.example.com/avatar.jpg"
        source="imagen de perfil"
      />,
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('MG')).toBeInTheDocument();
  });

  it('allows an uploaded profile image with explicit consent metadata', async () => {
    const { container } = render(
      <IdentityAvatar
        name="Marcelo Guillen"
        avatarUrl="https://cdn.example.com/avatar.jpg"
        source="profile_upload"
        consented
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/avatar.jpg');
    });
  });

  it('honors explicit consent denial even for social sources', () => {
    const { container } = render(
      <IdentityAvatar
        name="Marcelo Guillen"
        avatarUrl="https://cdn.example.com/avatar.jpg"
        source="social_login"
        consented={false}
      />,
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('MG')).toBeInTheDocument();
  });

  it('blocks scraped or unconsented avatar sources', () => {
    const { container } = render(
      <IdentityAvatar
        name="Vecino Junin"
        avatarUrl="https://cdn.example.com/avatar.jpg"
        source="whatsapp_scraped_unconsented"
      />,
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('VJ')).toBeInTheDocument();
  });

  it('does not trust ambiguous WhatsApp upload labels without explicit consent', () => {
    const { container } = render(
      <IdentityAvatar
        name="Vecino Junin"
        avatarUrl="https://cdn.example.com/avatar.jpg"
        source="whatsapp_media_upload"
      />,
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('VJ')).toBeInTheDocument();
  });

  it('does not use WhatsApp media labels as profile identity even with consent', () => {
    const { container } = render(
      <IdentityAvatar
        name="Vecino Junin"
        avatarUrl="https://cdn.example.com/avatar.jpg"
        source="whatsapp_media_upload"
        consented
      />,
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('VJ')).toBeInTheDocument();
  });

  it('falls back to initials without inventing a fake photo', () => {
    const { container } = render(<IdentityAvatar name="Vecino Junin" />);

    expect(screen.getByText('VJ')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('[title="Vecino Junin - Avatar generativo por identidad"]')).toBeInTheDocument();
  });
});
