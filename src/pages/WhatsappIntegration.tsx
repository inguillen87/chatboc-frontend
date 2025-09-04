import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import { ExternalLink } from 'lucide-react';

interface WhatsappInfo {
  descripcion: string;
  url: string;
}

export default function WhatsappIntegration() {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const [info, setInfo] = useState<WhatsappInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<WhatsappInfo>('/municipal/whatsapp')
      .then((data) => {
        setInfo(data);
        setLoading(false);
      })
      .catch((err: any) => {
        const message = err instanceof ApiError ? err.message : 'Error';
        setError(message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="p-4 max-w-md mx-auto space-y-2" aria-busy="true">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  if (error)
    return (
      <Alert variant="destructive" className="max-w-md mx-auto">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  if (!info) return <p className="p-4">Sin información</p>;

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <p>{info.descripcion}</p>
      {info.url && (
        <Button asChild className="inline-flex items-center gap-2">
          <a href={info.url} target="_blank" rel="noopener noreferrer">
            Abrir WhatsApp
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
}
