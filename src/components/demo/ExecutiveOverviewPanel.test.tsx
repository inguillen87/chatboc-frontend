import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEMO_DATA_NOTICE } from '@/features/demo/demoPresentationLabels';
import ExecutiveOverviewPanel from './ExecutiveOverviewPanel';
import type { ExecutiveOverviewViewModel } from './ExecutiveOverviewPanel';

const buildModel = (): ExecutiveOverviewViewModel => ({
  title: 'Resumen general',
  description: 'Panorama de atención, reclamos y encuestas.',
  source: {
    label: 'demo.admin_preview.v1',
    mode: 'synthetic_demo_scenario',
    synthetic: true,
    suitableForDecisions: false,
    scopeLabel: 'Junín, Mendoza',
  },
  scorecards: [
    {
      id: 'cases',
      label: 'Reclamos ingresados',
      value: 184,
      unit: 'casos',
      detail: '38 siguen abiertos.',
      icon: 'claims',
      evidence: {
        sourceLabel: 'demo.admin_preview.v1',
        basis: { label: 'Casos', value: 184 },
        period: 'Últimos 30 días',
        dataMode: 'synthetic_demo_scenario',
      },
    },
    {
      id: 'sla',
      label: 'Cumplimiento de SLA',
      value: 87.5,
      unit: '%',
      detail: 'Objetivo: 85% en término.',
      icon: 'sla',
      evidence: {
        sourceLabel: 'demo.admin_preview.v1',
        basis: { label: 'Casos con SLA', value: 168 },
        period: 'Últimos 30 días',
        dataMode: 'synthetic_demo_scenario',
      },
    },
  ],
  ranking: {
    title: 'Por dónde entran las consultas',
    description: 'Participación por canal.',
    measureLabel: 'Interacciones',
    scale: 'share',
    sourceLabel: 'demo.channel_summary.v1',
    basis: { label: 'Interacciones', value: 200 },
    items: [
      { id: 'web', label: 'Web', value: 50, sharePercent: 25 },
      { id: 'whatsapp', label: 'WhatsApp', value: 120, sharePercent: 60 },
      { id: 'phone', label: 'Teléfono', value: 30, sharePercent: 15 },
    ],
  },
  journey: {
    title: 'Cómo avanza un caso',
    badge: '1 hito',
    steps: [
      {
        id: 'intake',
        title: 'Ingreso por WhatsApp',
        description: 'El vecino comparte la solicitud.',
        channel: 'WhatsApp',
        status: 'Resuelto',
      },
    ],
  },
});

describe('ExecutiveOverviewPanel', () => {
  it('renders clean scorecards with a single footer source line and unified synthetic disclosure', () => {
    const { container } = render(<ExecutiveOverviewPanel model={buildModel()} />);

    expect(screen.getByRole('heading', { name: 'Resumen general' })).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'Aviso sobre datos de ejemplo' })).toHaveTextContent(DEMO_DATA_NOTICE);
    expect(screen.getByText('184 casos')).toBeInTheDocument();
    expect(screen.getByText('87,5%')).toBeInTheDocument();
    // Single source line at the footer, not repeated per card.
    const footer = container.querySelector('[data-executive-overview-source-footer]');
    expect(footer).toHaveTextContent('Fuente: Datos de ejemplo de la demo (Junín, Mendoza).');
    expect(screen.queryByText('Base no informada')).not.toBeInTheDocument();

    const ranking = screen.getByRole('region', { name: 'Por dónde entran las consultas' });
    const rows = within(ranking).getAllByRole('listitem');
    expect(within(rows[0]).getByText('WhatsApp')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Web')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Teléfono')).toBeInTheDocument();
    expect(container.querySelector('.recharts-surface')).not.toBeInTheDocument();
  });

  it('does not draw a ranking from a single comparable category', () => {
    const model = buildModel();
    model.source = {
      label: 'Sesión actual',
      mode: 'session_generated_events',
      synthetic: false,
      partial: true,
      note: 'Solo existe una categoría con actividad.',
    };
    model.ranking = {
      ...model.ranking!,
      scale: 'relative',
      items: [{ id: 'whatsapp', label: 'WhatsApp', value: 3 }],
    };

    render(<ExecutiveOverviewPanel model={model} />);

    expect(screen.getByText('Cobertura parcial')).toBeInTheDocument();
    const ranking = screen.getByRole('region', { name: 'Por dónde entran las consultas' });
    expect(within(ranking).getByText('Todavía hay pocos canales para comparar')).toBeInTheDocument();
    expect(within(ranking).queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows a truthful empty state when no executive evidence is available', () => {
    render(
      <ExecutiveOverviewPanel
        model={{
          source: {
            label: 'Sin indicadores',
            synthetic: false,
            partial: true,
          },
          scorecards: [],
          emptyMessage: 'Todavía no hay indicadores ni actividad registrada para mostrar.',
        }}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Todavía no hay indicadores para mostrar');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Todavía no hay indicadores ni actividad registrada para mostrar.',
    );
  });
});
