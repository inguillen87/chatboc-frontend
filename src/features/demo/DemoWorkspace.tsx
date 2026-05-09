import React from 'react';
import { BarChart3, FileText, MessageSquareText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ChatPanel from '@/features/chat/ChatPanel';
import type { DemoSector, DemoWorkspaceConfig } from './demoTypes';

const readBlockTitle = (block: { title?: string | null; label?: string | null; text?: string | null }) =>
  block.title || block.label || block.text || null;

const readBlockDetail = (block: { detail?: string | null; description?: string | null; subtitle?: string | null }) =>
  block.detail || block.description || block.subtitle || null;

export default function DemoWorkspace({
  tenantSlug,
  sector,
  rubro,
  workspace,
  onPrefill,
}: {
  tenantSlug?: string | null;
  sector?: DemoSector | null;
  rubro?: string | null;
  workspace?: DemoWorkspaceConfig | null;
  onPrefill?: (text: string) => void;
}) {
  const valueCards = workspace?.value_cards ?? [];
  const resources = workspace?.catalog_resources ?? [];
  const conversionActions = workspace?.conversion_ctas?.actions ?? [];
  const sampleConversations =
    workspace?.sample_conversations ?? workspace?.experience_blueprint?.sample_conversations ?? [];
  const analyticsSummary = workspace?.analytics_summary ?? null;
  const analyticsEntries = analyticsSummary
    ? Object.entries(analyticsSummary).filter(([, value]) => value !== null && value !== undefined)
    : [];
  const educationQuickMenu = Array.isArray(workspace?.education?.quick_menu)
    ? workspace.education.quick_menu
    : null;

  const openResource = (href?: string | null) => {
    if (!href) return;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Demo workspace</p>
          <h2 className="text-xl font-semibold">
            {workspace?.title || rubro || 'Demo Workspace'} {tenantSlug ? <span className="text-sm text-muted-foreground">({tenantSlug})</span> : null}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {sector ? <span className="rounded-full bg-muted px-3 py-1">{sector}</span> : null}
          {workspace?.media_capabilities ? <span className="rounded-full bg-muted px-3 py-1">multimodal</span> : null}
          {workspace?.chat_bootstrap?.endpoint ? <span className="rounded-full bg-muted px-3 py-1">chat backend</span> : null}
        </div>
      </div>

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
          sampleConversations,
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
        supportChannels={workspace?.support_channels ?? null}
        realtimeVoice={workspace?.realtime_voice ?? workspace?.support_channels?.voice_call?.capabilities ?? null}
      />

      {valueCards.length ? (
        <div className="grid gap-2 text-xs md:grid-cols-3">
          {valueCards.map((card, index) => (
            <div key={card.key || `${card.title}-${index}`} className="rounded-xl border bg-background/70 p-3">
              <p className="font-medium text-foreground">{card.title}</p>
              {card.desc || card.description ? <p className="text-muted-foreground">{card.desc || card.description}</p> : null}
              {card.status ? <p className="mt-2 text-[11px] text-muted-foreground">{card.status}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {resources.length || conversionActions.length || sampleConversations.length || analyticsEntries.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {resources.length ? (
            <div className="rounded-xl border bg-background/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" />Recursos</div>
              <div className="flex flex-wrap gap-2">
                {resources.map((resource, index) => {
                  const label = resource.label || resource.title || resource.key || resource.id || `Recurso ${index + 1}`;
                  const href = resource.href || resource.url;
                  return (
                    <Button key={resource.id || resource.key || `${label}-${index}`} type="button" size="sm" variant="outline" onClick={() => openResource(href)} disabled={!href}>
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {conversionActions.length ? (
            <div className="rounded-xl border bg-background/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />Acciones</div>
              <div className="flex flex-wrap gap-2">
                {conversionActions.map((action, index) => (
                  <Button
                    key={action.id || `${action.label}-${index}`}
                    type="button"
                    size="sm"
                    variant={action.style === 'primary' ? 'default' : 'outline'}
                    onClick={() => onPrefill?.(action.intent || action.label)}
                    disabled={!action.intent && !action.payload && !action.endpoint}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {sampleConversations.length ? (
            <div className="rounded-xl border bg-background/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="h-4 w-4 text-primary" />Conversaciones</div>
              <div className="flex flex-wrap gap-2">
                {sampleConversations.slice(0, 4).map((sample, index) => {
                  const title = readBlockTitle(sample) || `Sample ${index + 1}`;
                  const detail = readBlockDetail(sample) || title;
                  return (
                    <Button key={sample.id || `${title}-${index}`} type="button" size="sm" variant="outline" onClick={() => onPrefill?.(detail)}>
                      {title}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {analyticsEntries.length ? (
            <div className="rounded-xl border bg-background/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-primary" />Estado demo</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {analyticsEntries.slice(0, 6).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-muted/60 p-2">
                    <span className="block text-[11px] text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                    <span className="font-semibold text-foreground">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
