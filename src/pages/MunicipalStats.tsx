import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StatItem {
  label: string;
  value: number;
}

interface StatsResponse {
  stats: StatItem[];
}

export default function MunicipalStats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rubros, setRubros] = useState<string[]>([]);
  const [barrios, setBarrios] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [rangos, setRangos] = useState<string[]>([]);
  const [filtroRubro, setFiltroRubro] = useState('');
  const [filtroBarrio, setFiltroBarrio] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroRango, setFiltroRango] = useState('');

  useEffect(() => {
    apiFetch<{
      rubros: string[];
      barrios: string[];
      tipos: string[];
      rangos: string[];
    }>('/municipal/stats/filters')
      .then((resp) => {
        setRubros(resp.rubros || []);
        setBarrios(resp.barrios || []);
        setTipos(resp.tipos || []);
        setRangos(resp.rangos || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filtroRubro) params.append('rubro', filtroRubro);
    if (filtroBarrio) params.append('barrio', filtroBarrio);
    if (filtroTipo) params.append('tipo', filtroTipo);
    if (filtroRango) params.append('rango', filtroRango);
    setLoading(true);
    apiFetch<StatsResponse>(`/municipal/stats?${params.toString()}`)
      .then((resp) => {
        setData(resp);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || 'Error');
        setLoading(false);
      });
  }, [filtroRubro, filtroBarrio, filtroTipo, filtroRango]);

  if (loading) return <p>Cargando...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Estadísticas</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {rubros.length > 0 && (
          <Select value={filtroRubro} onValueChange={setFiltroRubro}>
            <SelectTrigger>
              <SelectValue placeholder="Rubro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {rubros.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {barrios.length > 0 && (
          <Select value={filtroBarrio} onValueChange={setFiltroBarrio}>
            <SelectTrigger>
              <SelectValue placeholder="Barrio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {barrios.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {tipos.length > 0 && (
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {rangos.length > 0 && (
          <Select value={filtroRango} onValueChange={setFiltroRango}>
            <SelectTrigger>
              <SelectValue placeholder="Tiempo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {rangos.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <ul className="grid gap-3">
        {data?.stats.map((item) => (
          <li key={item.label} className="flex justify-between border-b pb-1">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
