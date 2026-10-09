import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChannelPreview, { type PreviewChannel } from './ChannelPreview';

afterEach(cleanup);

describe('channel transport simulation', () => {
  it.each<PreviewChannel>(['whatsapp', 'telegram', 'web', 'email', 'mercadolibre', 'tiendanube'])('does not invent conversation or operation for %s', channel => {
    const { container } = render(<ChannelPreview channel={channel} />);
    expect(screen.getByText('Simulación de transporte')).toBeVisible();
    expect(screen.getByText('Todavía no hay un mensaje de prueba en el borrador.')).toBeVisible();
    expect(screen.getByText(/no envía mensajes ni confirma conexión, entrega o lectura/)).toBeVisible();
    expect(container).not.toHaveTextContent(/stock|en l[ií]nea|cliente@email|10:4|✓|Producto Demo|Hola, gracias/i);
    expect(container.querySelector('input, textarea, img, a')).toBeNull();
    expect(container.innerHTML).not.toContain('https://');
  });

  it('shows only the supplied draft and preserves it when switching the transport', () => {
    const draft = 'Borrador sintético local\nSin entrega real';
    const view = render(<ChannelPreview channel="whatsapp" message={draft} />);
    expect(screen.getByText('Borrador de prueba')).toBeVisible();
    expect(screen.getByText(/Borrador sintético local/)).toHaveTextContent('Sin entrega real');
    view.rerender(<ChannelPreview channel="telegram" message={draft} />);
    expect(screen.getByText('Telegram')).toBeVisible();
    expect(screen.getByText(/Borrador sintético local/)).toBeVisible();
    view.rerender(<ChannelPreview channel="telegram" message="  " />);
    expect(screen.queryByText('Borrador de prueba')).not.toBeInTheDocument();
    expect(screen.queryByText(/Borrador sintético local/)).not.toBeInTheDocument();
  });
});
