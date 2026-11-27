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
  if (onlineUsers.length === 0) return null;
  const onlineCount = onlineUsers.filter(user => user.status === 'online').length;
  const idleCount = onlineUsers.length - onlineCount;
  const statusSummary = [
    onlineCount ? `${onlineCount} en línea` : null,
    idleCount ? `${idleCount} en pausa` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        <TooltipProvider delayDuration={300}>
          {onlineUsers.map((user) => (
            <Tooltip key={user.id}>
              <TooltipTrigger asChild>
                <div role="status" aria-label={`${user.name}. ${user.status === 'online' ? 'En línea' : 'En pausa'}`} className="relative">
                  <IdentityAvatar
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                    source={user.avatarSource || (user.type === 'agent' ? 'agent_profile' : 'contact_profile')}
                    consented={user.avatarConsent}
                    size="sm"
                    className={`border-2 border-background shadow-sm ${user.type === 'agent' ? 'ring-1 ring-primary' : ''}`}
                  />
                  <span aria-hidden="true" className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background ${
                    user.status === 'online' ? 'bg-sky-500' : 'bg-amber-400'
                  }`} />
                  <span className="sr-only">{user.status === 'online' ? 'En línea' : 'En pausa'}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {user.name}{user.type === 'agent' ? ' (Responsable)' : ''} · {user.status === 'online' ? 'En línea' : 'En pausa'}
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
      <span className="text-[10px] text-muted-foreground">{statusSummary}</span>
    </div>
  );
};
