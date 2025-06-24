import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError, getErrorMessage } from '@/utils/api';
import { Button } from '@/components/ui/button';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

interface Integration {
  id: number;
  nombre: string;
  descripcion?: string | null;
  url?: string | null;
}

export default function MunicipalSystems() {
  useRequireRole(['admin'] as Role[]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Integration[]>('/municipal/integrations')
      .then((data) => {
        setIntegrations(data);
        setLoading(false);
      })
      .catch((err: any) => {
        if (err instanceof ApiError && err.status === 404) {
          setError('Funcionalidad no disponible');
        } else {
          setError(getErrorMessage(err, 'Error'));
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Sistemas conectados</h1>
      <ul className="grid gap-3">
        {integrations.map((i) => (
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
