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
import MiniChatWidgetPreview from '@/components/ui/MiniChatWidgetPreview';

const DetailsPanel: React.FC = () => {
  const { selectedTicket: ticket } = useTickets();

  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
  };

  if (!ticket) {
    return (
       <aside className="w-96 border-l border-border flex-col h-screen bg-muted/20 shrink-0 hidden lg:flex items-center justify-center p-6">
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
        className="w-96 border-l border-border flex flex-col h-screen bg-muted/20 shrink-0"
    >
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* User Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalles del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={ticket.avatarUrl} alt={ticket.name} />
                  <AvatarFallback>{getInitials(ticket.name || "")}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{ticket.name || "Usuario Desconocido"}</h3>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                </div>
              </div>
              <div className="space-y-2">
                {ticket.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${ticket.email}`} className="text-sm hover:underline">
                      {ticket.email}
                    </a>
                  </div>
                )}
                {ticket.telefono && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`https://wa.me/${ticket.telefono}`} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                      {ticket.telefono}
                    </a>
                  </div>
                )}
                {ticket.direccion && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.direccion)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline"
                    >
                      {ticket.direccion}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {hasLocation && <TicketMap ticket={ticket} />}

          {/* Mini Chat Widget Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Vista Previa del Widget</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniChatWidgetPreview />
            </CardContent>
          </Card>

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
