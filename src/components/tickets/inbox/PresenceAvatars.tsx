import React from 'react';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface PresenceUser {
  id: string;
  name: string;
  type: 'user' | 'agent';
  status: 'online' | 'offline' | 'idle';
  avatarUrl?: string;
  avatarSource?: string;
  avatarConsent?: boolean | string | number | null;
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
                <IdentityAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  source={user.avatarSource || (user.type === 'agent' ? 'agent_profile' : 'contact_profile')}
                  consented={user.avatarConsent}
                  size="sm"
                  className={`border-2 border-background shadow-sm ${user.type === 'agent' ? 'ring-1 ring-primary' : ''}`}
                />
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
