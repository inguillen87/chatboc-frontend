import React from 'react';
import { PresenceAvatars } from './PresenceAvatars';
import { AssignmentWidget } from './AssignmentWidget';
import { TimelineMergeView } from './TimelineMergeView';
import { TypingIndicator } from './TypingIndicator';
import { TicketTimelineEvent } from '@/schemas/api';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AgentSuggestionBox } from '../agent-assist/AgentSuggestionBox';
import { AgentSummaryPanel } from '../agent-assist/AgentSummaryPanel';


interface TicketConversationPaneProps {
  ticketId?: string;
}

export const TicketConversationPane: React.FC<TicketConversationPaneProps> = ({ ticketId }) => {
  if (!ticketId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/10">
        <p>Selecciona un ticket para ver la conversación.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background w-full relative">
      {/* Header Placeholder */}
      <div className="h-14 border-b shrink-0 flex items-center px-4 justify-between bg-card/50">
        <div className="flex items-center gap-3">
           <h3 className="font-medium text-sm">Ticket #{ticketId}</h3>
           <PresenceAvatars users={[{id: 'u1', name: 'Admin', type: 'agent', status: 'online'}, {id: 'u2', name: 'Vecino', type: 'user', status: 'idle'}]} />
        </div>
        <div className="flex items-center gap-2">
           <AssignmentWidget availableAgents={[{id: 'a1', name: 'Juan Perez', email: 'jperez@ejemplo.com'}]} onAssign={() => {}} />
        </div>
      </div>

      {/* Timeline/Conversation Area */}

      {/* Agent Assist Summary */}
      <AgentSummaryPanel
         isLoading={false}
         summary="El ciudadano reportó una luminaria rota en San Martin 123 el jueves. Solicita saber cuándo pasará el equipo técnico."
         nextSteps={['Asignar a Cuadrilla Norte', 'Solicitar foto del poste']}
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
         <TimelineMergeView events={[{id: 'ev1', ticket_id: ticketId, type: 'status_changed', timestamp: new Date().toISOString(), actor: {id: 'sys', type: 'system', name: 'Sistema'}, payload: {new_status: 'en_proceso'}} as TicketTimelineEvent]} />
         <div className="text-center text-xs text-muted-foreground my-4">
            Inicio de la conversación
         </div>
      </div>

      {/* Composer Area */}
      <div className="p-3 border-t bg-background shrink-0 flex flex-col gap-2">
         {/* Placeholder for AgentSuggestionBox */}
         <AgentSuggestionBox
            suggestion="Hola. Hemos recibido tu reporte de la luminaria. Enviaremos a la cuadrilla de la Zona Norte en las próximas 48hs."
            onAccept={() => {}}
            onReject={() => {}}
         />

         {/* Placeholder for TypingIndicator */}
         <TypingIndicator usersTyping={[{id: 'u2', name: 'Vecino'}]} />

         <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Escribe una respuesta..."
              className="min-h-[80px] resize-none text-sm"
            />
            <div className="flex items-center justify-end gap-2">
               <Button variant="outline" size="sm" className="h-8">Guardar borrador</Button>
               <Button size="sm" className="h-8 gap-1.5">
                  Enviar mensaje <Send className="w-3.5 h-3.5" />
               </Button>
            </div>
         </div>
      </div>
    </div>
  );
};
