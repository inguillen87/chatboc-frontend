import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/api';
import { formatDate } from '@/utils/fecha';

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
}

export default function TicketLookup() {
  const [ticketNumber, setTicketNumber] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketNumber.trim()) return;
    setLoading(true);
    setError(null);
    setTicket(null);
    try {
      const data = await apiFetch<Ticket>(
        `/tickets/municipio/por_numero/${encodeURIComponent(ticketNumber.trim())}`
      );
      setTicket(data);
    } catch (err: any) {
      setError(err.message || 'No se encontró el ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-center">Consultar Ticket</h1>
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Número de ticket"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </form>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {ticket && (
        <div className="border rounded-lg p-3 space-y-1 bg-card">
          <p className="font-semibold">
            Ticket #{ticket.nro_ticket} - {ticket.estado}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatDate(ticket.fecha, Intl.DateTimeFormat().resolvedOptions().timeZone, 'es-AR')}
          </p>
          {ticket.asunto && (
            <p className="text-sm text-foreground">{ticket.asunto}</p>
          )}
          {ticket.detalles && (
            <p className="text-sm whitespace-pre-line">{ticket.detalles}</p>
          )}
          {ticket.direccion && (
            <p className="text-sm text-muted-foreground">{ticket.direccion}</p>
          )}
        </div>
      )}
    </div>
  );
}
