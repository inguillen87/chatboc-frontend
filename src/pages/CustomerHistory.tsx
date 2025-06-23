import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { Button } from '@/components/ui/button';

interface RecordItem {
  id: number;
  fecha: string;
  tipo: string;
  descripcion?: string | null;
  archivo_url?: string | null;
}

export default function CustomerHistory() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/historial')
      .then((data) => {
        if (!data || (typeof data !== 'object')) {
          setRecords([]);
          setError('Sin datos');
        } else {
          // Unificás todos los arrays
          const consultas = Array.isArray(data.consultas) ? data.consultas : [];
          const archivos = Array.isArray(data.archivos) ? data.archivos : [];
          const tickets = Array.isArray(data.tickets) ? data.tickets : [];
          // Le agregás "tipo" si falta para poder mostrar
          const all = [
            ...consultas.map((x) => ({ ...x, tipo: x.tipo || 'Consulta' })),
            ...archivos.map((x) => ({ ...x, tipo: x.tipo || 'Archivo' })),
            ...tickets.map((x) => ({ ...x, tipo: x.tipo || 'Ticket' })),
          ];
          // Ordena por fecha descendente
          all.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
          setRecords(all);
        }
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || 'Error');
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold mb-4">Historial</h1>
      <ul className="grid gap-3">
        {records.map((r) => (
          <li key={r.id + '-' + r.tipo} className="border-b pb-2">
            <p className="font-medium">
              <span className="mr-2">{new Date(r.fecha).toLocaleDateString()}</span>
              {r.tipo}
            </p>
            {r.descripcion && (
              <p className="text-sm text-muted-foreground">{r.descripcion}</p>
            )}
            {r.archivo_url && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-1"
              >
                <a href={r.archivo_url} target="_blank" rel="noopener noreferrer">
                  Ver archivo
                </a>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
