import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ExecutiveClaimsPanel, { type ExecutiveClaimCase } from './ExecutiveClaimsPanel';

const cases: ExecutiveClaimCase[] = [
  {
    id: 'case-1',
    caseCode: 'REC-1001',
    title: 'Luminaria apagada',
    category: 'Alumbrado',
    status: 'en_gestion',
    priority: 'alta',
    channel: 'whatsapp',
    zone: 'Centro',
    slaStatus: 'en_riesgo',
    openedAtLabel: 'Hace 3 horas',
    hasLocation: true,
    dataMode: 'synthetic_demo_scenario',
  },
  {
    id: 'case-2',
    caseCode: 'REC-1002',
    title: 'Bache en calzada',
    category: 'Vía pública',
    status: 'abierto',
    priority: 'media',
    channel: 'web',
    zone: 'Norte',
    slaStatus: 'dentro_de_plazo',
    hasLocation: false,
    dataMode: 'synthetic_demo_scenario',
  },
  {
    id: 'case-3',
    caseCode: 'REC-1003',
    title: 'Recolección pendiente',
    category: 'Servicios urbanos',
    status: 'en_gestion',
    priority: null,
    channel: 'widget_chat',
    zone: null,
    slaStatus: null,
    dataMode: 'synthetic_demo_scenario',
  },
];

describe('ExecutiveClaimsPanel', () => {
  it('renders source-backed coverage and ranked distributions without inventing compliance', () => {
    render(
      <ExecutiveClaimsPanel
        cases={cases}
        sourceKind="synthetic"
        sourceLabel="Casos simulados"
        sample={{ isSample: true, displayedCases: 3, totalCases: 184, label: 'Muestra territorial.' }}
      />,
    );

    expect(screen.getByText('Casos simulados')).toBeVisible();
    expect(screen.getByText(/no corresponden a personas reales/i)).toBeVisible();
    expect(screen.getByText('3 de 184 casos informados por el contrato.')).toBeVisible();
    expect(screen.getByText('3/3')).toBeVisible();
    expect(screen.getByText('2/3')).toBeVisible();
    expect(screen.getByText('sin inferir cumplimiento')).toBeVisible();

    const statusChart = screen.getByRole('region', { name: 'Distribución por estado' });
    expect(within(statusChart).getByRole('progressbar', { name: 'En gestion: 2 de 3 casos con dato, 66,7 %' })).toBeVisible();
    expect(within(statusChart).getByText('Base del gráfico: 3 de 3 casos visibles con este campo informado.')).toBeVisible();
    expect(screen.queryByText(/% de cumplimiento/i)).not.toBeInTheDocument();
  });

  it('keeps backend order and exposes optional actions accessibly', () => {
    const onOpenCase = vi.fn();
    const onShowCaseOnMap = vi.fn();
    render(
      <ExecutiveClaimsPanel
        cases={cases}
        sourceKind="session"
        onOpenCase={onOpenCase}
        onShowCaseOnMap={onShowCaseOnMap}
      />,
    );

    const queue = screen.getByRole('region', { name: 'Cola operativa visible' });
    const headings = within(queue).getAllByRole('heading', { level: 5 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Luminaria apagada',
      'Bache en calzada',
      'Recolección pendiente',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalle de REC-1001' }));
    expect(onOpenCase).toHaveBeenCalledWith(cases[0]);

    const unavailableMapButton = screen.getByRole('button', { name: 'Mostrar REC-1002 en el mapa' });
    expect(unavailableMapButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar REC-1001 en el mapa' }));
    expect(onShowCaseOnMap).toHaveBeenCalledWith(cases[0]);
  });

  it('uses explicit empty and inconsistent states', () => {
    const { rerender } = render(
      <ExecutiveClaimsPanel cases={[]} sourceKind="unknown" />,
    );

    expect(screen.getByText('Fuente no informada')).toBeVisible();
    expect(screen.getByText('Sin casos en el contrato actual')).toBeVisible();
    expect(screen.getByText(/no genera casos ni indicadores sustitutos/i)).toBeVisible();

    rerender(
      <ExecutiveClaimsPanel
        cases={cases}
        sourceKind="synthetic"
        sample={{ isSample: true, displayedCases: 5, totalCases: 2 }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('declara 5 casos visibles y entregó 3');
    expect(screen.getByRole('alert')).toHaveTextContent('sin completar ni descartar información');
  });
});
