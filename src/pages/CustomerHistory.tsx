import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { formatDate } from "@/utils/fecha";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import TicketMap from "@/components/TicketMap";
import {
  Inbox,
  MessageSquare,
  Ticket,
  Paperclip,
  User,
  CheckCircle,
  Tag,
  FileDown,
} from "lucide-react";

interface HistorialItem {
  id: number;
  fecha: string;
  tipo: string;
  descripcion?: string | null;
  archivo_url?: string | null;
  [key: string]: any;
}

export default function CustomerHistory() {
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<'Todos' | 'Consulta' | 'Archivo' | 'Ticket'>('Todos');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<HistorialItem | null>(null);
  const PAGE_SIZE = 20;

  const metrics = useMemo(() => {
    const consultas = items.filter((i) => i.tipo === 'Consulta').length;
    const tickets = items.filter((i) => i.tipo === 'Ticket').length;
    const archivos = items.filter((i) => i.tipo === 'Archivo').length;

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const inCurrentMonth = (d: string) => new Date(d) >= firstOfMonth;

    const abiertos = items.filter(
      (i) =>
        i.tipo === 'Ticket' &&
        i.estado &&
        ['abierto', 'pendiente'].includes(String(i.estado).toLowerCase()) &&
        inCurrentMonth(i.fecha)
    ).length;
    const cerrados = items.filter(
      (i) =>
        i.tipo === 'Ticket' &&
        i.estado &&
        ['cerrado', 'resuelto'].includes(String(i.estado).toLowerCase()) &&
        inCurrentMonth(i.fecha)
    ).length;

    const consultasRespondidas = items.filter(
      (i) => i.tipo === 'Consulta' && i.respuesta
    ).length;

    const reclamosPendientes = items.filter(
      (i) => i.tipo === 'Ticket' && i.tipo_ticket === 'reclamo' && i.estado && !['cerrado', 'resuelto'].includes(String(i.estado).toLowerCase())
    ).length;
    const reclamosResueltos = items.filter(
      (i) => i.tipo === 'Ticket' && i.tipo_ticket === 'reclamo' && i.estado && ['cerrado', 'resuelto'].includes(String(i.estado).toLowerCase())
    ).length;

    const rubros: Record<string, number> = {};
    items.forEach((i) => {
      const r = i.rubro || i.tema;
      if (r) rubros[r] = (rubros[r] || 0) + 1;
    });
    const ranking = Object.entries(rubros)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      consultas,
      tickets,
      archivos,
      abiertos,
      cerrados,
      consultasRespondidas,
      reclamosPendientes,
      reclamosResueltos,
      ranking,
    };
  }, [items]);

  const renderFilePreview = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase();
    if (!ext) return null;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return (
        <img
          src={url}
          alt="previsualización"
          className="max-h-60 mx-auto rounded"
        />
      );
    }
    if (ext === 'pdf') {
      return (
        <iframe
          src={url}
          className="w-full h-60 border rounded"
          title="PDF"
        />
      );
    }
    if (['mp3', 'wav', 'ogg'].includes(ext)) {
      return <audio controls src={url} className="w-full" />;
    }
    return null;
  };

  useEffect(() => {
    apiFetch('/historial')
      .then((data) => {
        // Unificar los tres arrays en uno solo
        const consultas = (data.consultas || []).map((c: any) => ({
          ...c,
          tipo: 'Consulta',
        }));
        const archivos = (data.archivos || []).map((a: any) => ({
          ...a,
          tipo: 'Archivo',
        }));
        const tickets = (data.tickets || []).map((t: any) => ({
          ...t,
          tipo: 'Ticket',
        }));

        // Unir y ordenar por fecha descendente
        const todos = [...consultas, ...archivos, ...tickets].sort((a, b) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );
        setItems(todos);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(getErrorMessage(err, 'Error'));
        setLoading(false);
      });
  }, []);
  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filter !== 'Todos' && it.tipo !== filter) return false;
      if (search && !JSON.stringify(it).toLowerCase().includes(search.toLowerCase())) return false;
      if (date && !it.fecha.startsWith(date)) return false;
      if (status && String(it.estado || '').toLowerCase() !== status.toLowerCase()) return false;
      if (tag) {
        const tags = Array.isArray(it.tags) ? it.tags.join(' ').toLowerCase() : String(it.rubro || it.tema || '').toLowerCase();
        if (!tags.includes(tag.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, filter, search, date, status, tag]);

  const displayed = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page],
  );

  const grouped = useMemo(() => {
    const byDate: Record<string, HistorialItem[]> = {};
    displayed.forEach((it) => {
      const d = new Date(it.fecha);
      const key = d.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(it);
    });
    return Object.entries(byDate);
  }, [displayed]);

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Historial completo</h1>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        <Card className="p-3 text-center">
          <CardHeader className="p-0 mb-1">
            <CardDescription>Consultas</CardDescription>
          </CardHeader>
          <CardContent className="p-0 text-xl font-semibold">
            {metrics.consultas}
          </CardContent>
        </Card>
        <Card className="p-3 text-center">
          <CardHeader className="p-0 mb-1">
            <CardDescription>Tickets</CardDescription>
          </CardHeader>
          <CardContent className="p-0 text-xl font-semibold">
            {metrics.tickets}
          </CardContent>
        </Card>
        <Card className="p-3 text-center">
          <CardHeader className="p-0 mb-1">
            <CardDescription>Archivos</CardDescription>
          </CardHeader>
          <CardContent className="p-0 text-xl font-semibold">
            {metrics.archivos}
          </CardContent>
        </Card>
        <Card className="p-3 text-center hidden md:block">
          <CardHeader className="p-0 mb-1">
            <CardDescription>Tickets abiertos</CardDescription>
          </CardHeader>
          <CardContent className="p-0 text-xl font-semibold">
            {metrics.abiertos}
          </CardContent>
        </Card>
        <Card className="p-3 text-center hidden md:block">
          <CardHeader className="p-0 mb-1">
            <CardDescription>Tickets cerrados</CardDescription>
          </CardHeader>
          <CardContent className="p-0 text-xl font-semibold">
            {metrics.cerrados}
          </CardContent>
        </Card>
      </div>
      {metrics.ranking.length > 0 && (
        <div className="mt-2">
          <h3 className="font-semibold text-sm mb-1">Temas más consultados</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
            {metrics.ranking.map(([r, count]) => (
              <li key={r}>{r}: {count}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="Todos">Todos</TabsTrigger>
            <TabsTrigger value="Consulta">Consultas</TabsTrigger>
            <TabsTrigger value="Ticket">Tickets</TabsTrigger>
            <TabsTrigger value="Archivo">Archivos</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Buscar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:ml-auto"
        />
        <Input
          placeholder="Tag o rubro"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
        <Input
          placeholder="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {displayed.length === 0 ? (
        <div className="text-center text-muted-foreground py-20 space-y-2">
          <Inbox className="w-12 h-12 mx-auto" />
          <p>No hay actividad</p>
        </div>
      ) : (
        <ScrollArea className="h-[60vh] pr-4">
          {grouped.map(([day, list]) => (
            <div key={day} className="mb-8">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                {day}
              </h3>
              <ul className="relative border-l pl-6">
                {list.map((item) => (
                  <li key={item.tipo + '-' + item.id} className="mb-6 ml-4">
                    <span className="absolute -left-3 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background border">
                      {item.tipo === 'Consulta' && <MessageSquare className="w-4 h-4" />}
                      {item.tipo === 'Ticket' && <Ticket className="w-4 h-4" />}
                      {item.tipo === 'Archivo' && <Paperclip className="w-4 h-4" />}
                    </span>
                    <Card
                      onClick={() => setSelected(item)}
                      className="p-4 cursor-pointer hover:bg-accent"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          {formatDate(item.fecha)}
                        </span>
                        {item.archivo_url && (
                          <Button asChild variant="outline" size="sm">
                            <a
                              href={item.archivo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Ver archivo
                            </a>
                          </Button>
                        )}
                      </div>
                      {item.descripcion && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.descripcion}
                        </p>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </ScrollArea>
      )}

      {displayed.length < filtered.length && (
        <Button
          variant="ghost"
          className="mx-auto block"
          onClick={() => setPage((p) => p + 1)}
        >
          Ver más
        </Button>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected?.tipo === 'Consulta' && <MessageSquare className="w-5 h-5" />}
              {selected?.tipo === 'Ticket' && <Ticket className="w-5 h-5" />}
              {selected?.tipo === 'Archivo' && <Paperclip className="w-5 h-5" />}
              <span>{selected?.tipo}</span>
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {formatDate(selected.fecha)}
              </p>
              {selected.descripcion && <p>{selected.descripcion}</p>}
              {selected.usuario && (
                <p className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4" /> {selected.usuario}
                </p>
              )}
              {selected.estado && (
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4" /> {selected.estado}
                </p>
              )}
              {selected.resultado && (
                <p className="text-sm">{selected.resultado}</p>
              )}
              {selected.tags && Array.isArray(selected.tags) && (
                <p className="flex items-center gap-2 text-sm flex-wrap">
                  <Tag className="w-4 h-4" />
                  {selected.tags.join(', ')}
                </p>
              )}
              {(() => {
                const archivos: string[] = Array.isArray(selected.archivos)
                  ? selected.archivos
                  : Array.isArray(selected.adjuntos)
                  ? selected.adjuntos.map((a: any) => a.url || a)
                  : selected.archivo_url
                  ? [selected.archivo_url]
                  : [];
                return (
                  archivos.length > 0 && (
                    <div className="space-y-2">
                      {archivos.map((u, i) => (
                        <div key={i}>
                          {renderFilePreview(u) || (
                            <a
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline text-sm"
                            >
                              Archivo {i + 1}
                            </a>
                          )}
                          <Button asChild variant="secondary" className="mt-1">
                            <a href={u} target="_blank" rel="noopener noreferrer">
                              <FileDown className="w-4 h-4 mr-1" /> Descargar
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )
                );
              })()}
              {selected.mensajes && Array.isArray(selected.mensajes) && (
                <div className="space-y-3 mt-4">
                  {selected.mensajes.map((m: any) => (
                    <div
                      key={m.id}
                      className={`flex gap-2 ${m.es_admin ? 'justify-start' : 'justify-end'}`}
                    >
                      {m.es_admin && <User className="w-4 h-4 mt-1" />}
                      <div
                        className={`rounded-lg p-2 max-w-xs text-sm ${m.es_admin ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}
                      >
                        <p>{m.texto || m.mensaje}</p>
                        <p className="text-xs mt-1 text-muted-foreground">
                          {formatDate(m.fecha)}
                        </p>
                      </div>
                      {!m.es_admin && <User className="w-4 h-4 mt-1" />}
                    </div>
                  ))}
                </div>
              )}
              {(selected.latitud || selected.longitud || selected.direccion) && (
                <TicketMap ticket={selected} />
              )}
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
