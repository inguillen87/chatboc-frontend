import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError, getErrorMessage } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [notAvailable, setNotAvailable] = useState(false);

  useEffect(() => {
    apiFetch<CrmSystem[]>('/crm/integrations')
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err: any) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotAvailable(true);
          setError('Esta sección aún no está habilitada.');
        } else {
          setError(getErrorMessage(err, 'Error'));
        }
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="p-4 space-y-3 max-w-2xl mx-auto" aria-busy="true">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  if (notAvailable)
    return (
      <Alert className="max-w-2xl mx-auto">
        <AlertTitle>Integraciones CRM no disponibles</AlertTitle>
        <AlertDescription>
          {error || 'El backend aún no expone integraciones de CRM para esta entidad. Cuando se habiliten, aparecerán aquí.'}
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
      <h1 className="text-2xl font-bold">Integraciones CRM</h1>
      {items.length === 0 ? (
        <Alert>
          <AlertTitle>No hay integraciones configuradas</AlertTitle>
          <AlertDescription>
            Solicita al administrador habilitar o cargar integraciones CRM en el backend. Cuando existan registros, se mostrarán aquí automáticamente.
          </AlertDescription>
        </Alert>
      ) : (
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
      )}
    </div>
  );
}
