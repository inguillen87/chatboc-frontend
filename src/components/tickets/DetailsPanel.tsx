import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, MapPin, Ticket as TicketIcon, FolderOpen, Info, History } from 'lucide-react';
import { Ticket } from '@/types/tickets';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import TicketMap from './TicketMap';

interface DetailsPanelProps {
  ticket: Ticket | null;
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({ ticket }) => {

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
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

  const hasLocation = ticket.user.location || (ticket.user as any).latitud || (ticket.user as any).longitud;

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
            <CardHeader className="flex flex-row items-center gap-4 p-4">
               <Avatar className="h-16 w-16">
                <AvatarImage src={ticket.user.avatarUrl} alt={ticket.user.name} />
                <AvatarFallback>{getInitials(ticket.user.name)}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{ticket.user.name}</h2>
                <p className="text-sm text-muted-foreground">Cliente</p>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{ticket.user.email}</span>
              </div>
              {ticket.user.phone && (
                <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{ticket.user.phone}</span>
                </div>
              )}
              {ticket.user.location && (
               <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{ticket.user.location}</span>
              </div>
              )}
            </CardContent>
          </Card>

          {hasLocation && <TicketMap ticket={{ direccion: ticket.user.location, latitud: (ticket.user as any).latitud, longitud: (ticket.user as any).longitud }} />}

          {/* Ticket Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TicketIcon className="h-5 w-5" /> Info del Ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ID:</span>
                    <span>{ticket.id}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Prioridad:</span>
                    <Badge variant={ticket.priority === 'alta' || ticket.priority === 'urgente' ? 'destructive' : 'secondary'} className="capitalize">{ticket.priority}</Badge>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Agente:</span>
                    <span>{ticket.agentId || 'Sin asignar'}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Creado:</span>
                    <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Actualizado:</span>
                    <span>{new Date(ticket.updatedAt).toLocaleString()}</span>
                </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2"><FolderOpen className="h-5 w-5" /> Archivos Adjuntos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {ticket.attachments.map(file => (
                        <div key={file.id} className="flex items-center justify-between p-2 rounded-lg border">
                            <span className="text-sm font-medium truncate">{file.filename}</span>
                            <Button variant="ghost" size="sm">Descargar</Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
          )}

          {/* Activity History */}
          {ticket.activityLog && ticket.activityLog.length > 0 && (
            <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Historial de Actividad</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    {ticket.activityLog.map(activity => (
                        <div key={activity.timestamp} className="flex items-start gap-3">
                            <div className="flex-shrink-0 h-5 w-5 bg-muted-foreground/20 rounded-full flex items-center justify-center mt-1">
                                <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                            </div>
                            <div>
                                <p className="font-medium">{activity.content}</p>
                                <p className="text-xs text-muted-foreground">{new Date(activity.timestamp).toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </motion.aside>
  );
};

export default DetailsPanel;
