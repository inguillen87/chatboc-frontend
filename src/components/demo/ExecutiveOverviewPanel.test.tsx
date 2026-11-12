import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ExecutiveOverviewPanel from './ExecutiveOverviewPanel';
import type { ExecutiveOverviewViewModel } from './ExecutiveOverviewPanel';

const buildModel = (): ExecutiveOverviewViewModel => ({
  title: 'Tablero de decisión municipal',
  description: 'Lectura ejecutiva del escenario visible.',
  source: {
    label: 'Escenario Junín · corte demostrativo',
    mode: 'synthetic_demo_scenario',
    synthetic: true,
    suitableForDecisions: false,
    note: 'Partición aislada de cualquier padrón ciudadano.',
  },
  scorecards: [
    {
      id: 'cases',
      label: 'Casos observados',
      value: 184,
      detail: 'Volumen total del escenario.',
      icon: 'claims',
      evidence: {
        sourceLabel: 'API demo.admin_preview.v1',
        basis: { label: 'Casos', value: 184 },
        period: 'Corte actual',
        dataMode: 'synthetic_demo_scenario',
      },
    },
    {
      id: 'sla',
      label: 'Cumplimiento de SLA',
      value: 87.5,
      unit: '%',
      icon: 'sla',
      evidence: {
        sourceLabel: 'API demo.admin_preview.v1',
        basis: { label: 'Casos con SLA', value: 168 },
        period: 'Corte actual',
        dataMode: 'synthetic_demo_scenario',
      },
    },
  ],
  ranking: {
    title: 'Distribución por canal',
    description: 'Participación sobre las interacciones observadas.',
    measureLabel: 'Interacciones',
    scale: 'share',
    sourceLabel: 'Resumen de canales del backend',
    basis: { label: 'Interacciones', value: 200 },
    items: [
      { id: 'web', label: 'Web', value: 50, sharePercent: 25 },
      { id: 'whatsapp', label: 'WhatsApp', value: 120, sharePercent: 60 },
      { id: 'phone', label: 'Teléfono', value: 30, sharePercent: 15 },
    ],
  },
  journey: {
    title: 'Circuito de atención',
    description: 'Secuencia publicada por el backend.',
    badge: '4 hitos',
    steps: [
      {
        id: 'intake',
        title: 'Ingreso por WhatsApp',
        description: 'El vecino comparte la solicitud.',
        channel: 'WhatsApp',
        status: 'Recibido',
      },
    ],
  },
});

describe('ExecutiveOverviewPanel', () => {
  it('renders auditable scorecards, a sorted comparison and synthetic disclosure', () => {
    const { container } = render(<ExecutiveOverviewPanel model={buildModel()} />);

    expect(screen.getByRole('heading', { name: 'Tablero de decisión municipal' })).toBeInTheDocument();
    expect(screen.getByText(/escenario demostrativo · datos simulados/i)).toBeInTheDocument();
    expect(screen.getByText(/no representa mediciones oficiales/i)).toBeInTheDocument();
    expect(screen.getAllByText('API demo.admin_preview.v1')).toHaveLength(2);
    expect(screen.getByText('Casos: 184')).toBeInTheDocument();
    expect(screen.getByText('Casos con SLA: 168')).toBeInTheDocument();

    const ranking = screen.getByRole('region', { name: 'Distribución por canal' });
    const rows = within(ranking).getAllByRole('listitem');
    expect(within(rows[0]).getByText('WhatsApp')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Web')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Teléfono')).toBeInTheDocument();
    expect(within(ranking).getByText('Interacciones: 200')).toBeInTheDocument();
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
    const ranking = screen.getByRole('region', { name: 'Distribución por canal' });
    expect(within(ranking).getByText('Comparación todavía insuficiente')).toBeInTheDocument();
    expect(within(ranking).getByText(/se necesitan al menos dos categorías/i)).toBeInTheDocument();
    expect(within(ranking).queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows a truthful empty state when no executive evidence is available', () => {
    render(
      <ExecutiveOverviewPanel
        model={{
          source: {
            label: 'Backend sin indicadores',
            synthetic: false,
            partial: true,
          },
          scorecards: [],
          emptyMessage: 'No se recibieron métricas, comparaciones ni hitos.',
        }}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Sin evidencia ejecutiva disponible');
    expect(screen.getByRole('status')).toHaveTextContent('No se recibieron métricas, comparaciones ni hitos.');
  });
});
