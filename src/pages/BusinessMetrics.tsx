import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';

interface Metric {
  label: string;
  value: number;
}

export default function BusinessMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Metric[]>('/pyme/metrics')
      .then((data) => {
        setMetrics(data);
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
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold mb-4">Métricas</h1>
      <ul className="grid gap-3">
        {metrics.map((m) => (
          <li key={m.label} className="flex justify-between border-b pb-1">
            <span>{m.label}</span>
            <span>{m.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
