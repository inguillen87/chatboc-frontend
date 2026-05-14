import React from 'react';
import { render, screen } from '@testing-library/react';
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

  it('renders only backend-provided operational data and does not fake broken image previews', () => {
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
    expect(screen.getByText('Categoria')).toBeInTheDocument();
    expect(screen.getByText('Alumbrado')).toBeInTheDocument();
    expect(screen.getByText('empresas')).toBeInTheDocument();
    expect(container.querySelector('.chatboc-hero-attachment__media')).toBeNull();
  });
});
