import React from 'react';
import { BarChart3, CheckCircle2, Smartphone } from 'lucide-react';
import ChatPanel from '@/features/chat/ChatPanel';
import type { DemoSector, DemoWorkspaceConfig } from './demoTypes';

const readSectorLabel = (sector?: DemoSector | null) => (sector ? String(sector) : null);

const readWorkspaceLabel = (
  workspace: DemoWorkspaceConfig | null | undefined,
  keys: string[],
  fallback: string,
) => {
  const source = workspace as (DemoWorkspaceConfig & { labels?: Record<string, unknown> }) | null | undefined;
  const labels = source?.labels;

  for (const key of keys) {
    const value = labels?.[key] ?? (source as Record<string, unknown> | undefined)?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return fallback;
};

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
  onPrefill?: (text: string) => void;
}) {
  const valueCards = workspace?.value_cards ?? [];
  const sampleConversations =
    workspace?.sample_conversations ?? workspace?.experience_blueprint?.sample_conversations ?? [];
  const analyticsSummary = workspace?.analytics_summary ?? null;
  const analyticsEntries = analyticsSummary
    ? Object.entries(analyticsSummary).filter(([, value]) => value !== null && value !== undefined)
    : [];
  const educationQuickMenu = Array.isArray(workspace?.education?.quick_menu)
    ? workspace.education.quick_menu
    : null;
  const chatTitle = readWorkspaceLabel(
    workspace,
    ['chat_title', 'conversation_title', 'phone_title'],
    workspace?.title || rubro || readSectorLabel(sector) || 'Demo Chatboc',
  );
  const phoneSubtitle = readWorkspaceLabel(
    workspace,
    ['chat_subtitle', 'conversation_subtitle', 'phone_subtitle'],
    'Web + WhatsApp',
  );
  const availableModes = Object.entries(workspace?.media_capabilities?.input_modes ?? {})
    .filter(([, config]) => config?.enabled !== false)
    .map(([key, config]) => config?.label || key)
    .filter((label): label is string => typeof label === 'string' && label.trim().length > 0);

  return (
    <div className="space-y-4">
      <section className="mx-auto w-full max-w-[440px] rounded-[2rem] border border-border/80 bg-card/90 p-2 shadow-2xl shadow-black/10 backdrop-blur dark:bg-[#10151d]">
        <div className="rounded-[1.6rem] border border-border/60 bg-background/95 p-3 shadow-inner dark:bg-[#0b1018]">
          <div className="mb-3 flex items-center justify-between rounded-[1.2rem] border border-border/60 bg-card/80 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Smartphone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{chatTitle}</p>
                <p className="truncate text-xs text-muted-foreground">{phoneSubtitle}</p>
              </div>
            </div>
            {workspace?.chat_bootstrap?.endpoint ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">
                <CheckCircle2 className="h-3 w-3" />
                online
              </span>
            ) : null}
          </div>

          <div className="max-h-[720px] min-h-[560px] overflow-y-auto rounded-[1.2rem] border border-border/50 bg-muted/15 p-3">
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
                  workspace?.empty_states ?? workspace?.experience_blueprint?.empty_states ?? undefined,
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
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-3 py-3 text-xs text-muted-foreground">
          {sector ? <span className="rounded-full bg-muted px-3 py-1">{readSectorLabel(sector)}</span> : null}
          {availableModes.slice(0, 4).map((mode) => (
            <span key={mode} className="rounded-full bg-muted px-3 py-1">{mode}</span>
          ))}
        </div>
      </section>

      {valueCards.length ? (
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {valueCards.map((card, index) => (
            <div key={card.key || `${card.title}-${index}`} className="rounded-xl border bg-background/70 p-3">
              <p className="font-medium text-foreground">{card.title}</p>
              {card.desc || card.description ? <p className="text-muted-foreground">{card.desc || card.description}</p> : null}
              {card.status ? <p className="mt-2 text-[11px] text-muted-foreground">{card.status}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {analyticsEntries.length ? (
        <div className="rounded-xl border bg-background/70 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4 text-primary" />
            Estado demo
          </div>
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
  );
}
