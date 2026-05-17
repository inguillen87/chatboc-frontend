import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  HelpCircle,
  MapPin,
  PackageCheck,
  Phone,
  ShoppingCart,
  Smartphone,
  Tags,
  Wrench,
} from 'lucide-react';
import ChatPanel from '@/features/chat/ChatPanel';
import type { DemoSector, DemoWorkspaceConfig } from './demoTypes';
import { normalizeDemoRubroTools, type NormalizedDemoRubroTool } from './demoTools';

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

const hasChatRuntime = (workspace: DemoWorkspaceConfig | null | undefined) =>
  Boolean(
    workspace?.chat_bootstrap?.same_origin_endpoint?.trim() ||
      workspace?.chat_bootstrap?.endpoint?.trim(),
  );

const readRuntimeUnavailableState = (workspace: DemoWorkspaceConfig | null | undefined) => {
  const state =
    workspace?.chat_bootstrap?.empty_states?.runtime_unavailable ??
    workspace?.empty_states?.runtime_unavailable ??
    workspace?.experience_blueprint?.empty_states?.runtime_unavailable;

  return {
    title: state?.title || state?.label || 'Demo conversacional no disponible',
    description:
      state?.description ||
      state?.detail ||
      state?.subtitle ||
      state?.text ||
      'Esta experiencia todavia no esta disponible para probar en vivo.',
  };
};

const getToolIcon = (kind: string) => {
  if (kind.includes('catalog') || kind.includes('product')) return ShoppingCart;
  if (kind.includes('price') || kind.includes('precio') || kind.includes('promo')) return Tags;
  if (kind.includes('location') || kind.includes('ubic') || kind.includes('map')) return MapPin;
  if (kind.includes('hour') || kind.includes('horario') || kind.includes('schedule')) return Clock3;
  if (kind.includes('phone') || kind.includes('telefono') || kind.includes('whatsapp')) return Phone;
  if (kind.includes('faq') || kind.includes('consulta') || kind.includes('question')) return HelpCircle;
  if (kind.includes('file') || kind.includes('pdf') || kind.includes('document')) return FileText;
  if (kind.includes('tracking') || kind.includes('pedido') || kind.includes('order')) return PackageCheck;
  if (kind.includes('guide') || kind.includes('playbook')) return BookOpen;
  return Wrench;
};

const DemoRubroToolsPanel = ({
  workspace,
  tools,
}: {
  workspace?: DemoWorkspaceConfig | null;
  tools: NormalizedDemoRubroTool[];
}) => {
  if (!tools.length) return null;

  const title = readWorkspaceLabel(
    workspace,
    ['rubro_tools_title', 'tools_title', 'toolkit_title'],
    'Herramientas del rubro',
  );
  const description = readWorkspaceLabel(
    workspace,
    ['rubro_tools_description', 'tools_description', 'toolkit_description'],
    'Catalogo, precios, ubicacion, horarios y consultas disponibles para esta demo.',
  );

  return (
    <section className="rounded-2xl border bg-background/80 p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {tools.map((tool) => {
          const Icon = getToolIcon(tool.kind);
          const isExternal = Boolean(tool.actionHref && /^https?:\/\//i.test(tool.actionHref));

          return (
            <article key={tool.id} className="rounded-xl border bg-card/70 p-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{tool.label}</p>
                    {tool.statusLabel ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {tool.statusLabel}
                      </span>
                    ) : null}
                  </div>
                  {tool.description ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.description}</p>
                  ) : null}
                  {tool.fields.length ? (
                    <dl className="mt-2 grid gap-1 text-xs">
                      {tool.fields.slice(0, 4).map((field) => (
                        <div key={`${tool.id}-${field.label}`} className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">{field.label}</dt>
                          <dd className="text-right font-medium text-foreground">{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {tool.actionHref && tool.actionLabel ? (
                    <a
                      href={tool.actionHref}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noreferrer' : undefined}
                      className="mt-3 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {tool.actionLabel}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default function DemoWorkspace({
  tenantSlug,
  sector,
  rubro,
  workspace,
  onRuntimeResult,
}: {
  tenantSlug?: string | null;
  sector?: DemoSector | null;
  rubro?: string | null;
  workspace?: DemoWorkspaceConfig | null;
  onRuntimeResult?: (response: unknown, result: unknown) => void;
}) {
  const valueCards = workspace?.value_cards ?? [];
  const sampleConversations =
    workspace?.sample_conversations ?? workspace?.experience_blueprint?.sample_conversations ?? [];
  const analyticsSummary = workspace?.analytics_summary ?? null;
  const analyticsEntries = analyticsSummary
    ? Object.entries(analyticsSummary).filter(([, value]) => value !== null && value !== undefined)
    : [];
  const educationQuickMenu = [
    ...(Array.isArray(workspace?.education?.primary_actions) ? workspace.education.primary_actions : []),
    ...(Array.isArray(workspace?.education?.quick_menu) ? workspace.education.quick_menu : []),
    ...(Array.isArray(workspace?.education?.whatsapp_playbook?.quick_menu)
      ? workspace.education.whatsapp_playbook.quick_menu
      : []),
  ];
  const rubroTools = normalizeDemoRubroTools(workspace);
  const runtimeAvailable = hasChatRuntime(workspace);
  const runtimeUnavailable = readRuntimeUnavailableState(workspace);
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
    .map(([key, config]) => {
      const label = (config as { label?: unknown } | undefined)?.label;
      return typeof label === 'string' && label.trim() ? label.trim() : key;
    })
    .filter((label) => label.trim().length > 0);

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
            {runtimeAvailable ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">
                <CheckCircle2 className="h-3 w-3" />
                online
              </span>
            ) : null}
          </div>

          <div className="max-h-[720px] min-h-[560px] overflow-y-auto rounded-[1.2rem] border border-border/50 bg-muted/15 p-3">
            {runtimeAvailable ? (
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
                onRuntimeResult={onRuntimeResult}
              />
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[1rem] border border-dashed border-border/70 bg-card/50 p-6 text-center">
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <p className="max-w-xs text-base font-semibold text-foreground">{runtimeUnavailable.title}</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  {runtimeUnavailable.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-3 py-3 text-xs text-muted-foreground">
          {sector ? <span className="rounded-full bg-muted px-3 py-1">{readSectorLabel(sector)}</span> : null}
          {availableModes.slice(0, 4).map((mode) => (
            <span key={mode} className="rounded-full bg-muted px-3 py-1">{mode}</span>
          ))}
        </div>
      </section>

      <DemoRubroToolsPanel workspace={workspace} tools={rubroTools} />

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
