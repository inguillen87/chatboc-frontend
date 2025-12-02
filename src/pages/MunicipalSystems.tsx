import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError, getErrorMessage } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

interface Integration {
  id: number;
  nombre: string;
  descripcion?: string | null;
  url?: string | null;
}

export default function MunicipalSystems() {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notAvailable, setNotAvailable] = useState(false);

  useEffect(() => {
    apiFetch<Integration[]>('/municipal/integrations')
      .then((data) => {
        setIntegrations(data);
        setLoading(false);
      })
      .catch((err: any) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotAvailable(true);
          setError('Esta sección aún no está habilitada para la entidad.');
        } else {
          setError(getErrorMessage(err, 'Error'));
        }
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="p-4 space-y-3 max-w-2xl mx-auto" aria-busy="true">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  if (notAvailable)
    return (
      <Alert className="max-w-2xl mx-auto">
        <AlertTitle>Integraciones no disponibles</AlertTitle>
        <AlertDescription>
          {error || 'Todavía no hay sistemas conectados para este municipio. Cuando se habiliten, aparecerán aquí.'}
        </AlertDescription>
      </Alert>
    );
  if (error)
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <AlertTitle>Error al cargar integraciones</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Sistemas conectados</h1>
      {integrations.length === 0 ? (
        <Alert>
          <AlertTitle>Aún no hay conexiones</AlertTitle>
          <AlertDescription>
            Cuando el backend exponga las integraciones disponibles, las verás listadas en esta página. Si esperabas verlas ya, verifica que el
            endpoint /municipal/integrations esté operativo.
          </AlertDescription>
        </Alert>
      ) : (
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
      )}
    </div>
  );
}
