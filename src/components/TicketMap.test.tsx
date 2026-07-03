import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TicketMap from './TicketMap';

describe('TicketMap', () => {
  it('renders a premium operational route overlay for geolocated tickets', () => {
    render(
      <TicketMap
        ticket={{
          municipio_nombre: 'Municipalidad de Junin',
          lat_actual: -33.08,
          lon_actual: -68.48,
          lat_destino: -33.079,
          lon_destino: -68.47,
          direccion: 'Don Bosco 55',
          distrito: 'Junin',
          tipo: 'municipio',
        }}
        status="en_proceso"
        estimatedTime="24 h"
        createdAtLabel="5/6/26, 21:03"
        lastUpdatedLabel="5/6/26, 21:15"
      />,
    );

    expect(screen.getByTestId('ticket-map')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-map-telemetry')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-map-route-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-map-operational-panel')).toHaveTextContent('Ruta estimada');
    expect(screen.getByTestId('ticket-map-operational-panel')).toHaveTextContent('Origen y destino disponibles');
    expect(screen.getByTestId('ticket-map-operational-panel')).toHaveTextContent('En proceso');
    expect(screen.getByTestId('ticket-map-operational-panel')).toHaveTextContent('24 h');
    expect(screen.getByRole('link', { name: /Abrir mapa/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=-33.079,-68.47',
    );
  });

  it('renders a GPS map contract and quality signal for coordinate-only tickets', () => {
    render(
      <TicketMap
        ticket={{
          latitud: -33.079,
          longitud: -68.47,
          direccion: 'Don Bosco 55',
          tipo: 'municipio',
        }}
      />,
    );

    const iframe = screen.getByTitle('Ubicacion aproximada');
    expect(iframe).toHaveAttribute('src', expect.stringContaining('maps.google.com'));
    expect(screen.getByRole('link', { name: /Abrir mapa/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=-33.079,-68.47',
    );
    expect(screen.getByTestId('ticket-map-operational-panel')).toHaveTextContent('GPS validado');
  });

  it('does not render a decorative map without address or coordinates', () => {
    const { container } = render(<TicketMap ticket={{ tipo: 'municipio' }} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('ticket-map')).not.toBeInTheDocument();
  });
});
