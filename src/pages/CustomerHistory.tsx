import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/utils/api";
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
import { Card } from "@/components/ui/card";
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
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<HistorialItem | null>(null);
  const PAGE_SIZE = 20;

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
        setError(err.message || 'Error');
        setLoading(false);
      });
  }, []);
  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filter !== 'Todos' && it.tipo !== filter) return false;
      if (search && !JSON.stringify(it).toLowerCase().includes(search.toLowerCase())) return false;
      if (date && !it.fecha.startsWith(date)) return false;
      return true;
    });
  }, [items, filter, search, date]);

  const displayed = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page],
  );

  if (loading) return <p className="p-4">Cargando...</p>;
  if (error) return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Historial completo</h1>
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
          <ul className="relative border-l pl-6">
            {displayed.map((item) => (
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
              {selected.archivo_url && renderFilePreview(selected.archivo_url)}
              {selected.archivo_url && (
                <Button asChild variant="secondary" className="mt-2">
                  <a
                    href={selected.archivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileDown className="w-4 h-4 mr-1" /> Descargar
                  </a>
                </Button>
              )}
              {selected.mensajes && Array.isArray(selected.mensajes) && (
                <div className="space-y-2 mt-4">
                  {selected.mensajes.map((m: any) => (
                    <div
                      key={m.id}
                      className="text-sm border rounded p-2"
                    >
                      <p>{m.texto || m.mensaje}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {m.es_admin ? (
                          <User className="w-3 h-3" />
                        ) : (
                          <MessageSquare className="w-3 h-3" />
                        )}
                        {m.usuario || m.nombre}
                        <span className="ml-auto">{formatDate(m.fecha)}</span>
                      </p>
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
