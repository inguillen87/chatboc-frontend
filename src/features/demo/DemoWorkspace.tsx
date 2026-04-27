import React from 'react';
import DemoChatPreview from './DemoChatPreview';

export default function DemoWorkspace({ tenantSlug }: { tenantSlug?: string | null }) {
  const valueCards = [
    { key: 'tickets', title: 'Tickets', desc: 'Mesa de ayuda, SLA y trazabilidad.' },
    { key: 'surveys', title: 'Encuestas', desc: 'Feedback post atención y NPS.' },
    { key: 'whatsapp', title: 'WhatsApp', desc: 'Handoff y seguimiento omnicanal.' },
    { key: 'analytics', title: 'Analytics', desc: 'KPIs de operación en tiempo real.' },
    { key: 'crm', title: 'CRM/Contactos', desc: 'Historial y contexto por cliente.' },
  ];

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card/30 p-4">
      <h2 className="text-lg font-semibold">Demo Workspace {tenantSlug ? `· ${tenantSlug}` : ''}</h2>
      <DemoChatPreview />
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border px-2 py-1 text-muted-foreground">Quick reply: Estado de ticket</span>
        <span className="rounded-full border px-2 py-1 text-muted-foreground">Quick reply: Encuesta CSAT</span>
        <span className="rounded-full border px-2 py-1 text-muted-foreground">Quick reply: Hablar por WhatsApp</span>
      </div>
      <div className="grid gap-2 md:grid-cols-5 text-xs">
        {valueCards.map((card) => (
          <div key={card.key} className="rounded border bg-background/70 p-2">
            <p className="font-medium text-foreground">{card.title}</p>
            <p className="text-muted-foreground">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
