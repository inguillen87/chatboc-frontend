import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface PresenceUser {
  id: string;
  name: string;
  type: 'user' | 'agent';
  status: 'online' | 'offline' | 'idle';
  avatarUrl?: string;
}

interface PresenceAvatarsProps {
  users: PresenceUser[];
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ users }) => {
  if (!users || users.length === 0) return null;

  const onlineUsers = users.filter(u => u.status === 'online' || u.status === 'idle');

  return (
    <div className="flex items-center -space-x-2">
      <TooltipProvider delayDuration={300}>
        {onlineUsers.map((user) => (
          <Tooltip key={user.id}>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar className={`h-7 w-7 border-2 border-background shadow-sm ${user.type === 'agent' ? 'ring-1 ring-primary' : ''}`}>
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                  <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                    {user.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-background ${
                  user.status === 'online' ? 'bg-green-500' : 'bg-amber-400'
                }`} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {user.name} {user.type === 'agent' && '(Agente)'}
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
};
