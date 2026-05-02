import React from 'react';
import ChatPanel from '@/features/chat/ChatPanel';
import type { DemoSector, DemoWorkspaceConfig } from './demoTypes';

export default function DemoWorkspace({
  tenantSlug,
  sector,
  rubro,
  workspace,
}: {
  tenantSlug?: string | null;
  sector?: DemoSector | null;
  rubro?: string | null;
  workspace?: DemoWorkspaceConfig | null;
}) {
  const valueCards = workspace?.value_cards ?? [];
  const educationQuickMenu = Array.isArray(workspace?.education?.quick_menu)
    ? workspace.education.quick_menu
    : null;

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-card/30 p-4">
      <h2 className="text-lg font-semibold">{workspace?.title || 'Demo Workspace'} {tenantSlug ? `(${tenantSlug})` : ''}</h2>
      <ChatPanel
        variant="standalone"
        context={{
          tenantSlug: tenantSlug ?? null,
          sector: sector ?? null,
          rubro: rubro ?? null,
          tipoChat: sector === 'gobierno' ? 'municipio' : 'pyme',
          welcomeMessage: workspace?.welcome_message ?? null,
          quickReplies: workspace?.quick_replies ?? [],
          firstVisit: workspace?.first_visit ?? workspace?.experience_blueprint?.first_visit ?? null,
          sampleConversations:
            workspace?.sample_conversations ??
            workspace?.experience_blueprint?.sample_conversations ??
            [],
          trustSignals:
            workspace?.trust_signals ??
            workspace?.experience_blueprint?.trust_signals ??
            [],
          experienceBlueprint: workspace?.experience_blueprint ?? null,
          leadCapture: workspace?.lead_capture ?? workspace?.experience_blueprint?.lead_capture ?? null,
          mediaCapabilities: workspace?.media_capabilities ?? null,
          chatBootstrap: workspace?.chat_bootstrap ?? null,
          conversionCtas:
            workspace?.conversion_ctas ??
            workspace?.experience_blueprint?.conversion_ctas ??
            null,
          animationTokens: workspace?.animation_tokens ?? null,
          emptyStates:
            workspace?.empty_states ??
            workspace?.experience_blueprint?.empty_states ??
            undefined,
        }}
        quickMenu={educationQuickMenu}
        handoffState="none"
        handoffLabels={workspace?.handoff_labels ?? undefined}
        leadCapture={workspace?.lead_capture ?? workspace?.experience_blueprint?.lead_capture ?? null}
        mediaCapabilities={workspace?.media_capabilities ?? null}
        conversionCtas={workspace?.conversion_ctas ?? workspace?.experience_blueprint?.conversion_ctas ?? null}
        animationTokens={workspace?.animation_tokens ?? null}
        emptyStates={workspace?.empty_states ?? workspace?.experience_blueprint?.empty_states ?? undefined}
        experienceBlueprint={workspace?.experience_blueprint ?? null}
      />
      {valueCards.length ? (
        <div className="grid gap-2 text-xs md:grid-cols-3">
          {valueCards.map((card, index) => (
            <div key={card.key || `${card.title}-${index}`} className="rounded-lg border bg-background/70 p-3">
              <p className="font-medium text-foreground">{card.title}</p>
              {card.desc || card.description ? <p className="text-muted-foreground">{card.desc || card.description}</p> : null}
              {card.status ? <p className="mt-2 text-[11px] text-muted-foreground">{card.status}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
