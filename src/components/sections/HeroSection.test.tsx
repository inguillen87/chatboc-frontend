import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

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
    expect(screen.getByRole('group', { name: 'Chatboc.ar Meta Tech Provider' })).toBeTruthy();
  });
});
