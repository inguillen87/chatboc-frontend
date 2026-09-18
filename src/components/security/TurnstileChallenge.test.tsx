import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TurnstileChallenge } from './TurnstileChallenge';

describe('TurnstileChallenge', () => {
  afterEach(() => {
    delete window.turnstile;
    document.getElementById('chatboc-cloudflare-turnstile')?.remove();
  });

  it('offers a real retry action and recovers after a transient script failure', async () => {
    const onToken = vi.fn();
    render(<TurnstileChallenge siteKey="test-site-key" onToken={onToken} />);

    const firstScript = await waitFor(() => {
      const script = document.getElementById('chatboc-cloudflare-turnstile');
      expect(script).toBeInstanceOf(HTMLScriptElement);
      return script as HTMLScriptElement;
    });
    fireEvent.error(firstScript);

    const retry = await screen.findByRole('button', { name: 'Reintentar verificación' });
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar la verificación');

    fireEvent.click(retry);
    const secondScript = await waitFor(() => {
      const script = document.getElementById('chatboc-cloudflare-turnstile');
      expect(script).toBeInstanceOf(HTMLScriptElement);
      expect(script).not.toBe(firstScript);
      return script as HTMLScriptElement;
    });

    window.turnstile = {
      render: vi.fn((_container, options) => {
        options.callback?.('verified-test-token');
        return 'widget-1';
      }),
      remove: vi.fn(),
      reset: vi.fn(),
    };
    fireEvent.load(secondScript);

    await waitFor(() => expect(onToken).toHaveBeenCalledWith('verified-test-token'));
    expect(screen.getByText('Validado')).toBeInTheDocument();
  });
});
