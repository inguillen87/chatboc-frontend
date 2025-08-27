import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getTicketByNumber } from '@/services/ticketService';
import { Ticket } from '@/types/tickets';
import { formatDate } from '@/utils/fecha';
import TicketTimeline from '@/components/tickets/TicketTimeline';
import { Separator } from '@/components/ui/separator';
import { getErrorMessage, ApiError } from '@/utils/api';

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
    try {
      const data = await getTicketByNumber(searchId);
      setTicket(data);
    } catch (err) {
      const apiErr = err as ApiError;
      const message = apiErr?.status === 404
        ? 'No se encontró el ticket'
        : getErrorMessage(err, 'No se encontró el ticket');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ticketId) {
      performSearch(ticketId);
    }
  }, [ticketId, performSearch]);

  useEffect(() => {
    if (!ticket) return;
    const interval = setInterval(() => {
      performSearch(ticket.nro_ticket);
    }, 30000);
    return () => clearInterval(interval);
  }, [ticket, performSearch]);

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
            <TicketTimeline history={ticket.history || []} />
          </div>

        </div>
      )}
    </div>
  );
}
