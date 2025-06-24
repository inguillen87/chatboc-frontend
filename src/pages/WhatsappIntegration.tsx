import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { Button } from '@/components/ui/button';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

interface WhatsappInfo {
  descripcion: string;
  url: string;
}

export default function WhatsappIntegration() {
  useRequireRole(['admin'] as Role[]);
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
        setError(err.message || 'Error');
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;
  if (!info) return <p className="p-4">Sin información</p>;

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <p>{info.descripcion}</p>
      {info.url && (
        <Button asChild>
          <a href={info.url} target="_blank" rel="noopener noreferrer">
            Abrir WhatsApp
          </a>
        </Button>
      )}
    </div>
  );
}
