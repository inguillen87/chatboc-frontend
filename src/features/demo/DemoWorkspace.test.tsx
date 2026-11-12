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

    expect(screen.getByText('Catálogo principal')).toBeInTheDocument();
    expect(screen.getByText('Catálogo mayorista')).toBeInTheDocument();
    expect(
      screen.getByText('Catálogo, precios, ubicación, horarios y consultas disponibles para esta demo.'),
    ).toBeInTheDocument();
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
      description: 'Portal publico de tramites',
      items: [{ url: '/api/v2/demo/catalogo.pdf' }],
      fields: [{ label: 'Ubicacion', value: 'Delegacion central' }],
    };
    const workspace = {
      rubro_tools: {
        enabled_tools: [catalog],
        tools: [{ ...catalog }],
      },
    } as DemoWorkspaceConfig;

    render(<DemoWorkspace workspace={workspace} sector="gobierno" rubro="municipio" />);

    expect(screen.getAllByText('Catálogo municipal')).toHaveLength(1);
    expect(screen.getByText('Portal público de trámites')).toBeInTheDocument();
    expect(screen.getByText('Ubicación')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /abrir catálogo/i })).toHaveLength(1);
  });

  it('contains long contact values inside the responsive tool card', () => {
    const longUrl = 'https://www.juninmendoza.gov.ar/participacion/consultas-y-reclamos';
    const workspace = {
      title: 'Municipalidad de Junin',
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
    const contactCard = value.closest('article');
    expect(screen.getByText('Municipalidad de Junín')).toBeInTheDocument();
    expect(screen.getByText('Teléfono y contacto')).toBeInTheDocument();
    expect(screen.getByText('Teléfono')).toBeInTheDocument();
    expect(value).toHaveClass(
      'min-w-0',
      'break-words',
      'text-left',
      'leading-5',
      '[overflow-wrap:anywhere]',
    );
    expect(value.parentElement).toHaveClass('min-w-0', 'rounded-lg', 'px-3', 'py-2.5');
    expect(value.closest('dl')).toHaveClass('min-w-0', 'grid', 'gap-2');
    expect(value.closest('dl')).not.toHaveClass('md:grid-cols-2');
    expect(contactCard).toHaveClass('min-w-0', 'overflow-hidden', 'sm:col-span-2');
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

  it('uses polished Spanish copy for the unavailable runtime state', () => {
    const workspace = {
      empty_states: {
        runtime_unavailable: {
          title: 'Atencion en Junin',
          description: 'Esta experiencia todavia no esta disponible para probar en vivo.',
        },
      },
    } as DemoWorkspaceConfig;

    render(<DemoWorkspace workspace={workspace} sector="gobierno" rubro="municipio" />);

    expect(screen.getByText('Atención en Junín')).toBeInTheDocument();
    expect(
      screen.getByText('Esta experiencia todavía no está disponible para probar en vivo.'),
    ).toBeInTheDocument();
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
