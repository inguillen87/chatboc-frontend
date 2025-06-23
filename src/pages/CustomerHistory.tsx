import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { Button } from '@/components/ui/button';

interface HistorialItem {
  id: number;
  fecha: string;
  tipo: string;
  descripcion?: string | null;
  archivo_url?: string | null;
  // cualquier otro campo extra que venga de tickets, archivos, consultas...
}

export default function CustomerHistory() {
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/historial')
      .then((data) => {
        // Unificar los tres arrays en uno solo
        const consultas = (data.consultas || []).map((c: any) => ({
          ...c,
          tipo: 'Consulta',
        }));
        const archivos = (data.archivos || []).map((a: any) => ({
          ...a,
          tipo: 'Archivo',
        }));
        const tickets = (data.tickets || []).map((t: any) => ({
          ...t,
          tipo: 'Ticket',
        }));

        // Unir y ordenar por fecha descendente
        const todos = [...consultas, ...archivos, ...tickets].sort((a, b) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );
        setItems(todos);
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
      <h1 className="text-2xl font-bold mb-4">Historial completo</h1>
      <ul className="grid gap-3">
        {items.map((item) => (
          <li key={item.tipo + '-' + item.id} className="border-b pb-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {new Date(item.fecha).toLocaleDateString()} 
                {' · '}
                <span className="uppercase text-xs tracking-wide font-bold">{item.tipo}</span>
              </span>
              {item.archivo_url && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="ml-2"
                >
                  <a href={item.archivo_url} target="_blank" rel="noopener noreferrer">
                    Ver archivo
                  </a>
                </Button>
              )}
            </div>
            {item.descripcion && (
              <p className="text-sm text-muted-foreground">{item.descripcion}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
