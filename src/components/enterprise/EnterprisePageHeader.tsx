import React from 'react';
import { Badge } from '@/components/ui/badge';

interface EnterprisePageHeaderProps {
  badge?: string;
  title: string;
  description?: string;
  meta?: string;
  actions?: React.ReactNode;
}

const EnterprisePageHeader: React.FC<EnterprisePageHeaderProps> = ({
  badge,
  title,
  description,
  meta,
  actions,
}) => {
  return (
    <header className="rounded-2xl border border-border/70 bg-card text-foreground p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          {badge ? <Badge variant="secondary" className="!bg-muted !text-foreground">{badge}</Badge> : null}
          <h1 className="text-2xl font-semibold tracking-tight !text-foreground sm:text-3xl">{title}</h1>
          {description ? <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{description}</p> : null}
          {meta ? <p className="text-xs font-medium text-muted-foreground">{meta}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
};

export default EnterprisePageHeader;
