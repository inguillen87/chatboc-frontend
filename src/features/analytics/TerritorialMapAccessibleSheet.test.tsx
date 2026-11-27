import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { HeatPoint } from '@/services/statsService';
import { TerritorialMapAccessibleSheet } from './TerritorialMapAccessibleSheet';

const exactPoint = (
  sourceModel: 'TenantTicket' | 'MunicipioTicket',
  ticketId: string,
  category: string,
): HeatPoint => ({
  lat: -34.58,
  lng: -60.94,
  direccion: 'Domicilio particular que nunca debe aparecer',
  addressCellLabel: 'Corredor San Martín',
  barrio: 'Centro',
  categoria: category,
  estado: 'nuevo',
  canal: 'whatsapp',
  sourceModel,
  ticketId,
});

describe('TerritorialMapAccessibleSheet', () => {
  it('opens a compact source-backed coverage matrix before the point list', () => {
    render(
      <TerritorialMapAccessibleSheet
        points={[exactPoint('MunicipioTicket', '419', 'Luminarias')]}
        canShowExactPointMarkers
        tenantSlug="junin"
        coverageScope={{
          label: 'Vista general',
          mode: 'global',
          total: 63,
          mappedCount: 12,
          pendingGeocodeCount: 34,
          outsideJurisdictionCount: 9,
        }}
        coverageDimensions={[
          {
            id: 'categories',
            label: 'Categorías',
            rows: Array.from({ length: 6 }, (_, index) => ({
              key: `category-${index + 1}`,
              label: `Categoría ${index + 1}`,
              total: 10 - index,
              mappedCount: 2,
              pendingGeocodeCount: 1,
              outsideJurisdictionCount: index === 0 ? 1 : 0,
            })),
          },
          {
            id: 'zones',
            label: 'Zonas/barrios',
            rows: [{ key: 'centro', label: 'Centro', total: 8, mappedCount: 4, pendingGeocodeCount: 3 }],
          },
          {
            id: 'locations',
            label: 'Corredores/celdas',
            rows: [{ key: 'corridor', label: 'Corredor San Martín', total: 4, mappedCount: 4 }],
          },
        ]}
        provenance={{ label: 'Procedencia parcial', detail: 'Contrato territorial vigente.' }}
        freshness={{ label: 'Actualización pendiente', detail: 'Conectividad no verificada.' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver datos accesibles (1)' }));

    expect(screen.getByTestId('territorial-coverage-matrix')).toBeInTheDocument();
    expect(screen.getByText('Lectura territorial sin barreras')).toBeInTheDocument();
    expect(screen.getByText('Fuente: Procedencia parcial')).toBeInTheDocument();
    expect(screen.getByText('Actualización pendiente')).toBeInTheDocument();
    expect(screen.getByText('63')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Cobertura territorial por categorías' })).toBeInTheDocument();
    expect(screen.getByText('Categoría 5')).toBeInTheDocument();
    expect(screen.queryByText('Categoría 6')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(screen.getByText('Categoría 6')).toBeInTheDocument();
    expect(screen.getByText('6 de 6 filas')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Puntos (1)' }), { button: 0, ctrlKey: false });
    expect(screen.getByRole('list', { name: 'Puntos territoriales filtrados' })).toBeInTheDocument();
    expect(screen.queryByText('Domicilio particular que nunca debe aparecer')).toBeNull();
  });

  it('does not present global dimension totals as a filtered cross-breakdown', () => {
    render(
      <TerritorialMapAccessibleSheet
        points={[exactPoint('MunicipioTicket', '419', 'Luminarias')]}
        canShowExactPointMarkers
        tenantSlug="junin"
        activeFilterCount={1}
        coverageScope={{
          label: 'Luminarias',
          mode: 'single',
          total: 38,
          mappedCount: 3,
          pendingGeocodeCount: 23,
          outsideJurisdictionCount: 9,
        }}
        coverageDimensions={[
          {
            id: 'categories',
            label: 'Categorías',
            rows: [{
              key: 'luminarias',
              label: 'Luminarias',
              total: 38,
              mappedCount: 3,
              pendingGeocodeCount: 23,
              outsideJurisdictionCount: 9,
              selected: true,
            }],
          },
          {
            id: 'zones',
            label: 'Zonas/barrios',
            rows: [{ key: 'centro', label: 'Centro', total: 12, mappedCount: 6 }],
          },
          { id: 'locations', label: 'Corredores/celdas', rows: [] },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver datos accesibles (1)' }));
    expect(screen.getByRole('table', { name: 'Cobertura territorial por categorías' })).toHaveTextContent('Luminarias');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Zonas/barrios' }), { button: 0, ctrlKey: false });
    expect(screen.getByText(/La selección activa pertenece a otra dimensión/)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Cobertura territorial por zonas/barrios' })).toBeNull();
  });

  it('offers a keyboard-friendly safe list with exact tenant-scoped CRM links', () => {
    render(
      <TerritorialMapAccessibleSheet
        points={[
          exactPoint('MunicipioTicket', '419', 'Luminarias'),
          exactPoint('TenantTicket', '419', 'Bacheo'),
        ]}
        canShowExactPointMarkers
        tenantSlug="junin"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver puntos en lista (2)' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Puntos territoriales filtrados' })).toBeInTheDocument();
    expect(screen.queryByText('Domicilio particular que nunca debe aparecer')).toBeNull();
    expect(screen.queryByText(/-34\.58|-60\.94/)).toBeNull();
    expect(screen.getAllByText('Corredor San Martín')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Abrir caso' }).map((link) => link.getAttribute('href')))
      .toEqual([
        '/perfil?tab=tickets&source_model=MunicipioTicket&ticket_id=419&tenant_slug=junin&tenant=junin',
        '/perfil?tab=tickets&source_model=TenantTicket&ticket_id=419&tenant_slug=junin&tenant=junin',
      ]);
  });

  it('fails closed to aggregate summaries without leaking point counts or records', () => {
    render(
      <TerritorialMapAccessibleSheet
        points={[exactPoint('MunicipioTicket', '419', 'Luminarias')]}
        canShowExactPointMarkers={false}
        tenantSlug="junin"
        summaries={[{ id: 'coverage', label: 'Cobertura', value: '68%' }]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Ver resumen territorial' })).not.toHaveTextContent('(1)');
    fireEvent.click(screen.getByRole('button', { name: 'Ver resumen territorial' }));

    expect(screen.getByTestId('territorial-list-privacy-notice')).toHaveTextContent(
      'información agregada',
    );
    expect(screen.getByText('Cobertura')).toBeInTheDocument();
    expect(screen.getByText('68%')).toBeInTheDocument();
    expect(screen.queryByText('Luminarias')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Abrir caso' })).toBeNull();
  });

  it('keeps empty contract dimensions visible with explicit unavailable or protected states', () => {
    render(
      <TerritorialMapAccessibleSheet
        points={[]}
        canShowExactPointMarkers
        tenantSlug="junin"
        coverageDimensions={[
          {
            id: 'categories',
            label: 'Categorías',
            rows: [{ key: 'luminarias', label: 'Luminarias', total: 4, mappedCount: 2 }],
          },
          { id: 'zones', label: 'Zonas/barrios', rows: [] },
          { id: 'locations', label: 'Corredores/celdas', rows: [], protected: true },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver datos accesibles (0)' }));
    expect(screen.getByRole('tab', { name: 'Categorías' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Zonas/barrios' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Corredores/celdas' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Zonas/barrios' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('No hay agregaciones verificadas para esta dimensión y los filtros actuales.')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Corredores/celdas' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('Esta segmentación está protegida por la política de privacidad del contrato.')).toBeInTheDocument();
  });

  it('renders a truthful protected empty state instead of an empty sheet', () => {
    render(
      <TerritorialMapAccessibleSheet
        points={[]}
        canShowExactPointMarkers={false}
        tenantSlug="junin"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver resumen territorial' }));
    expect(screen.getByTestId('territorial-list-privacy-notice')).toHaveTextContent('Vista territorial protegida');
    expect(screen.getByText('No hay un resumen agregado disponible para esta combinación de filtros.')).toBeInTheDocument();
  });

  it('paginates long territorial lists instead of creating an endless panel', () => {
    const points = Array.from({ length: 26 }, (_, index) =>
      exactPoint('MunicipioTicket', String(index + 1), `Categoría ${index + 1}`),
    );
    render(
      <TerritorialMapAccessibleSheet
        points={points}
        canShowExactPointMarkers
        tenantSlug="junin"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver puntos en lista (26)' }));
    expect(screen.getByText('1-25 de 26')).toBeInTheDocument();
    expect(screen.queryByText('Categoría 26')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('26-26 de 26')).toBeInTheDocument();
    expect(screen.getByText('Categoría 26')).toBeInTheDocument();
  });
});
