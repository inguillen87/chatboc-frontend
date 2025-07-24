import React from 'react';
import LocationMap from './LocationMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TicketMapProps {
  ticket: {
    direccion?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    [key: string]: any;
  };
}

const TicketMap: React.FC<TicketMapProps> = ({ ticket }) => {
  const hasCoords = ticket.latitud != null && ticket.longitud != null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Ubicación del Incidente</CardTitle>
      </CardHeader>
      <CardContent>
        {ticket.direccion && <p className="mb-2 text-sm text-muted-foreground">{ticket.direccion}</p>}
        {hasCoords ? (
          <LocationMap lat={ticket.latitud!} lng={ticket.longitud!} interactive={false} />
        ) : (
          <p className="text-sm text-muted-foreground">No se ha proporcionado una ubicación en el mapa.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default TicketMap;
