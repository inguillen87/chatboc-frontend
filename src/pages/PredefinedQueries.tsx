import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { Button } from '@/components/ui/button';

interface QueryItem {
  id: number;
  pregunta: string;
  respuesta?: string | null;
}

export default function PredefinedQueries() {
  const [items, setItems] = useState<QueryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<QueryItem[]>('/consultas-frecuentes')
      .then((data) => {
        setItems(data);
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
      <h1 className="text-2xl font-bold">Consultas frecuentes</h1>
      <ul className="grid gap-3">
        {items.map((q) => (
          <li key={q.id} className="border-b pb-2">
            <p className="font-medium">{q.pregunta}</p>
            {q.respuesta && (
              <p className="text-sm text-muted-foreground">{q.respuesta}</p>
            )}
          </li>
        ))}
      </ul>
      <Button asChild className="w-full">
        <a href="/consultas/config">Configurar</a>
      </Button>
    </div>
  );
}
