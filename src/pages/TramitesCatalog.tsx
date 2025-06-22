import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Tramite {
  id: number;
  nombre: string;
  descripcion?: string | null;
  archivo_url?: string | null;
}

export default function TramitesCatalog() {
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [filtered, setFiltered] = useState<Tramite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch<Tramite[]>('/municipal/tramites')
      .then((data) => {
        const ordered = [...data].sort((a, b) =>
          a.nombre.localeCompare(b.nombre)
        );
        setTramites(ordered);
        setFiltered(ordered);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || 'Error');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      tramites.filter((t) => t.nombre.toLowerCase().includes(q))
    );
  }, [search, tramites]);

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Buscar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ul className="grid gap-3">
        {filtered.map((t) => (
          <li key={t.id} className="border-b pb-2">
            <p className="font-medium">{t.nombre}</p>
            {t.descripcion && (
              <p className="text-sm text-muted-foreground">{t.descripcion}</p>
            )}
            {t.archivo_url && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-1"
              >
                <a href={t.archivo_url} target="_blank" rel="noopener noreferrer">
                  Descargar
                </a>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
