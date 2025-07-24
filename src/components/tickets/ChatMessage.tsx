import React from 'react';
import { Message, User } from '@/types/tickets';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: Message;
  user: User;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, user }) => {
  const isAgent = message.author === 'agent';
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className={cn('flex items-start gap-3', isAgent && 'flex-row-reverse')}>
      <Avatar>
        <AvatarImage src={!isAgent ? user.avatarUrl : undefined} alt={!isAgent ? user.name : message.agentName} />
        <AvatarFallback>
            {isAgent ? getInitials(message.agentName || 'A') : getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className={cn('flex-1', isAgent && 'text-right')}>
        <div className={cn(
            'p-3 rounded-lg inline-block',
            isAgent ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}>
          <p className="text-sm">{message.content}</p>
        </div>
        <div className="text-xs text-muted-foreground mt-1 px-1">
          {isAgent ? message.agentName : user.name} - {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;