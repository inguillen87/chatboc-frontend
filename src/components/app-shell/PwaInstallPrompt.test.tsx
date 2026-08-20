import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PwaInstallPrompt } from './PwaInstallPrompt';

describe('PwaInstallPrompt landmarks', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses a labelled complementary landmark instead of a status role for interactive controls', async () => {
    render(<PwaInstallPrompt />);

    await act(async () => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });

    expect(screen.getByRole('complementary', { name: 'Instalar Chatboc' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
