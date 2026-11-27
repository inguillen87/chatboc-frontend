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
  const statusLabel = status === 'read' ? 'Leído' : status === 'delivered' ? 'Entregado' : 'Enviado';

  const iconClass = `w-3.5 h-3.5 ${status === 'read' ? 'text-primary' : 'text-muted-foreground'}`;

  const tooltipText = status === 'read'
    ? `Leído por ${readBy?.join(', ')}${readAt ? ` a las ${new Date(readAt).toLocaleTimeString()}` : ''}`
    : status === 'delivered'
      ? 'Entregado'
      : 'Enviado';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
           <span role="status" aria-label={tooltipText} className="inline-flex shrink-0 items-center justify-center gap-1">
              <Icon aria-hidden="true" className={iconClass} />
              <span className="text-[10px] text-muted-foreground">{statusLabel}</span>
           </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
