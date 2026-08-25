import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DemoWorkspace from './DemoWorkspace';
import type { DemoWorkspaceConfig } from './demoTypes';

vi.mock('@/features/chat/ChatPanel', () => ({
  default: () => <div data-testid="chat-panel">chat</div>,
}));

describe('DemoWorkspace rubro tools', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders repeated backend tool ids without React duplicate-key warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const workspace = {
      rubro_tools: [
        {
          id: 'catalog',
          kind: 'catalog',
          label: 'Catalogo principal',
          enabled: true,
        },
        {
          id: 'catalog',
          kind: 'catalog',
          label: 'Catalogo mayorista',
          enabled: true,
        },
      ],
    } as DemoWorkspaceConfig;

    render(<DemoWorkspace workspace={workspace} sector="empresas" rubro="ferreteria" />);

    expect(screen.getByText('Catalogo principal')).toBeInTheDocument();
    expect(screen.getByText('Catalogo mayorista')).toBeInTheDocument();
    expect(
      consoleError.mock.calls.some((call) =>
        call.some((item) => String(item).includes('Encountered two children with the same key')),
      ),
    ).toBe(false);
  });

  it('renders a mirrored municipal tool only once', () => {
    const catalog = {
      id: 'catalog',
      kind: 'rubro_tool',
      label: 'Catalogo municipal',
      enabled: true,
      action_label: 'Abrir catalogo',
      items: [{ url: '/api/v2/demo/catalogo.pdf' }],
      fields: [{ label: 'Recursos', value: 4 }],
    };
    const workspace = {
      rubro_tools: {
        enabled_tools: [catalog],
        tools: [{ ...catalog }],
      },
    } as DemoWorkspaceConfig;

    render(<DemoWorkspace workspace={workspace} sector="gobierno" rubro="municipio" />);

    expect(screen.getAllByText('Catalogo municipal')).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /abrir catalogo/i })).toHaveLength(1);
  });

  it('contains long contact values inside the responsive tool card', () => {
    const longUrl = 'https://www.juninmendoza.gov.ar/participacion/consultas-y-reclamos';
    const workspace = {
      rubro_tools: [
        {
          id: 'municipal-contact',
          kind: 'phone',
          label: 'Telefono y contacto',
          enabled: true,
          fields: [
            { label: 'Sitio oficial', value: longUrl },
            { label: 'Telefono', value: '+54 9 261 555 0198 interno 1743' },
          ],
        },
      ],
    } as DemoWorkspaceConfig;

    render(<DemoWorkspace workspace={workspace} sector="gobierno" rubro="municipio" />);

    const value = screen.getByText(longUrl);
    expect(value).toHaveClass('min-w-0', 'break-words', '[overflow-wrap:anywhere]');
    expect(value.closest('article')).toHaveClass('min-w-0', 'overflow-hidden');
  });

  it('shows an intentional conversation skeleton while a direct demo session connects', () => {
    render(
      <DemoWorkspace
        workspace={null}
        sector="gobierno"
        rubro="municipio"
        loading
      />,
    );

    expect(screen.getByRole('status', { name: /preparando la conversación de la demo/i })).toBeInTheDocument();
    expect(screen.getByText('Preparando conversación operativa')).toBeInTheDocument();
    expect(screen.queryByText('Demo conversacional no disponible')).not.toBeInTheDocument();
  });

  it('presents backend enums as professional Spanish labels', () => {
    const workspace = {
      chat_bootstrap: { same_origin_endpoint: '/api/v2/demo/chat' },
      media_capabilities: {
        input_modes: {
          audio: { enabled: true },
          location: { enabled: true },
        },
      },
      value_cards: [{ key: 'status', title: 'Estado operativo', status: 'ready' }],
    } as DemoWorkspaceConfig;

    render(<DemoWorkspace workspace={workspace} sector="gobierno" rubro="municipio" />);

    expect(screen.getByText('En línea')).toBeInTheDocument();
    expect(screen.getByText('Gobierno')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Ubicación')).toBeInTheDocument();
    expect(screen.getByText('Listo')).toBeInTheDocument();
  });
});
