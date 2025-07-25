import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, MapPin, Ticket as TicketIcon, FolderOpen, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import TicketMap from '../TicketMap';
import { useTickets } from '@/context/TicketContext';

const DetailsPanel: React.FC = () => {
  const { selectedTicket: ticket } = useTickets();

  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
  };

  if (!ticket) {
    return (
       <aside className="w-80 border-l border-border flex-col h-screen bg-muted/20 shrink-0 hidden lg:flex items-center justify-center p-6">
         <div className="text-center text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4" />
            <h3 className="font-semibold">Detalles del Ticket</h3>
            <p className="text-sm">Selecciona un ticket para ver los detalles del cliente y del caso.</p>
         </div>
       </aside>
    );
  }

  const hasLocation = ticket.direccion || ticket.latitud || ticket.longitud;

  return (
    <motion.aside
        key={ticket.id}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-80 border-l border-border flex flex-col h-screen bg-muted/20 shrink-0"
    >
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* User Details */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 p-4">
               <Avatar className="h-16 w-16">
                <AvatarImage src={ticket.avatarUrl} alt={ticket.name} />
                <AvatarFallback>{getInitials(ticket.name || '')}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{ticket.name || 'Usuario Desconocido'}</h2>
                <p className="text-sm text-muted-foreground">Cliente</p>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {ticket.email && (
                <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{ticket.email}</span>
                </div>
              )}
              {ticket.telefono && (
                <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{ticket.telefono}</span>
                </div>
              )}
              {ticket.direccion && (
               <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{ticket.direccion}</span>
              </div>
              )}
            </CardContent>
          </Card>

          {hasLocation && <TicketMap ticket={ticket} />}

          {/* Ticket Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TicketIcon className="h-5 w-5" /> Info del Ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ID:</span>
                    <span>{ticket.nro_ticket}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Categoría:</span>
                    <span className="capitalize">{ticket.categoria || 'N/A'}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Creado:</span>
                    <span>{new Date(ticket.fecha).toLocaleString()}</span>
                </div>
            </CardContent>
          </Card>

          {/* ... (resto del componente sin cambios) ... */}
        </div>
      </ScrollArea>
    </motion.aside>
  );
};

export default DetailsPanel;
