import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Inbox,
  MapPinned,
  MessageSquareText,
  ShieldCheck,
  ShoppingCart,
  Users,
} from "lucide-react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { resetChatSessionId } from "@/utils/chatSessionId";
import getOrCreateAnonId from "@/utils/anonId";
import RubroSelector from "@/components/chat/RubroSelector";
import type { Rubro } from "@/types/rubro";
import type { Message, SendPayload } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { getCurrentTipoChat, enforceTipoChatForRubro, parseRubro } from "@/utils/tipoChat";
import { getAskEndpoint } from "@/utils/chatEndpoints";
import { extractRubroKey, extractRubroLabel } from "@/utils/rubros";
import { extractButtonsFromResponse } from "@/utils/chatButtons";
import DemoWorkspace from '@/features/demo/DemoWorkspace';
import DemoSectorStep from '@/features/demo/DemoSectorStep';
import { createDemoSession, createLocalDemoSession, getDemoAdminPreview, getDemoCatalog } from '@/features/demo/demoApi';
import type {
  DemoAdminPreviewResponse,
  DemoCatalogResponse,
  DemoChatBootstrap,
  DemoSector,
  DemoSectorGroup,
  DemoWorkspaceConfig,
} from '@/features/demo/demoTypes';
import { sendChatBootstrapMessage } from '@/features/chat/chatApi';
import { findDemoCatalogAsset } from '@/data/demoCatalogAssets';
import { downloadDemoCatalogPdf } from '@/utils/demoCatalogPdf';
import { CHATBOC_ORBIT_AVATAR } from '@/utils/brandAssets';

const MAX_PREGUNTAS = 15;

const findSectorGroup = (
  catalog: DemoCatalogResponse | null,
  sector: DemoSector | null,
): DemoSectorGroup | null => {
  if (!sector) return null;
  return catalog?.sector_groups?.find((group) => String(group.key) === String(sector)) ?? null;
};

const readSectorLabel = (group: DemoSectorGroup | null, sector: DemoSector | null) => {
  if (group?.label?.trim()) return group.label.trim();
  if (sector === 'gobierno') return 'Gobierno';
  if (sector === 'empresas') return 'Empresas';
  if (sector === 'educacion') return 'Colegios e instituciones educativas';
  return sector ? String(sector) : 'Demo';
};

const readSectorTenantSlug = (group: DemoSectorGroup | null) => {
  const candidates = [
    group?.tenant_slug,
    group?.demo_tenant_slug,
    group?.default_tenant_slug,
    typeof group?.tenant === 'string' ? group.tenant : null,
    typeof group?.slug === 'string' ? group.slug : null,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() ?? null;
};

const rootMatchesSector = (root: Rubro, sector: DemoSector | null) => {
  if (!sector) return false;
  if (sector === 'gobierno') return root.id === 1 || root.clave === 'municipios_root';
  if (sector === 'empresas') return root.id === 2 || root.clave === 'comerciales_root';
  if (sector === 'educacion') return root.id === 3 || root.clave === 'educacion_root';
  return String(root.clave || root.nombre || '').toLowerCase().includes(String(sector).toLowerCase());
};

const readSectorCatalogSlug = (sector: DemoSector | null) => {
  if (sector === 'gobierno') return 'municipio';
  if (sector === 'empresas') return 'bodega';
  if (sector === 'educacion') return 'colegio-demo';
  return null;
};

const buildDemoFallbackReply = ({
  text,
  sectorLabel,
  catalogTitle,
}: {
  text: string;
  sectorLabel: string | null;
  catalogTitle?: string | null;
}) => {
  const cleanText = text.trim();
  const context = sectorLabel ? ` en el recorrido de ${sectorLabel}` : '';
  const resource = catalogTitle ? ` También dejé disponible el catálogo "${catalogTitle}" para que lo puedas descargar.` : '';

  if (!cleanText) {
    return `Demo lista${context}. Probá una consulta, adjuntá un archivo o usá una acción sugerida: la idea es ver cómo Chatboc ordena el caso y deja seguimiento para el equipo.${resource}`;
  }

  return `Listo, tomé "${cleanText}" como una consulta demo${context}. Chatboc puede responder, pedir datos faltantes, registrar el caso y derivarlo a una persona si hace falta.${resource}`;
};

const getDemoScenario = (sector: DemoSector | null, rubro?: string | null) => {
  if (sector === 'educacion') {
    return {
      icon: GraduationCap,
      title: 'Panel demo para dirección escolar',
      subtitle: rubro || 'Colegio privado integral',
      outcome: 'Familias, secretaría y equipo directivo viendo el mismo caso con contexto.',
      modules: ['Resumen', 'Familias', 'Casos escolares', 'Comunicados', 'Pagos', 'Equipo', 'Canales'],
      cards: [
        { label: 'Casos abiertos', value: '18', detail: 'inasistencias, documentación y admisiones', icon: Inbox },
        { label: 'Tiempo de respuesta', value: '4 min', detail: 'prioridad por sensibilidad del caso', icon: Clock3 },
        { label: 'Canales activos', value: '3', detail: 'web, WhatsApp y voz', icon: MessageSquareText },
      ],
      timeline: ['Familia inicia consulta', 'Chatboc pide datos faltantes', 'Secretaría recibe el caso', 'Resumen por WhatsApp'],
    };
  }

  if (sector === 'gobierno') {
    return {
      icon: MapPinned,
      title: 'Centro de atención ciudadana',
      subtitle: rubro || 'Gobierno y municipios',
      outcome: 'Reclamos, turnos, noticias y participación ordenados por zona, prioridad y estado.',
      modules: ['Resumen', 'Reclamos', 'Mapa', 'Encuestas', 'Noticias', 'Equipo', 'Canales'],
      cards: [
        { label: 'Reclamos activos', value: '42', detail: 'con zona, foto y estado', icon: Inbox },
        { label: 'Mapa operativo', value: 'live', detail: 'capas por categoría y prioridad', icon: MapPinned },
        { label: 'Participación', value: '8.7', detail: 'satisfacción y respuestas', icon: BarChart3 },
      ],
      timeline: ['Vecino envía ubicación', 'Se clasifica el reclamo', 'Área responsable toma el caso', 'Seguimiento con código'],
    };
  }

  return {
    icon: ShoppingCart,
    title: 'Operación comercial con carrito',
    subtitle: rubro || 'Empresa y ventas',
    outcome: 'Catálogo, pedidos, consultas, pagos y seguimiento reunidos para vender sin perder contexto.',
    modules: ['Resumen', 'Inbox', 'Catálogo', 'Pedidos', 'Clientes', 'Pagos', 'Canales'],
    cards: [
      { label: 'Pedidos', value: '26', detail: 'pendientes, pagos y entregas', icon: ShoppingCart },
      { label: 'Leads', value: 'CRM', detail: 'contactos listos para seguimiento', icon: Users },
      { label: 'Catálogo', value: '92%', detail: 'productos listos para vender', icon: FileText },
    ],
    timeline: ['Cliente consulta producto', 'Chatboc arma pedido', 'Se confirma contacto o pago', 'Historial queda guardado'],
  };
};

const DEMO_PREVIEW_ICONS = {
  analytics: BarChart3,
  bar: BarChart3,
  cart: ShoppingCart,
  catalog: FileText,
  commerce: ShoppingCart,
  education: GraduationCap,
  inbox: Inbox,
  lead: Users,
  map: MapPinned,
  message: MessageSquareText,
  order: ShoppingCart,
  school: GraduationCap,
  ticket: Inbox,
  time: Clock3,
  users: Users,
} as const;

const resolvePreviewIcon = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  const match = Object.entries(DEMO_PREVIEW_ICONS).find(([key]) => normalized.includes(key));
  return match?.[1] ?? FileText;
};

const normalizePreviewModules = (preview: DemoAdminPreviewResponse | null, fallback: string[]) => {
  const modules = Array.isArray(preview?.modules) ? preview.modules : [];
  const labels = modules
    .map((module) => module.label ?? module.title ?? module.id)
    .filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
    .map((label) => label.trim());
  return labels.length ? labels : fallback;
};

const normalizePreviewCards = (
  preview: DemoAdminPreviewResponse | null,
  fallback: ReturnType<typeof getDemoScenario>['cards'],
) => {
  const cards = Array.isArray(preview?.cards) ? preview.cards : [];
  const normalized = cards
    .map((card) => {
      const label = card.label ?? card.title ?? card.id ?? card.key;
      if (!label) return null;
      return {
        label: String(label),
        value: card.value ?? card.status ?? '',
        detail: card.description ?? card.detail ?? '',
        icon: resolvePreviewIcon(card.icon ?? card.id ?? card.key ?? card.label),
      };
    })
    .filter((card): card is { label: string; value: string | number; detail: string; icon: React.ElementType } =>
      Boolean(card),
    );

  return normalized.length ? normalized : fallback;
};

const normalizePreviewTimeline = (preview: DemoAdminPreviewResponse | null, fallback: string[]) => {
  const timeline = Array.isArray(preview?.timeline) ? preview.timeline : [];
  const normalized = timeline
    .map((item) => ({
      id: item.id ?? item.title ?? item.label ?? item.description,
      title: item.title ?? item.label ?? item.description,
      description: item.description ?? null,
    }))
    .filter((item): item is { id: string; title: string; description: string | null } =>
      typeof item.id === 'string' && typeof item.title === 'string' && item.title.trim().length > 0,
    );

  return normalized.length
    ? normalized
    : fallback.map((title) => ({ id: title, title, description: null }));
};

const DemoAdminPreview = ({
  sector,
  rubro,
  preview,
}: {
  sector: DemoSector | null;
  rubro?: string | null;
  preview?: DemoAdminPreviewResponse | null;
}) => {
  const scenario = getDemoScenario(sector, rubro);
  const Icon = scenario.icon;
  const labels = preview?.labels ?? {};
  const modules = normalizePreviewModules(preview ?? null, scenario.modules);
  const cards = normalizePreviewCards(preview ?? null, scenario.cards);
  const timeline = normalizePreviewTimeline(preview ?? null, scenario.timeline);
  const title = preview?.title?.trim() || scenario.title;
  const subtitle = preview?.subtitle?.trim() || scenario.subtitle;
  const outcome = preview?.description?.trim() || preview?.outcome?.trim() || scenario.outcome;
  const adminLabel = labels.admin_preview ?? labels.admin ?? 'Admin demo';
  const viewLabel = labels.overview ?? labels.view ?? 'Vista 360';
  const statusLabel = preview?.status_label?.trim() || (labels.status ?? 'listo para mostrar');
  const timelineTitle = labels.timeline_title ?? labels.timeline ?? 'Recorrido visible para el equipo';
  const timelineBadge = labels.timeline_badge ?? 'demo';
  const timelineDetail = labels.timeline_detail ?? 'queda listo para continuar sin perder datos';
  const summaryTitle = labels.summary_title ?? 'Lo que se ve en la demo';
  const summaryDescription =
    labels.summary_description ??
    'Conversación, recursos, acciones, estado, equipo y seguimiento trabajan en el mismo recorrido.';

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
      <div className="grid gap-0">
        <aside className="border-b border-border/70 bg-muted/25 p-4 sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{adminLabel}</p>
              <h3 className="text-lg font-bold text-foreground">{subtitle}</h3>
            </div>
          </div>
          <nav className="grid gap-2">
            {modules.map((module, index) => (
              <button
                key={module}
                type="button"
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                  index === 0
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{module}</span>
                {index === 0 ? <CheckCircle2 className="h-4 w-4" /> : null}
              </button>
            ))}
          </nav>
        </aside>

        <div className="p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{viewLabel}</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{title}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{outcome}</p>
            </div>
            <span className="w-fit rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              {statusLabel}
            </span>
          </div>

          <div className="grid gap-3">
            {cards.map((card) => {
              const CardIcon = card.icon;
              return (
                <div key={card.label} className="rounded-xl border border-border/70 bg-background/70 p-4">
                  <CardIcon className="mb-4 h-5 w-5 text-primary" />
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-1 text-2xl font-black tracking-tight text-foreground">{card.value}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.detail}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{timelineTitle}</p>
                <span className="text-xs text-muted-foreground">{timelineBadge}</span>
              </div>
              <div className="space-y-3">
                {timeline.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${index < 2 ? 'bg-success' : index === 2 ? 'bg-primary' : 'bg-muted-foreground/35'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description ?? timelineDetail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground">{summaryTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{summaryDescription}</p>
            </div>
            <div className="hidden">
              <p className="text-sm font-semibold text-foreground">Lo que debería ver un comprador</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                No solo un chat: una operación completa con conversación, recursos, acciones, estado, equipo y seguimiento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Demo = () => {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [preguntasUsadas, setPreguntasUsadas] = useState(0);
  const [rubroSeleccionado, setRubroSeleccionado] = useState<string | null>(null);
  const [rubroClaveSeleccionado, setRubroClaveSeleccionado] = useState<string | null>(null);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [esperandoRubro, setEsperandoRubro] = useState(true); // Initialize to true
  const [anonId, setAnonId] = useState<string>("");
  const [sectorSeleccionado, setSectorSeleccionado] = useState<DemoSector | null>(null);
  const [demoCatalog, setDemoCatalog] = useState<DemoCatalogResponse | null>(null);
  const [demoSessionId, setDemoSessionId] = useState<string | null>(null);
  const [demoTenantSlug, setDemoTenantSlug] = useState<string | null>(null);
  const [demoWorkspace, setDemoWorkspace] = useState<DemoWorkspaceConfig | null>(null);
  const [demoAdminPreview, setDemoAdminPreview] = useState<DemoAdminPreviewResponse | null>(null);
  const [useLocalDemoRuntime, setUseLocalDemoRuntime] = useState(false);
  const [catalogDownloadError, setCatalogDownloadError] = useState<string | null>(null);
  const [isCatalogDownloading, setIsCatalogDownloading] = useState(false);
  const [contexto, setContexto] = useState({});
  const lastQueryRef = useRef<string | null>(null);
  const initialDemoLoadRef = useRef(false);
  const hydratedSessionRef = useRef(false);

  const rubroClave = rubroClaveSeleccionado || extractRubroKey(rubroSeleccionado);
  const rubroNormalizado = parseRubro(rubroClave);

  const activeChatBootstrap = demoWorkspace?.chat_bootstrap ?? null;
  const isLocalDemoMode = useLocalDemoRuntime || demoCatalog?.local_demo_mode === true;
  const selectedSectorGroup = findSectorGroup(demoCatalog, sectorSeleccionado);
  const visibleRubrosDisponibles = useMemo(
    () => rubrosDisponibles.filter((root) => rootMatchesSector(root, sectorSeleccionado)),
    [rubrosDisponibles, sectorSeleccionado],
  );
  const activeCatalogAsset = useMemo(() => {
    const candidates = [
      rubroClaveSeleccionado,
      readSectorTenantSlug(selectedSectorGroup),
      readSectorCatalogSlug(sectorSeleccionado),
      demoTenantSlug,
    ];
    for (const candidate of candidates) {
      const asset = findDemoCatalogAsset(candidate);
      if (asset) return asset;
    }
    return null;
  }, [demoTenantSlug, rubroClaveSeleccionado, sectorSeleccionado, selectedSectorGroup]);
  const demoPreviewTenantSlug = useMemo(
    () => demoTenantSlug ?? readSectorTenantSlug(selectedSectorGroup) ?? readSectorCatalogSlug(sectorSeleccionado),
    [demoTenantSlug, sectorSeleccionado, selectedSectorGroup],
  );


  // Action: reset demo and choose another rubro
  const handleChangeRubro = () => {
    safeLocalStorage.removeItem("rubroSeleccionado");
    safeLocalStorage.removeItem("rubroSeleccionado_label");
    resetChatSessionId();
    setRubroSeleccionado(null);
    setRubroClaveSeleccionado(null);
    setEsperandoRubro(true);
    setMessages([]);
    setPreguntasUsadas(0);
    setContexto({});
    setSectorSeleccionado(null);
    setDemoSessionId(null);
    setDemoTenantSlug(null);
    setDemoWorkspace(null);
    setDemoAdminPreview(null);
    setUseLocalDemoRuntime(false);
    lastQueryRef.current = null;
    hydratedSessionRef.current = false;
    // The useEffect for loading rubros will trigger again due to rubroSeleccionado being null
    // or rather, we explicitly set esperandoRubro to true and then the rubro loading logic runs
    getDemoCatalog()
        .then((data) => {
          setDemoCatalog(data);
          setRubrosDisponibles(Array.isArray(data?.rubros) ? data.rubros : []);
        })
        .catch(() => {
          setDemoCatalog(null);
          setRubrosDisponibles([]);
        });
  };


  const openDemoWidget = useCallback(() => {
    try {
      (window as any).chatbocOpenWidget?.();
    } catch (error) {
      console.debug('No se pudo abrir el widget en demo', error);
    }
  }, []);

  const startDemoConversation = useCallback(
    async (rubroNombre: string, bootstrapOverride?: DemoChatBootstrap | null, tenantSlugOverride?: string | null, forceLocal = false) => {
      const normalized = parseRubro(rubroNombre);
      const chatBootstrap = bootstrapOverride ?? activeChatBootstrap;
      const tenantSlug = tenantSlugOverride ?? demoTenantSlug;

      const currentAnonId = anonId || getOrCreateAnonId();
      if (!anonId) {
        setAnonId(currentAnonId);
      }

      setIsTyping(true);
      setMessages([]);
      setPreguntasUsadas(0);
      setContexto({});
      lastQueryRef.current = null;

      try {
        if (forceLocal || (!chatBootstrap && isLocalDemoMode)) {
          const fallbackText = buildDemoFallbackReply({
            text: "",
            sectorLabel: rubroSeleccionado || rubroNombre,
            catalogTitle: activeCatalogAsset?.title,
          });
          setMessages([
            {
              id: Date.now(),
              text: fallbackText,
              isBot: true,
              timestamp: new Date(),
              query: undefined,
            },
          ]);
          return;
        }

        const response = chatBootstrap
          ? await sendChatBootstrapMessage(
              chatBootstrap,
              {
                text: "",
              },
              tenantSlug,
            )
          : await (async () => {
              const baseTipo = getCurrentTipoChat();
              const adjustedTipo =
                sectorSeleccionado === 'gobierno'
                  ? 'municipio'
                  : sectorSeleccionado === 'educacion' || sectorSeleccionado === 'empresas'
                    ? 'pyme'
                    : enforceTipoChatForRubro(baseTipo, normalized);
              const endpoint = getAskEndpoint({ tipoChat: adjustedTipo, rubro: normalized || undefined });
              return apiFetch<any>(endpoint, {
                method: "POST",
                body: {
                  pregunta: "",
                  action: "initial_greeting",
                  contexto_previo: {},
                  anon_id: currentAnonId,
                  tipo_chat: adjustedTipo,
                  ...(adjustedTipo === "pyme" && rubroNombre
                    ? { rubro_clave: rubroNombre }
                    : {}),
                },
                headers: { "Content-Type": "application/json" },
                skipAuth: true,
              });
            })();

        setContexto((response as any)?.contexto_actualizado || {});
        const respuestaText = response.respuesta_usuario || "No se pudo generar una respuesta demo.";
        const botones = extractButtonsFromResponse(response);

        const botMessage: Message = {
          id: Date.now(),
          text: respuestaText,
          isBot: true,
          timestamp: new Date(),
          botones,
        };

        setMessages([botMessage]);
      } catch {
        setMessages([
          {
            id: Date.now(),
            text: "Modo demo iniciado. Podés escribir una consulta o descargar el catálogo para probar el recorrido.",
            isBot: true,
            timestamp: new Date(),
            query: undefined,
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [activeCatalogAsset?.title, activeChatBootstrap, anonId, demoTenantSlug, isLocalDemoMode, rubroSeleccionado, sectorSeleccionado, setAnonId, setContexto, setIsTyping, setMessages, setPreguntasUsadas]
  );

  const handleDownloadCatalog = useCallback(async () => {
    if (!activeCatalogAsset) return;
    setCatalogDownloadError(null);
    setIsCatalogDownloading(true);
    try {
      await downloadDemoCatalogPdf(activeCatalogAsset);
    } catch (error) {
      console.warn('No se pudo generar el catálogo demo en el navegador', error);
      setCatalogDownloadError('No se pudo generar el PDF en el navegador. Abrí la ficha del catálogo para intentarlo nuevamente.');
    } finally {
      setIsCatalogDownloading(false);
    }
  }, [activeCatalogAsset]);

  useEffect(() => {
    if (!sectorSeleccionado) {
      setDemoAdminPreview(null);
      return;
    }

    let active = true;
    getDemoAdminPreview({
      sector: sectorSeleccionado,
      tenant_slug: demoPreviewTenantSlug,
    })
      .then((preview) => {
        if (active) setDemoAdminPreview(preview);
      })
      .catch(() => {
        if (active) setDemoAdminPreview(null);
      });

    return () => {
      active = false;
    };
  }, [demoPreviewTenantSlug, sectorSeleccionado]);

  useEffect(() => {
    if (hydratedSessionRef.current) return;
    const state = location.state as
      | {
          demoSession?: Awaited<ReturnType<typeof createDemoSession>>;
          sector?: DemoSector;
          rubroLabel?: string;
          rubroSlug?: string;
        }
      | null;
    const sessionId = new URLSearchParams(location.search).get('session');
    if (!sessionId || !state?.demoSession) return;

    hydratedSessionRef.current = true;
    const session = state.demoSession;
    const sector = state.sector ?? sectorSeleccionado ?? null;
    const rubroLabel = state.rubroLabel ?? state.rubroSlug ?? sector ?? null;
    setDemoCatalog((current) => current ?? { sectors: sector ? [sector] : [] });
    setSectorSeleccionado(sector);
    setRubroSeleccionado(rubroLabel);
    setRubroClaveSeleccionado(state.rubroSlug ?? rubroLabel);
    setDemoSessionId(session.demo_session_id ?? session.session_id ?? sessionId);
    setDemoTenantSlug(session.tenant_slug ?? null);
    setDemoWorkspace(session.workspace ?? null);
    setUseLocalDemoRuntime(Boolean((session as any).local_demo_mode));
    setEsperandoRubro(false);
    openDemoWidget();
    void startDemoConversation(
      state.rubroSlug ?? rubroLabel ?? String(sector ?? ''),
      session.workspace?.chat_bootstrap ?? null,
      session.tenant_slug ?? null,
      Boolean((session as any).local_demo_mode),
    );
  }, [location.search, location.state, openDemoWidget, sectorSeleccionado, startDemoConversation]);


  // Set Anon ID on mount
  useEffect(() => {
    setAnonId(getOrCreateAnonId());
  }, []);

  // Load rubros and handle initial welcome message
  useEffect(() => {
    if (initialDemoLoadRef.current) return;
    initialDemoLoadRef.current = true;

    const storedClave = safeLocalStorage.getItem("rubroSeleccionado");
    const storedLabel = safeLocalStorage.getItem("rubroSeleccionado_label");
    const requestedSector = new URLSearchParams(location.search).get('sector') as DemoSector | null;
    const normalizedRequestedSector =
      requestedSector === 'educacion' || requestedSector === 'gobierno' || requestedSector === 'empresas'
        ? requestedSector
        : null;

    if (normalizedRequestedSector && !storedClave) {
      const fallbackGroup = findSectorGroup(
        { sector_groups: demoCatalog?.sector_groups ?? [] } as DemoCatalogResponse,
        normalizedRequestedSector,
      );
      const localSession = createLocalDemoSession({
        sector: normalizedRequestedSector,
        tenant_slug: readSectorTenantSlug(fallbackGroup) ?? readSectorCatalogSlug(normalizedRequestedSector),
        pillar: normalizedRequestedSector,
        category_slug: normalizedRequestedSector,
      });
      const label = readSectorLabel(fallbackGroup, normalizedRequestedSector);
      setSectorSeleccionado(normalizedRequestedSector);
      setRubroSeleccionado(label);
      setRubroClaveSeleccionado(normalizedRequestedSector);
      setDemoSessionId(localSession.demo_session_id ?? null);
      setDemoTenantSlug(localSession.tenant_slug ?? null);
      setDemoWorkspace(localSession.workspace ?? null);
      setUseLocalDemoRuntime(true);
      setEsperandoRubro(false);
      openDemoWidget();
      void startDemoConversation(normalizedRequestedSector, null, localSession.tenant_slug ?? null, true);
      return;
    }

    if (storedClave && !rubroClaveSeleccionado) {
      const normalizedClave = extractRubroKey(storedClave) ?? storedClave;
      const localSession = createLocalDemoSession({
        rubro: normalizedClave,
        rubro_slug: normalizedClave,
        category_slug: normalizedClave,
      });
      setRubroClaveSeleccionado(normalizedClave);
      if (!rubroSeleccionado) {
        setRubroSeleccionado(storedLabel || storedClave);
      }
      setDemoSessionId(localSession.demo_session_id ?? null);
      setDemoTenantSlug(localSession.tenant_slug ?? null);
      setDemoWorkspace(localSession.workspace ?? null);
      setUseLocalDemoRuntime(true);
      setEsperandoRubro(false);
      openDemoWidget();
      void startDemoConversation(normalizedClave, null, localSession.tenant_slug ?? null, true);
    } else if (!storedClave) {
      setEsperandoRubro(true);
      setMessages([]);
      getDemoCatalog()
        .then((data) => {
          setDemoCatalog(data);
          setRubrosDisponibles(Array.isArray(data?.rubros) ? data.rubros : []);
        })
        .catch(() => {
          setDemoCatalog(null);
          setRubrosDisponibles([]);
        });
    }
  }, [location.search, location.state, rubroClaveSeleccionado, rubroSeleccionado, startDemoConversation, openDemoWidget]);

  const handleSendMessage = useCallback(
    async (payload: SendPayload | string) => {
      const text = typeof payload === "string" ? payload : payload.text;
      const extras: Partial<SendPayload> = typeof payload === "string" ? {} : payload;
      if (!text.trim() && !extras.action && !extras.archivo_url && !extras.ubicacion_usuario) return;
      if (!rubroSeleccionado) return;
      if (preguntasUsadas >= MAX_PREGUNTAS) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text:
              "🔒 Límite de 15 preguntas en la demo alcanzado.<br><span class='block mt-2'><a href='/register' class='underline text-primary hover:text-primary/80'>Registrate para usar Chatboc sin límites</a> o <a href='https://wa.me/5492613168608?text=Hola! Estoy probando Chatboc y quiero implementarlo en mi empresa.' class='underline text-primary hover:text-primary/80' target='_blank'>contactanos</a> para planes comerciales.</span>",
            isBot: true,
            timestamp: new Date(),
            query: undefined,
          },
        ]);
        return;
      }

      const userMessage: Message = {
        id: Date.now(),
        text,
        isBot: false,
        timestamp: new Date(),
        query: undefined,
        mediaUrl: extras.es_foto ? extras.archivo_url : undefined,
        locationData: extras.es_ubicacion ? extras.ubicacion_usuario : undefined,
      };
      setMessages((prev) => [...prev, userMessage]);
      lastQueryRef.current = text;
      setIsTyping(true);

      try {
        if (!activeChatBootstrap && isLocalDemoMode) {
          const fallbackText = buildDemoFallbackReply({
            text,
            sectorLabel: rubroSeleccionado,
            catalogTitle: activeCatalogAsset?.title,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: fallbackText,
              isBot: true,
              timestamp: new Date(),
              query: lastQueryRef.current || undefined,
            },
          ]);
          lastQueryRef.current = null;
          setPreguntasUsadas((prev) => prev + 1);
          return;
        }

        const response = activeChatBootstrap
          ? await sendChatBootstrapMessage(
              activeChatBootstrap,
              {
                text,
                intent: extras.action ?? extras.action_id ?? null,
                payload: typeof extras.payload === 'object' && extras.payload !== null ? extras.payload : null,
                attachmentInfo: extras.attachmentInfo ?? (extras.es_foto ? { url: extras.archivo_url } : undefined),
                location: extras.location ?? extras.ubicacion_usuario,
              },
              demoTenantSlug,
            )
          : await (async () => {
              const currentTipo = getCurrentTipoChat();
              const rubroParaTipo = rubroClave ?? rubroSeleccionado;
              const adjustedTipo =
                sectorSeleccionado === 'gobierno'
                  ? 'municipio'
                  : sectorSeleccionado === 'educacion' || sectorSeleccionado === 'empresas'
                    ? 'pyme'
                    : enforceTipoChatForRubro(currentTipo, rubroParaTipo);
              const payloadBody: Record<string, any> = {
                pregunta: text,
                rubro_clave: rubroClave ?? rubroSeleccionado,
                contexto_previo: contexto,
                anon_id: anonId,
                tipo_chat: adjustedTipo,
                ...(extras.es_foto && { es_foto: true, archivo_url: extras.archivo_url }),
                ...(extras.es_ubicacion && { es_ubicacion: true, ubicacion_usuario: extras.ubicacion_usuario }),
                ...(extras.action && { action: extras.action }),
              };
              const endpoint = getAskEndpoint({
                tipoChat: adjustedTipo,
                rubro: rubroNormalizado || undefined,
              });
              return apiFetch<any>(endpoint, {
                method: "POST",
                body: payloadBody,
                headers: { "Content-Type": "application/json" },
                skipAuth: true,
              });
            })();

        setContexto((response as any)?.contexto_actualizado || {});

        const respuestaText = response.respuesta_usuario || "No se pudo generar una respuesta demo.";
        const botones = extractButtonsFromResponse(response);

        const botMessage: Message = {
          id: Date.now(),
          text: respuestaText,
          isBot: true,
          timestamp: new Date(),
          botones,
          query: lastQueryRef.current || undefined,
        };

        setMessages((prev) => [...prev, botMessage]);
        lastQueryRef.current = null;
        setPreguntasUsadas((prev) => prev + 1);
      } catch {
        const fallbackText = buildDemoFallbackReply({
          text,
          sectorLabel: rubroSeleccionado,
          catalogTitle: activeCatalogAsset?.title,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: fallbackText,
            isBot: true,
            timestamp: new Date(),
            query: lastQueryRef.current || undefined,
          },
        ]);
        lastQueryRef.current = null;
        setPreguntasUsadas((prev) => prev + 1);
      } finally {
        setIsTyping(false);
      }
    },
    [activeCatalogAsset?.title, activeChatBootstrap, contexto, demoTenantSlug, isLocalDemoMode, rubroSeleccionado, anonId, preguntasUsadas, rubroClave, rubroNormalizado, sectorSeleccionado]
  );

  const startSectorDemo = useCallback(async () => {
    if (!sectorSeleccionado) return;
    const sector = sectorSeleccionado;
    const group = findSectorGroup(demoCatalog, sector);
    const label = readSectorLabel(group, sector);
    const tenantSlug = readSectorTenantSlug(group);

    setSectorSeleccionado(sector);
    setRubroSeleccionado(label);
    setRubroClaveSeleccionado(sector);
    setEsperandoRubro(false);
    setMessages([]);
    setPreguntasUsadas(0);
    setContexto({});
    openDemoWidget();

    try {
      const session = demoCatalog?.local_demo_mode
        ? createLocalDemoSession({
            sector,
            tenant_slug: tenantSlug,
            pillar: sector,
            category_slug: String(sector),
          })
        : await createDemoSession({
            sector,
            tenant_slug: tenantSlug,
            pillar: sector,
            category_slug: String(sector),
          });
      setDemoSessionId(session.demo_session_id ?? null);
      setDemoTenantSlug(session.tenant_slug ?? tenantSlug ?? null);
      setDemoWorkspace(session.workspace ?? null);
      setUseLocalDemoRuntime(Boolean((session as any).local_demo_mode));
      await startDemoConversation(
        sector,
        session.workspace?.chat_bootstrap ?? null,
        session.tenant_slug ?? tenantSlug ?? null,
        Boolean((session as any).local_demo_mode),
      );
    } catch (error) {
      const session = createLocalDemoSession({
        sector,
        tenant_slug: tenantSlug,
        pillar: sector,
        category_slug: String(sector),
      });
      setDemoSessionId(session.demo_session_id ?? null);
      setDemoTenantSlug(session.tenant_slug ?? tenantSlug ?? null);
      setDemoWorkspace(session.workspace ?? null);
      setUseLocalDemoRuntime(true);
      await startDemoConversation(String(sector), null, session.tenant_slug ?? tenantSlug ?? null, true);
    }
  }, [demoCatalog, openDemoWidget, sectorSeleccionado, startDemoConversation]);

  // Rubros selector UI
  if (esperandoRubro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background dark:bg-gradient-to-b dark:from-[#10141b] dark:to-[#181d24] text-foreground">
        <div className="w-full max-w-3xl p-7 rounded-3xl shadow-xl border border-border bg-card/90 dark:bg-[#191f2b]">
          <img
            src={CHATBOC_ORBIT_AVATAR}
            alt="Chatboc"
            className="mx-auto w-14 h-14 mb-3"
            style={{ filter: "drop-shadow(0 4px 16px #1d69e0cc)" }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png";
            }}
          />
          <h2 className="text-2xl font-bold mb-2 text-primary">Bienvenido a Chatboc</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Elegí un pilar y después una categoría para iniciar una demo guiada.
          </p>
          <div className="mb-4">
            <DemoSectorStep
              sectors={demoCatalog?.sectors}
              sectorGroups={demoCatalog?.sector_groups}
              selectedSector={sectorSeleccionado}
              onSelect={setSectorSeleccionado}
            />
          </div>
          {sectorSeleccionado ? null : (
            <p className="mb-3 text-xs text-muted-foreground">Primero seleccioná el sector para iniciar la demo.</p>
          )}
          {sectorSeleccionado && visibleRubrosDisponibles.length === 0 ? (
            <div className="space-y-3 rounded-lg border bg-background/70 p-3 text-left">
              {selectedSectorGroup?.description ? (
                <p className="text-sm text-muted-foreground">{selectedSectorGroup.description}</p>
              ) : null}
              <button
                type="button"
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => void startSectorDemo()}
              >
                {selectedSectorGroup?.cta_label?.trim() || 'Iniciar demo'}
              </button>
            </div>
          ) : (
            <RubroSelector
              rubros={sectorSeleccionado ? visibleRubrosDisponibles : []}
              onSelect={(rubro) => {
              const clave = extractRubroKey(rubro);
              const etiqueta = extractRubroLabel(rubro) || rubro.nombre;

              if (!clave && !etiqueta) {
                console.warn('Demo: rubro recibido sin datos suficientes', rubro);
                return;
              }

              if (clave) {
                safeLocalStorage.setItem("rubroSeleccionado", clave);
              } else {
                safeLocalStorage.removeItem("rubroSeleccionado");
              }

              if (etiqueta) {
                safeLocalStorage.setItem("rubroSeleccionado_label", etiqueta);
              } else {
                safeLocalStorage.removeItem("rubroSeleccionado_label");
              }

              if (!sectorSeleccionado) {
                return;
              }

              setRubroSeleccionado(etiqueta || clave || null);
              setRubroClaveSeleccionado(clave ?? null);
              setEsperandoRubro(false);
              openDemoWidget();
              void (async () => {
                try {
                  const fallbackTenantSlug = rubro.demo?.slug ?? readSectorTenantSlug(selectedSectorGroup);
                  const session = demoCatalog?.local_demo_mode
                    ? createLocalDemoSession({
                        sector: sectorSeleccionado,
                        rubro_slug: clave ?? etiqueta ?? rubro.nombre,
                        category_slug: clave ?? etiqueta ?? rubro.nombre,
                        tenant_slug: fallbackTenantSlug,
                      })
                    : await createDemoSession({
                        sector: sectorSeleccionado,
                        rubro_slug: clave ?? etiqueta ?? rubro.nombre,
                        category_slug: clave ?? etiqueta ?? rubro.nombre,
                        tenant_slug: fallbackTenantSlug,
                      });
                  setDemoSessionId(session.demo_session_id ?? null);
                  setDemoTenantSlug(session.tenant_slug ?? fallbackTenantSlug ?? null);
                  setDemoWorkspace(session.workspace ?? null);
                  setUseLocalDemoRuntime(Boolean((session as any).local_demo_mode));
                  await startDemoConversation(
                    clave ?? etiqueta ?? rubro.nombre,
                    session.workspace?.chat_bootstrap ?? null,
                    session.tenant_slug ?? fallbackTenantSlug ?? null,
                    Boolean((session as any).local_demo_mode),
                  );
                } catch {
                  const fallbackTenantSlug = rubro.demo?.slug ?? readSectorTenantSlug(selectedSectorGroup);
                  const session = createLocalDemoSession({
                    sector: sectorSeleccionado,
                    rubro_slug: clave ?? etiqueta ?? rubro.nombre,
                    category_slug: clave ?? etiqueta ?? rubro.nombre,
                    tenant_slug: fallbackTenantSlug,
                  });
                  setDemoSessionId(session.demo_session_id ?? null);
                  setDemoTenantSlug(session.tenant_slug ?? fallbackTenantSlug ?? null);
                  setDemoWorkspace(session.workspace ?? null);
                  setUseLocalDemoRuntime(true);
                  await startDemoConversation(clave ?? etiqueta ?? rubro.nombre, null, session.tenant_slug ?? fallbackTenantSlug ?? null, true);
                }
              })();
            }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background text-foreground">
      <header className="sticky top-0 z-20 w-full border-b border-border bg-card/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src={CHATBOC_ORBIT_AVATAR}
              alt="Chatboc"
              className="h-9 w-9 rounded-full border border-primary/30 bg-primary/20 p-0.5 dark:bg-primary/30"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png";
              }}
            />
            <span className="text-xl font-semibold tracking-tight text-foreground">
              Chatboc <span className="text-lg text-muted-foreground">· Demo</span>
            </span>
          </div>
          {rubroSeleccionado ? (
            <button
              onClick={handleChangeRubro}
              className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary sm:text-sm"
              title="Cambiar rubro"
            >
              Rubro: {rubroSeleccionado} (cambiar)
            </button>
          ) : null}
        </div>
      </header>

      <main className="w-full max-w-6xl flex-1 space-y-5 px-4 py-5 sm:px-6">
        <section className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Demo completa</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                Probá el chat y mirá cómo queda la operación del equipo.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                La consulta, los adjuntos, el seguimiento, el catálogo y el panel trabajan juntos para que un director, municipio o empresa vea el recorrido completo.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-[320px]">
              {["Chat", "Panel", "Historial"].map((label) => (
                <span key={label} className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 font-semibold text-foreground">
                  {label}
                  <small className="mt-1 block text-muted-foreground">
                    {label === "Chat" ? "web" : label === "Panel" ? "admin" : "usuario"}
                  </small>
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0">
            <DemoWorkspace
              tenantSlug={demoTenantSlug}
              sector={sectorSeleccionado}
              rubro={rubroSeleccionado}
              workspace={demoWorkspace}
              onPrefill={(text) => void handleSendMessage(text)}
            />
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <DemoAdminPreview sector={sectorSeleccionado} rubro={rubroSeleccionado} preview={demoAdminPreview} />
            {activeCatalogAsset ? (
              <section className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
                <div className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    <FileText className="h-4 w-4" />
                    Catálogo demo
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{activeCatalogAsset.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {activeCatalogAsset.subtitle || "Material descargable para probar consultas, pedidos y trámites en esta demo."}
                  </p>
                  {activeCatalogAsset.highlights?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeCatalogAsset.highlights.slice(0, 4).map((highlight) => (
                        <span
                          key={highlight}
                          className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="border-t border-border/70 bg-primary/5 p-4 sm:p-5">
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/15 bg-background/80 p-3 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                    <span>El material se prepara al instante para que siempre puedas descargarlo.</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDownloadCatalog()}
                      disabled={isCatalogDownloading}
                      className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isCatalogDownloading ? "Preparando PDF" : "Descargar PDF"}
                    </button>
                    <a
                      href={activeCatalogAsset.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir ficha
                    </a>
                  </div>
                  {catalogDownloadError ? <p className="mt-3 text-xs leading-5 text-destructive">{catalogDownloadError}</p> : null}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Demo;
