import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Ticket } from '@/types/tickets';
import TicketChat from '@/components/tickets/TicketChat';
import { TicketIcon, MessageSquare, Shield, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADOS, PRIORITY_INFO, TicketStatus, PriorityStatus } from '@/types/tickets';

interface TicketDetailPanelProps {
  ticket: Ticket | null;
  onTicketPropertyChange?: (property: 'estado' | 'priority', value: any) => void;
}

const TicketActions: React.FC<{ ticket: Ticket; onTicketPropertyChange?: TicketDetailPanelProps['onTicketPropertyChange'] }> = ({ ticket, onTicketPropertyChange }) => (
    <div className="p-3 border-b flex items-center justify-between gap-2">
        <Select
            value={ticket.estado}
            onValueChange={(value) => onTicketPropertyChange?.('estado', value as TicketStatus)}
        >
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Cambiar estado" />
            </SelectTrigger>
            <SelectContent>
                {Object.entries(ESTADOS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
        <Select
            value={ticket.priority || ''}
            onValueChange={(value) => onTicketPropertyChange?.('priority', value as PriorityStatus)}
        >
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Cambiar prioridad" />
            </SelectTrigger>
            <SelectContent>
                {Object.entries(PRIORITY_INFO).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
        <Button variant="outline">Derivar</Button>
    </div>
);


const TicketDetailPanel: React.FC<TicketDetailPanelProps> = ({ ticket, onTicketPropertyChange }) => {
  const chatInputRef = React.useRef<HTMLTextAreaElement>(null);

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <TicketIcon className="h-20 w-20 text-muted-foreground/40" />
        <h2 className="mt-4 text-lg font-semibold">Seleccione un Ticket</h2>
        <p className="text-sm text-muted-foreground">
          Elija un ticket de la lista para ver los detalles y chatear.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      key={ticket.id}
      className="h-full flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <TicketActions ticket={ticket} onTicketPropertyChange={onTicketPropertyChange} />
      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2">
          <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-2" />Chat</TabsTrigger>
          <TabsTrigger value="internal"><Shield className="h-4 w-4 mr-2" />Notas Internas</TabsTrigger>
          <TabsTrigger value="history"><Clock className="h-4 w-4 mr-2" />Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="flex-1">
          <TicketChat
            ticket={ticket}
            onTicketUpdate={() => {}} // Mock
            onClose={() => {}} // Mock
            chatInputRef={chatInputRef}
          />
        </TabsContent>
        <TabsContent value="internal" className="p-4">
            <h3 className="font-semibold mb-2">Notas Internas</h3>
            <p className="text-sm text-muted-foreground">Aquí podrás ver y añadir comentarios solo visibles para el equipo.</p>
            {/* Aquí iría el componente de comentarios internos */}
        </TabsContent>
        <TabsContent value="history" className="p-4">
            <h3 className="font-semibold mb-2">Historial de Cambios</h3>
            <p className="text-sm text-muted-foreground">Aquí se mostrará el timeline de actividades del ticket.</p>
            {/* Aquí iría el componente de historial */}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default TicketDetailPanel;
