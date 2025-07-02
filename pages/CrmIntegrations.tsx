import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { Button } from '@/components/ui/button';

interface CrmSystem {
  id: number;
  nombre: string;
  descripcion?: string | null;
  url?: string | null;
}

export default function CrmIntegrations() {
  const [items, setItems] = useState<CrmSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CrmSystem[]>('/crm/integrations')
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(getErrorMessage(err, 'Error'));
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Integraciones CRM</h1>
      <ul className="grid gap-3">
        {items.map((i) => (
          <li key={i.id} className="border-b pb-2">
            <p className="font-medium">{i.nombre}</p>
            {i.descripcion && (
              <p className="text-sm text-muted-foreground">{i.descripcion}</p>
            )}
            {i.url && (
              <Button asChild variant="outline" size="sm" className="mt-1">
                <a href={i.url} target="_blank" rel="noopener noreferrer">
                  Ver más
                </a>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
