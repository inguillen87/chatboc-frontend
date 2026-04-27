import React from 'react';

export default function ChatEmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm" role="status" aria-live="polite">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}
