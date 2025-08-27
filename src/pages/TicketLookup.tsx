import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/api';
import { formatDate } from '@/utils/fecha';
import TicketTimeline from '@/components/tickets/TicketTimeline'; // Importar el nuevo componente
import { Separator } from '@/components/ui/separator';

// Definir la interfaz para un evento en la línea de tiempo
interface TimelineEvent {
  status: string;
  date: string;
  notes?: string;
}

// Actualizar la interfaz del Ticket para incluir el historial
interface Ticket {
  id: number;
  nro_ticket: number | string;
  asunto?: string;
  detalles?: string;
  estado: string;
  fecha: string;
  nombre_usuario?: string;
  direccion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  history?: TimelineEvent[]; // Añadir historial
}

export default function TicketLookup() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [ticketNumber, setTicketNumber] = useState(ticketId || '');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const performSearch = useCallback(async (searchId: string) => {
    if (!searchId) return;
    setLoading(true);
    setError(null);
    setTicket(null);
    try {
      // Simulación de una respuesta de API con historial
      // En un caso real, la API /tickets/municipio/por_numero/.. debería devolver esto.
      const mockTicketData: Ticket = {
        id: 12345,
        nro_ticket: searchId,
        asunto: 'Rama de árbol peligrosa',
        detalles: 'Una rama muy grande está sobre mi techo y parece que va a caer.',
        estado: 'En Proceso',
        fecha: '2024-08-15T10:30:00Z',
        direccion: 'Don Bosco 55, Junín',
        history: [
          { status: 'Recibido', date: '2024-08-15T10:30:00Z', notes: 'Reclamo generado a través del chatbot.' },
          { status: 'Asignado', date: '2024-08-15T11:00:00Z', notes: 'Asignado al equipo de Espacios Verdes.' },
          { status: 'En Proceso', date: '2024-08-16T09:00:00Z', notes: 'El equipo de Espacios Verdes ha programado la visita.' },
        ],
      };

      // const data = await apiFetch<Ticket>(
      //   `/tickets/municipio/por_numero/${encodeURIComponent(searchId)}`,
      //   { sendEntityToken: true }
      // );

      // Usar datos mockeados por ahora
      setTimeout(() => {
        setTicket(mockTicketData);
        setLoading(false);
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'No se encontró el ticket');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ticketId) {
      performSearch(ticketId);
    }
  }, [ticketId, performSearch]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(ticketNumber.trim());
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Consulta de Estado de Reclamo</h1>
        <p className="text-muted-foreground">Ingresá tu número de ticket para ver el progreso.</p>
      </div>
      <form onSubmit={handleFormSubmit} className="flex gap-2">
        <Input
          placeholder="Ej: M-816293"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          className="text-lg"
        />
        <Button type="submit" disabled={loading || !ticketNumber.trim()} size="lg">
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </form>
      {error && <p className="text-destructive text-sm text-center">{error}</p>}
      {ticket && (
        <div className="border rounded-xl p-6 space-y-6 bg-card shadow-lg">
          <div>
            <p className="text-sm text-muted-foreground">Ticket #{ticket.nro_ticket}</p>
            <h2 className="text-2xl font-semibold">{ticket.asunto}</h2>
            <p className="pt-1"><span className="font-medium">Estado actual:</span> <span className="text-primary font-semibold">{ticket.estado}</span></p>
            <p className="text-sm text-muted-foreground">
              Creado el: {formatDate(ticket.fecha, Intl.DateTimeFormat().resolvedOptions().timeZone, 'es-AR')}
            </p>
            {ticket.direccion && (
              <p className="text-sm text-muted-foreground mt-1">Dirección: {ticket.direccion}</p>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="text-xl font-semibold mb-4">Historial del Reclamo</h3>
            <TicketTimeline history={ticket.history || []} />
          </div>

        </div>
      )}
    </div>
  );
}
