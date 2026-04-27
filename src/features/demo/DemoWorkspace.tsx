import React from 'react';
import DemoChatPreview from './DemoChatPreview';

export default function DemoWorkspace({ tenantSlug }: { tenantSlug?: string | null }) {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">Demo Workspace {tenantSlug ? `· ${tenantSlug}` : ''}</h2>
      <DemoChatPreview />
      <div className="grid gap-2 md:grid-cols-5 text-xs text-muted-foreground">
        <div className="rounded border p-2">Tickets</div>
        <div className="rounded border p-2">Encuestas</div>
        <div className="rounded border p-2">WhatsApp</div>
        <div className="rounded border p-2">Analytics</div>
        <div className="rounded border p-2">CRM/Contactos</div>
      </div>
    </div>
  );
}
