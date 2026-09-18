import { AlertTriangle, Clock3, FileSearch, RefreshCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface SurveyErrorStateProps {
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel?: string | null;
  onPrimary: () => void;
  onSecondaryHome?: boolean;
  busy?: boolean;
  reasonCode?: string | null;
  requestId?: string | null;
}

const pickIcon = (reasonCode?: string | null) => {
  if (reasonCode === 'survey_not_published') return Clock3;
  if (reasonCode === 'survey_outside_active_window') return AlertTriangle;
  if (reasonCode?.includes('not_found')) return FileSearch;
  return RefreshCcw;
};

export const SurveyErrorState = ({
  title,
  description,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondaryHome = true,
  busy = false,
  reasonCode,
  requestId,
}: SurveyErrorStateProps) => {
  const Icon = pickIcon(reasonCode);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-2xl items-center justify-center px-3">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-muted/40">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
            {requestId ? (
              <p className="text-[11px] text-muted-foreground/80">Codigo de soporte: {requestId}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={onPrimary} disabled={busy}>
              {primaryLabel}
            </Button>
            {secondaryLabel ? (
              onSecondaryHome ? (
                <Button asChild variant="outline">
                  <Link to="/">{secondaryLabel}</Link>
                </Button>
              ) : (
                <Button variant="outline" onClick={onPrimary}>
                  {secondaryLabel}
                </Button>
              )
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SurveyErrorState;
