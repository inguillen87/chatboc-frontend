import React, { useState } from 'react';
import { UserPlus, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';

interface Agent {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface AssignmentWidgetProps {
  currentAssignee?: Agent;
  availableAgents: Agent[];
  onAssign: (agentId: string | null) => void;
}

export const AssignmentWidget: React.FC<AssignmentWidgetProps> = ({ currentAssignee, availableAgents, onAssign }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 px-2.5">
          {currentAssignee ? (
             <>
               <IdentityAvatar name={currentAssignee.name} avatarUrl={currentAssignee.avatarUrl} source="agente" size="xs" />
               <span className="text-xs truncate max-w-[100px]">{currentAssignee.name}</span>
             </>
          ) : (
             <>
               <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
               <span className="text-xs text-muted-foreground">Sin asignar</span>
             </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="p-2 border-b">
          <p className="text-xs font-medium text-muted-foreground px-1 mb-1">Asignar a un agente</p>
          {currentAssignee && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
              onClick={() => {
                onAssign(null);
                setOpen(false);
              }}
            >
              <X className="w-3.5 h-3.5 mr-2" />
              Remover asignación
            </Button>
          )}
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
          {availableAgents.map((agent) => (
             <Button
               key={agent.id}
               variant="ghost"
               size="sm"
               className="w-full justify-start h-10 mb-1"
               onClick={() => {
                  onAssign(agent.id);
                  setOpen(false);
               }}
             >
               <IdentityAvatar name={agent.name} avatarUrl={agent.avatarUrl} source="agente" size="sm" className="mr-2" />
               <div className="flex flex-col items-start overflow-hidden">
                 <span className="text-xs font-medium truncate">{agent.name}</span>
                 <span className="text-[10px] text-muted-foreground truncate">{agent.email}</span>
               </div>
               {currentAssignee?.id === agent.id && (
                  <UserCheck className="w-3.5 h-3.5 ml-auto text-primary" />
               )}
             </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
