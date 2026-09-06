import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import HeroSection from './HeroSection';

describe('HeroSection backend-driven conversation demo', () => {
  it('does not render the phone demo when backend does not publish a traceable result', () => {
    const { container } = render(
      <MemoryRouter>
        <HeroSection
          experience={{
            hero: {
              conversation_demo: {
                flows: [
                  {
                    id: 'informativo',
                    label: 'Informativo',
                    user_message: 'Consulta simple',
                    agent_message: 'Respuesta informativa',
                  },
                ],
              },
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(container.querySelector('.chatboc-phone-demo')).toBeNull();
  });

  it('renders backend-provided operational data with a visible attachment preview', () => {
    const { container } = render(
      <MemoryRouter>
        <HeroSection
          experience={{
            hero: {
              conversation_demo: {
                flows: [
                  {
                    id: 'gobierno-reclamo',
                    sector: 'gobierno',
                    user_message: 'Quiero iniciar un reclamo con foto.',
                    agent_message: 'Recibi la evidencia y deje el reclamo listo para seguimiento.',
                    inputs: [{ kind: 'image', label: 'Foto' }],
                    action: {
                      label: 'Reclamo creado',
                      status: 'Listo',
                      fields: [{ label: 'Categoria', value: 'Alumbrado' }],
                    },
                    result: { kind: 'ticket', traceable: true },
                  },
                  {
                    id: 'empresas-pedido',
                    sector: 'empresas',
                    user_message: 'Necesito cotizar productos.',
                    agent_message: 'Prepare el pedido con total y seguimiento.',
                    action: {
                      label: 'Pedido creado',
                      status: 'Listo',
                    },
                    result: { kind: 'order', traceable: true },
                  },
                ],
              },
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(container.querySelector('.chatboc-phone-demo')).not.toBeNull();
    expect(screen.getAllByText('Foto').length).toBeGreaterThan(0);
    expect(screen.getByText('Categoria')).toBeTruthy();
    expect(screen.getByText('Alumbrado')).toBeTruthy();
    expect(screen.getByText('empresas')).toBeTruthy();
    expect(screen.getByAltText('Foto')).toBeTruthy();
    expect(container.querySelector('.chatboc-hero-attachment__media')).toBeNull();

    const tablist = screen.getByRole('tablist', { name: 'Ejemplos de conversaciones operativas' });
    const tabs = screen.getAllByRole('tab');
    const activeTab = tabs[0];
    const inactiveTab = tabs[1];
    const panel = screen.getByRole('tabpanel');

    expect(tablist).toContainElement(activeTab);
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
    expect(activeTab).toHaveAttribute('tabindex', '0');
    expect(inactiveTab).toHaveAttribute('aria-selected', 'false');
    expect(inactiveTab).toHaveAttribute('tabindex', '-1');
    expect(activeTab).toHaveAttribute('aria-controls', panel.id);
    expect(inactiveTab).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', activeTab.id);
    expect(panel).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(activeTab, { key: 'ArrowRight' });

    expect(inactiveTab).toHaveFocus();
    expect(inactiveTab).toHaveAttribute('aria-selected', 'true');
    expect(activeTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', inactiveTab.id);
    expect(screen.getByText('Pedido creado')).toBeTruthy();
  });

  it('keeps the primary page action stable when the selected demo publishes its own action', () => {
    render(
      <MemoryRouter>
        <HeroSection
          experience={{
            hero: {
              primary_cta: { label: 'Ver demo institucional', href: '/demo' },
              conversation_demo: {
                flows: [
                  {
                    id: 'gobierno-reclamo',
                    user_message: 'Quiero iniciar un reclamo.',
                    agent_message: 'El reclamo quedo listo.',
                    action: { label: 'Reclamo creado', status: 'Listo' },
                    cta: { label: 'Abrir reclamo', href: '/perfil?tab=tickets' },
                    result: { kind: 'ticket', traceable: true },
                  },
                ],
              },
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Ver demo institucional' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir reclamo' })).not.toBeInTheDocument();
  });

  it('does not replace the selected conversation while a person is reading it', () => {
    vi.useFakeTimers();
    try {
      render(
        <MemoryRouter>
          <HeroSection
            experience={{
              hero: {
                conversation_demo: {
                  flows: [
                    {
                      id: 'primero',
                      label: 'Primer caso',
                      user_message: 'Primer mensaje',
                      agent_message: 'Primera respuesta',
                      action: { label: 'Primer resultado', status: 'Listo' },
                      result: { kind: 'ticket', traceable: true },
                    },
                    {
                      id: 'segundo',
                      label: 'Segundo caso',
                      user_message: 'Segundo mensaje',
                      agent_message: 'Segunda respuesta',
                      action: { label: 'Segundo resultado', status: 'Listo' },
                      result: { kind: 'order', traceable: true },
                    },
                  ],
                },
              },
            }}
          />
        </MemoryRouter>,
      );

      expect(screen.getByText('Primer resultado')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(30_000));
      expect(screen.getByText('Primer resultado')).toBeInTheDocument();
      expect(screen.queryByText('Segundo resultado')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('names a single scrollable conversation as a keyboard-focusable region', () => {
    render(
      <MemoryRouter>
        <HeroSection
          experience={{
            hero: {
              conversation_demo: {
                flows: [
                  {
                    id: 'gobierno-reclamo',
                    label: 'Reclamo municipal',
                    user_message: 'Quiero iniciar un reclamo.',
                    agent_message: 'El reclamo quedo listo para seguimiento.',
                    action: { label: 'Reclamo creado', status: 'Listo' },
                    result: { kind: 'ticket', traceable: true },
                  },
                ],
              },
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('region', { name: 'Conversacion operativa: Reclamo municipal' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByRole('group', { name: 'Integraciones disponibles por configuración' })).toBeTruthy();
    expect(screen.queryByText('Chatboc verificado')).not.toBeInTheDocument();
    expect(screen.queryByText('Meta Business Partners')).not.toBeInTheDocument();
  });
});
