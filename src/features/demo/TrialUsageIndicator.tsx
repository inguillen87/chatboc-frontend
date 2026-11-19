import React from 'react';

import { formatDemoTrialUsage, type DemoTrialUsage } from './trialUsage';

export default function TrialUsageIndicator({ usage }: { usage: DemoTrialUsage | null }) {
  if (!usage) return null;

  const isLastConsultation = usage.remaining === 1;
  return (
    <p
      className={`mt-1 w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        isLastConsultation
          ? 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200'
          : 'border-border/70 bg-muted/50 text-muted-foreground'
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      {formatDemoTrialUsage(usage)}
    </p>
  );
}
