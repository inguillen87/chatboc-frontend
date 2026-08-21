import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setMobileNavigationOpen } from './mobileNavigationOverlay';
import { PwaInstallPrompt } from './PwaInstallPrompt';

describe('PwaInstallPrompt landmarks', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setMobileNavigationOpen(false);
  });

  afterEach(() => setMobileNavigationOpen(false));

  it('uses a labelled complementary landmark instead of a status role for interactive controls', async () => {
    render(<PwaInstallPrompt />);

    await act(async () => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });

    expect(screen.getByRole('complementary', { name: 'Instalar Chatboc' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('removes the install prompt from the accessibility tree while mobile navigation is open', async () => {
    render(<PwaInstallPrompt />);

    await act(async () => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
    expect(screen.getByRole('complementary', { name: 'Instalar Chatboc' })).toBeInTheDocument();

    act(() => setMobileNavigationOpen(true));
    expect(screen.queryByRole('complementary', { name: 'Instalar Chatboc' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar aviso de instalación' })).not.toBeInTheDocument();

    act(() => setMobileNavigationOpen(false));
    expect(screen.getByRole('complementary', { name: 'Instalar Chatboc' })).toBeInTheDocument();
  });
});
