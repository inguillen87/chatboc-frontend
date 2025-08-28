import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getTicketByNumber, getTicketMessages } from '@/services/ticketService';
import { Ticket, Message } from '@/types/tickets';
import { formatDate } from '@/utils/fecha';
import TicketTimeline from '@/components/tickets/TicketTimeline';
import { Separator } from '@/components/ui/separator';
import { getErrorMessage, ApiError } from '@/utils/api';

export default function TicketLookup() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ticketNumber, setTicketNumber] = useState(ticketId || '');
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const performSearch = useCallback(async (searchId: string, searchPin: string) => {
    if (!searchId) return;
    setLoading(true);
    setError(null);
    setMessages([]);
    try {
      const data = await getTicketByNumber(searchId, searchPin);
      setTicket(data);
      try {
        const msgs = await getTicketMessages(data.id, data.tipo);
        setMessages(msgs);
      } catch (msgErr) {
        console.error('Error fetching messages for ticket', msgErr);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      let message: string;
      if (apiErr?.status === 404) {
        message = 'No se encontró el ticket';
      } else if (apiErr?.status === 400) {
        message = 'El PIN es obligatorio para consultar el ticket';
      } else {
        message = getErrorMessage(err, 'No se encontró el ticket');
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const paramPin = searchParams.get('pin') || '';
    setTicketNumber(ticketId || '');
    setPin(paramPin);
    if (ticketId) {
      performSearch(ticketId, paramPin);
    }
  }, [ticketId, searchParams, performSearch]);

  useEffect(() => {
    if (!ticket) return;
    const interval = setInterval(() => {
      performSearch(ticket.nro_ticket, pin);
    }, 30000);
    return () => clearInterval(interval);
  }, [ticket, pin, performSearch]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = ticketNumber.trim();
    const trimmedPin = pin.trim();
    if (!trimmed || !trimmedPin) return;
    const currentPin = searchParams.get('pin') || '';
    if (trimmed === (ticketId || '') && trimmedPin === currentPin) {
      performSearch(trimmed, trimmedPin);
    } else {
      navigate(`/ticket/${encodeURIComponent(trimmed)}?pin=${encodeURIComponent(trimmedPin)}`);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Consulta de Estado de Reclamo</h1>
        <p className="text-muted-foreground">Ingresá tu número de ticket y PIN para ver el progreso.</p>
      </div>
      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Ej: M-816293"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          className="text-lg flex-1"
        />
        <Input
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="text-lg flex-1 sm:max-w-[8rem]"
        />
        <Button
          type="submit"
          disabled={loading || !ticketNumber.trim() || !pin.trim()}
          size="lg"
          className="w-full sm:w-auto"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </form>
      {error && <p className="text-destructive text-sm text-center">{error}</p>}
      {ticket && (
        <div className="border rounded-xl p-4 sm:p-6 space-y-6 bg-card shadow-lg">
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
            {(ticket.telefono || ticket.email || ticket.dni || ticket.informacion_personal_vecino) && (
              <div className="mt-4 text-sm space-y-1">
                {(ticket.informacion_personal_vecino?.nombre || ticket.display_name) && (
                  <p>Nombre: {ticket.informacion_personal_vecino?.nombre || ticket.display_name}</p>
                )}
                {(ticket.informacion_personal_vecino?.dni || ticket.dni) && (
                  <p>DNI: {ticket.informacion_personal_vecino?.dni || ticket.dni}</p>
                )}
                {(ticket.informacion_personal_vecino?.email || ticket.email) && (
                  <p>Email: {ticket.informacion_personal_vecino?.email || ticket.email}</p>
                )}
                {(ticket.informacion_personal_vecino?.telefono || ticket.telefono) && (
                  <p>Teléfono: {ticket.informacion_personal_vecino?.telefono || ticket.telefono}</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="text-xl font-semibold mb-4">Historial del Reclamo</h3>
            <TicketTimeline history={ticket.history || []} messages={messages} />
          </div>

        </div>
      )}
    </div>
  );
}
