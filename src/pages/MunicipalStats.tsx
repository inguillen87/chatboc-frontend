import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

interface StatItem {
  label: string;
  value: number;
}

interface StatsResponse {
  stats: StatItem[];
}

export default function MunicipalStats() {
  useRequireRole(['admin'] as Role[]);
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
      .catch((err: any) => {
        const message = err instanceof ApiError ? err.message : 'Error al cargar filtros.';
        setError(message);
      });
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filtroRubro) params.append('rubro', filtroRubro);
    if (filtroBarrio) params.append('barrio', filtroBarrio);
    if (filtroTipo) params.append('tipo', filtroTipo);
    if (filtroRango) params.append('rango', filtroRango);

    try {
      const resp = await apiFetch<StatsResponse>(`/municipal/stats?${params.toString()}`);
      setData(resp);
    } catch (err: any) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar estadísticas.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filtroRubro, filtroBarrio, filtroTipo, filtroRango]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) return <p className="p-4 text-center">Cargando estadísticas...</p>;
  if (error) return <p className="p-4 text-destructive text-center">Error: {error}</p>;
  if (!data || !Array.isArray(data.stats) || data.stats.length === 0)
    return <p className="p-4 text-center text-muted-foreground">No hay estadísticas disponibles con los filtros actuales.</p>;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold text-primary mb-4">Estadísticas Municipales</h1>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>Filtros</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
            <Button onClick={fetchStats} className="w-full">Aplicar Filtros</Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.stats.map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Visualización de Estadísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ChartContainer config={{
              value: {
                label: "Valor",
                color: "#4682B4",
              },
            }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.stats.map(s => ({ name: s.label, value: typeof s.value === 'number' && !isNaN(s.value) ? s.value : 0 }))}>
                  <XAxis dataKey="name" tickFormatter={(value) => value.slice(0, 15)} />
                  <YAxis />
                  <Tooltip
                    cursor={false}
                    content={<div className="bg-background p-2 shadow-lg rounded-lg">
                      <p className="text-sm text-muted-foreground">{'{payload?.[0]?.payload?.name}'}</p>
                      <p className="text-sm font-bold">{'{payload?.[0]?.value}'}</p>
                    </div>}
                  />
                  <Legend />
                  <Bar dataKey="value" fill="var(--color-value)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
