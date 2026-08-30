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
