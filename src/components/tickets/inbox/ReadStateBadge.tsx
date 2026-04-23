import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ReadStateBadgeProps {
  status: 'sent' | 'delivered' | 'read';
  readBy?: string[];
  readAt?: string;
}

export const ReadStateBadge: React.FC<ReadStateBadgeProps> = ({ status, readBy, readAt }) => {
  const Icon = status === 'read' || status === 'delivered' ? CheckCheck : Check;

  const iconClass = `w-3.5 h-3.5 ${status === 'read' ? 'text-blue-500' : 'text-muted-foreground'}`;

  const tooltipText = status === 'read'
    ? `Leído por ${readBy?.join(', ')}${readAt ? ` a las ${new Date(readAt).toLocaleTimeString()}` : ''}`
    : status === 'delivered'
      ? 'Entregado'
      : 'Enviado';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
           <span className="inline-flex items-center justify-center shrink-0">
              <Icon className={iconClass} />
           </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
