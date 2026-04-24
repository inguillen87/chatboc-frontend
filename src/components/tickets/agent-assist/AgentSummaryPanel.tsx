import React from 'react';
import { AlignLeft, ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AgentSummaryPanelProps {
  summary: string | null;
  nextSteps: string[];
  isLoading: boolean;
}

export const AgentSummaryPanel: React.FC<AgentSummaryPanelProps> = ({ summary, nextSteps, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-muted/20 border-b">
        <Skeleton className="h-4 w-1/3 mb-2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    );
  }

  if (!summary && (!nextSteps || nextSteps.length === 0)) return null;

  return (
    <div className="flex flex-col gap-4 p-4 bg-card border-b text-sm">
      {summary && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <AlignLeft className="w-4 h-4 text-muted-foreground" />
            <h3>Resumen del caso</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">{summary}</p>
        </div>
      )}

      {nextSteps && nextSteps.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <ListChecks className="w-4 h-4 text-muted-foreground" />
            <h3>Próximos pasos sugeridos</h3>
          </div>
          <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
             {nextSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
             ))}
          </ul>
        </div>
      )}
    </div>
  );
};
