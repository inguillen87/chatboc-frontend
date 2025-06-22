import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import TicketMap from '@/components/TicketMap';

interface Incident {
  id: number;
  latitud?: number | null;
  longitud?: number | null;
  direccion?: string | null;
  municipio_nombre?: string | null;
  tipo?: 'pyme' | 'municipio';
  descripcion?: string | null;
}

export default function IncidentsMap() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Incident[]>('/municipal/incidents')
      .then((data) => {
        setIncidents(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || 'Error');
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Cargando...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de incidentes</h1>
      <div className="grid gap-6">
        {incidents.map((inc) => (
          <div key={inc.id}>
            <TicketMap ticket={inc} />
            {inc.descripcion && (
              <p className="text-sm mt-1">{inc.descripcion}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
