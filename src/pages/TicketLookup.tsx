import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getTicketByNumber, getTicketTimeline, sendTicketHistory } from '@/services/ticketService';
import { Ticket, Message, TicketHistoryEvent } from '@/types/tickets';
import { fmtAR } from '@/utils/date';
import TicketTimeline from '@/components/tickets/TicketTimeline';
import TicketMap from '@/components/TicketMap';
import { Separator } from '@/components/ui/separator';
import { getErrorMessage, ApiError } from '@/utils/api';
import { getContactPhone, getCitizenDni } from '@/utils/ticket';
import { getSpecializedContact, SpecializedContact } from '@/utils/contacts';
import TicketStatusBar from '@/components/tickets/TicketStatusBar';
export default function TicketLookup() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ticketNumber, setTicketNumber] = useState(ticketId || '');
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timelineHistory, setTimelineHistory] = useState<TicketHistoryEvent[]>([]);
  const [timelineMessages, setTimelineMessages] = useState<Message[]>([]);
  const [estadoChat, setEstadoChat] = useState('');
  const [specialContact, setSpecialContact] = useState<SpecializedContact | null>(null);
  const [completionSent, setCompletionSent] = useState(false);
  const statusFlow = React.useMemo(
    () => timelineHistory.map((h) => h.status).filter(Boolean),
    [timelineHistory],
  );
  const currentStatus = React.useMemo(
    () => estadoChat || ticket?.estado || statusFlow[statusFlow.length - 1] || '',
    [estadoChat, ticket?.estado, statusFlow],
  );
  const estimatedArrival =
    ticket?.tiempo_estimado ||
    (currentStatus.toLowerCase().replace(/\s+/g, '_') === 'en_proceso' ? '4h' : null);

  const performSearch = useCallback(async (searchId?: string, searchPin?: string) => {
    const id = (searchId || '').trim();
    const pinVal = (searchPin || '').trim();
    if (!id) return;
    if (!pinVal) {
      setError('El PIN es obligatorio para consultar el ticket');
      setTicket(null);
      return;
    }
    setLoading(true);
    setError(null);
    setTimelineHistory([]);
    setTimelineMessages([]);
    setEstadoChat('');
    setCompletionSent(false);
    try {
      const data = await getTicketByNumber(id, pinVal);
      setTicket(data);
      getSpecializedContact(data.categoria).then(setSpecialContact);

      // Usar el historial y mensajes incluidos en el ticket si están presentes
      if (data.history || data.messages) {
        setTimelineHistory(data.history || []);
        setTimelineMessages(data.messages || []);
      }

      try {
        const timeline = await getTicketTimeline(data.id, data.tipo, { public: true });
        setTimelineHistory(timeline.history);
        setTimelineMessages(timeline.messages);
        setEstadoChat(timeline.estado_chat);
      } catch (msgErr) {
        console.error('Error fetching timeline for ticket', msgErr);
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

  useEffect(() => {
    const normalizeStatus = (s?: string | null) =>
      s ? s.toLowerCase().replace(/\s+/g, '_') : '';
    if (!ticket) return;
    if (
      (normalizeStatus(currentStatus) === 'completado' ||
        normalizeStatus(currentStatus) === 'resuelto') &&
      !completionSent
    ) {
      sendTicketHistory(ticket).catch((err) =>
        console.error('Error sending completion email:', err),
      );
      setCompletionSent(true);
    }
  }, [ticket, currentStatus, completionSent]);

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
          <div className="space-y-2 text-justify">
            <p className="text-sm text-muted-foreground">Ticket #{ticket.nro_ticket}</p>
            <h2 className="text-2xl font-semibold break-words">{ticket.asunto}</h2>
            <p className="pt-1"><span className="font-medium">Estado actual:</span> <span className="text-primary font-semibold">{currentStatus}</span></p>
            <TicketStatusBar status={currentStatus} flow={statusFlow} />
            <TicketMap ticket={ticket} />
            <dl className="text-sm text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
              <dt>Creado el:</dt>
              <dd>{fmtAR(ticket.fecha)}</dd>
              <dt>Canal:</dt>
              <dd className="capitalize">{ticket.channel || 'N/A'}</dd>
              {estimatedArrival && (
                <>
                  <dt>Tiempo estimado:</dt>
                  <dd>{estimatedArrival}</dd>
                </>
              )}
              {ticket.categoria && (
                <>
                  <dt>Categoría:</dt>
                  <dd>{ticket.categoria}</dd>
                </>
              )}
              {ticket.direccion && (
                <>
                  <dt>Dirección:</dt>
                  <dd>{ticket.direccion}</dd>
                </>
              )}
              {ticket.esquinas_cercanas && (
                <>
                  <dt>Esquinas:</dt>
                  <dd className="break-words">{ticket.esquinas_cercanas}</dd>
                </>
              )}
            </dl>
            {(ticket.description || ticket.detalles) && (
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words text-justify">
                {ticket.description || ticket.detalles}
              </p>
            )}
            {(getContactPhone(ticket) || ticket.email || ticket.dni || ticket.informacion_personal_vecino) && (
              <div className="mt-4 text-sm space-y-1 text-justify">
                {(ticket.informacion_personal_vecino?.nombre || ticket.display_name) && (
                  <p className="break-words">Nombre: {ticket.informacion_personal_vecino?.nombre || ticket.display_name}</p>
                )}
                {getCitizenDni(ticket) && (
                  <p className="break-words">DNI: {getCitizenDni(ticket)}</p>
                )}
                {(ticket.informacion_personal_vecino?.email || ticket.email) && (
                  <p className="break-words">Email: {ticket.informacion_personal_vecino?.email || ticket.email}</p>
                )}
                {getContactPhone(ticket) && (
                  <p className="break-words">Teléfono: {getContactPhone(ticket)}</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="text-xl font-semibold mb-4">Historial del Reclamo</h3>
            <TicketTimeline history={timelineHistory} messages={timelineMessages} ticket={ticket} />
          </div>

        </div>
      )}
    </div>
  );
}
