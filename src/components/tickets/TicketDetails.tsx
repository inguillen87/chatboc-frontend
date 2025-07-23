import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Phone, MapPin } from 'lucide-react';

import { Ticket } from '@/pages/TicketsPanel';

import { apiFetch } from '@/utils/api';
import { Ticket, TicketStatus, PriorityStatus } from '@/pages/TicketsPanel';

interface TicketDetailsProps {
  ticket: Ticket;
  onTicketUpdate: (updatedTicket: Ticket) => void;
}

export const TicketDetails: React.FC<TicketDetailsProps> = ({ ticket, onTicketUpdate }) => {
    const handleStatusChange = async (newStatus: TicketStatus) => {
        const updatedTicket = { ...ticket, estado: newStatus };
        onTicketUpdate(updatedTicket);
        try {
            await apiFetch(`/api/tickets/${ticket.id}/estado`, {
                method: 'PUT',
                body: { estado: newStatus },
                sendEntityToken: true,
            });
        } catch (error) {
            console.error("Error al actualizar estado:", error);
            onTicketUpdate(ticket); // Revertir
        }
    };

    const handlePriorityChange = async (newPriority: PriorityStatus) => {
        const updatedTicket = { ...ticket, priority: newPriority };
        onTicketUpdate(updatedTicket);
        try {
            await apiFetch(`/api/tickets/${ticket.id}/prioridad`, {
                method: 'PUT',
                body: { prioridad: newPriority },
                sendEntityToken: true,
            });
        } catch (error) {
            console.error("Error al actualizar prioridad:", error);
            onTicketUpdate(ticket); // Revertir
        }
    };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
           <div className="flex items-center space-x-4">
            <Avatar>
                <AvatarFallback>{ticket.nombre_usuario?.charAt(0)}</AvatarFallback>
            </Avatar>
            <p className="font-semibold">{ticket.nombre_usuario}</p>
           </div>
          <div className="flex items-center text-sm text-muted-foreground"><Mail className="h-4 w-4 mr-2" />{ticket.email_usuario}</div>
          <div className="flex items-center text-sm text-muted-foreground"><Phone className="h-4 w-4 mr-2" />{ticket.telefono}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <label className="text-sm font-medium">Estado</label>
                <Select value={ticket.estado} onValueChange={handleStatusChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="nuevo">Nuevo</SelectItem>
                        <SelectItem value="en_proceso">En Proceso</SelectItem>
                        <SelectItem value="resuelto">Resuelto</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div>
                <label className="text-sm font-medium">Prioridad</label>
                <Select value={ticket.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="low">Baja</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
          <CardTitle>Ubicación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 bg-muted rounded-md flex items-center justify-center">
            <p className="text-muted-foreground">Mapa no disponible</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
