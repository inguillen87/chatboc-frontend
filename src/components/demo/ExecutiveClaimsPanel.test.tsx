import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_DATA_NOTICE } from '@/features/demo/demoPresentationLabels';
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
    openedAtLabel: '08:40 del día simulado',
    hasLocation: true,
    dataMode: 'synthetic_demo_scenario',
  },
  {
    id: 'case-2',
    caseCode: 'REC-1002',
    title: 'Bache en calzada',
    category: 'Vía pública',
    status: 'resolved',
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
  it('renders clear sections by status, category, zone and latest claims with unified synthetic notice', () => {
    render(
      <ExecutiveClaimsPanel
        cases={cases}
        sourceKind="synthetic"
        sample={{ isSample: true, displayedCases: 3, totalCases: 184 }}
      />,
    );

    expect(screen.getByRole('note')).toHaveTextContent(DEMO_DATA_NOTICE);
    expect(screen.getByRole('heading', { name: 'Cómo están hoy' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Por categoría' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Por zona' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Últimos reclamos' })).toBeVisible();
    expect(screen.getByText('Mostrando 3 de 184 reclamos recientes')).toBeVisible();
    expect(screen.getByText('Hoy, 08:40')).toBeVisible();
    expect(screen.queryByText(/del día simulado/i)).not.toBeInTheDocument();

    const statusSection = screen.getByRole('region', { name: 'Cómo están hoy' });
    expect(
      within(statusSection).getByRole('progressbar', { name: 'En gestion: 2 de 3 casos, 66,7 %' }),
    ).toBeVisible();
  });

  it('keeps order and exposes optional actions accessibly', () => {
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

    const queue = screen.getByRole('region', { name: 'Últimos reclamos' });
    const headings = within(queue).getAllByRole('heading', { level: 4 });
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

    expect(screen.getByText('Todavía no hay reclamos cargados')).toBeVisible();

    rerender(
      <ExecutiveClaimsPanel
        cases={cases}
        sourceKind="synthetic"
        sample={{ isSample: true, displayedCases: 5, totalCases: 2 }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('se anunciaron 5 casos y llegaron 3');
  });
});
