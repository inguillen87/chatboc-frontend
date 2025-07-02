import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

interface Reminder {
  id: number;
  titulo: string;
  vence: string;
}

export default function Reminders() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Reminder[]>('/recordatorios')
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
      <h1 className="text-2xl font-bold mb-4">Vencimientos</h1>
      <ul className="grid gap-3">
        {items.map((r) => (
          <li key={r.id} className="border-b pb-2 flex justify-between">
            <span>{r.titulo}</span>
            <span className="text-muted-foreground">
              {new Date(r.vence).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
