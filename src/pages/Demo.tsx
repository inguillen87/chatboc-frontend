import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Download, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { resetChatSessionId } from "@/utils/chatSessionId";
import getOrCreateAnonId from "@/utils/anonId";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ChatMessage from "@/components/chat/ChatMessage";
import RubroSelector from "@/components/chat/RubroSelector";
import type { Rubro } from "@/types/rubro";
import type { ChatMediaCapabilities, Message, SendPayload } from "@/types/chat";
import { apiFetch } from "@/utils/api";
import { getCurrentTipoChat, enforceTipoChatForRubro, parseRubro } from "@/utils/tipoChat";
import { getAskEndpoint, esRubroPublico } from "@/utils/chatEndpoints";
import { extractRubroKey, extractRubroLabel } from "@/utils/rubros";
import { extractButtonsFromResponse } from "@/utils/chatButtons";
import DemoWorkspace from '@/features/demo/DemoWorkspace';
import DemoSectorStep from '@/features/demo/DemoSectorStep';
import { createDemoSession, createLocalDemoSession, getDemoCatalog } from '@/features/demo/demoApi';
import type { DemoCatalogResponse, DemoChatBootstrap, DemoSector, DemoSectorGroup, DemoWorkspaceConfig } from '@/features/demo/demoTypes';
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
  const lines = [
    'La demo quedo activa en modo guiado.',
    text.trim() ? `Recibi tu consulta: "${text.trim()}".` : null,
    sectorLabel ? `Recorrido seleccionado: ${sectorLabel}.` : null,
    'Podés seguir probando consultas, pedidos, trámites, derivaciones o adjuntos desde esta misma pantalla.',
    catalogTitle ? `También dejé disponible el catálogo demo "${catalogTitle}" para descargar y consultar.` : null,
  ];

  return lines.filter(Boolean).join('\n');
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
  const [useLocalDemoRuntime, setUseLocalDemoRuntime] = useState(false);
  const [catalogDownloadError, setCatalogDownloadError] = useState<string | null>(null);
  const [isCatalogDownloading, setIsCatalogDownloading] = useState(false);
  const [contexto, setContexto] = useState({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef<string | null>(null);
  const initialDemoLoadRef = useRef(false);
  const hydratedSessionRef = useRef(false);

  const rubroClave = rubroClaveSeleccionado || extractRubroKey(rubroSeleccionado);
  const rubroNormalizado = parseRubro(rubroClave);
  const isMunicipioRubro = esRubroPublico(rubroNormalizado || undefined);

  const guidedActions = useMemo(() => {
    const lastBotMessage = [...messages].reverse().find((message) => message.isBot && Array.isArray(message.botones) && message.botones.length > 0);
    return lastBotMessage?.botones ?? [];
  }, [messages]);
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
  const demoMediaCapabilities = useMemo(
    () => mergeBootstrapSupportsWithMediaCapabilities(demoWorkspace?.media_capabilities ?? null, activeChatBootstrap?.supports),
    [activeChatBootstrap?.supports, demoWorkspace?.media_capabilities],
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

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
    // Use background from index.css for consistency with theme light/dark
    <div className="flex flex-col items-center w-full min-h-screen bg-background text-foreground">
      {/* HEADER */}
      {/* Applying a more modern header style */}
      <header className="w-full bg-card/80 backdrop-blur-md shadow-sm sticky top-0 z-20 border-b border-border">
        <div className="max-w-3xl mx-auto py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={CHATBOC_ORBIT_AVATAR}
              alt="Chatboc"
              className="w-9 h-9 rounded-full p-0.5 bg-primary/20 dark:bg-primary/30 border border-primary/30"
              onError={(e) => { (e.target as HTMLImageElement).src = "/favicon/favicon-48x48.png"; }}
            />
            <span className="font-semibold text-xl tracking-tight text-foreground">
              Chatboc <span className="text-muted-foreground text-lg">· Demo</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            {rubroSeleccionado && (
              <button
                onClick={handleChangeRubro}
                className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                title="Cambiar rubro"
              >
                Rubro: {rubroSeleccionado} (cambiar)
              </button>
            )}
            {/* Removing Cart icon as it might not be relevant for all demos or could be confusing */}
            {/* <button
              onClick={openCart}
              aria-label="Ver carrito"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <ShoppingCart size={22} />
            </button> */}
          </div>
        </div>
      </header>

      {/* CHAT AREA */}
      {/* Increased max-w for chat content area for better desktop view, maintains padding */}
      <main className="w-full max-w-3xl flex flex-col flex-1 px-4 sm:px-6 py-5 space-y-4 overflow-y-auto custom-scroll">
        <DemoWorkspace tenantSlug={demoTenantSlug} sector={sectorSeleccionado} rubro={rubroSeleccionado} workspace={demoWorkspace} onPrefill={(text) => void handleSendMessage(text)} />
        {activeCatalogAsset ? (
          <section className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
            <div className="grid gap-0 md:grid-cols-[1fr_0.72fr]">
              <div className="p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  <FileText className="h-4 w-4" />
                  Catálogo demo
                </div>
                <h3 className="text-lg font-semibold text-foreground">{activeCatalogAsset.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {activeCatalogAsset.subtitle || 'Material descargable para probar consultas, pedidos y trámites en esta demo.'}
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
              <div className="border-t border-border/70 bg-primary/5 p-4 sm:p-5 md:border-l md:border-t-0">
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/15 bg-background/80 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                  <span>El material se prepara al instante para que siempre puedas descargarlo.</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                  <button
                    type="button"
                    onClick={() => void handleDownloadCatalog()}
                    disabled={isCatalogDownloading}
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isCatalogDownloading ? 'Preparando PDF' : 'Descargar PDF'}
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
                {catalogDownloadError ? (
                  <p className="mt-3 text-xs leading-5 text-destructive">{catalogDownloadError}</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isTyping={isTyping}
            onButtonClick={handleSendMessage}
            tipoChat={isMunicipioRubro ? "municipio" : "pyme"}
            query={msg.query}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </main>

      {/* INPUT AREA */}
      {/* Consistent padding and background, sticky to bottom */}
      <footer className="w-full bg-card/80 backdrop-blur-md border-t border-border p-3 sm:p-4 sticky bottom-0 z-10">
        <div className="max-w-3xl mx-auto">
          {guidedActions.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-2">
              <span className="text-xs text-muted-foreground">¿Sobre qué te gustaría preguntar?</span>
              {guidedActions.slice(0, 4).map((action, index) => (
                <button
                  key={`${action.texto}-${index}`}
                  type="button"
                  className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary transition hover:bg-primary/20"
                  onClick={() => {
                    if (action.url) {
                      window.open(action.url, '_blank', 'noopener,noreferrer');
                      return;
                    }
                    void handleSendMessage({
                      text: action.texto,
                      action: action.action ?? action.action_id ?? action.accion_interna,
                    });
                  }}
                >
                  {action.texto}
                </button>
              ))}
            </div>
          ) : null}
          <ChatInput
            onSendMessage={handleSendMessage}
            isTyping={isTyping}
            mediaCapabilities={demoMediaCapabilities}
          />
           <p className="text-center text-xs text-muted-foreground pt-2">
            Chatboc Demo &copy; {new Date().getFullYear()}.
            {preguntasUsadas >= MAX_PREGUNTAS
              ? <span className="text-destructive-foreground"> Límite de mensajes alcanzado.</span>
              : ` ${MAX_PREGUNTAS - preguntasUsadas} mensajes restantes.`
            }
          </p>
        </div>
      </footer>
    </div>
  );
};

const mergeBootstrapSupportsWithMediaCapabilities = (
  mediaCapabilities: ChatMediaCapabilities | null,
  supports?: Record<string, boolean>,
): ChatMediaCapabilities | null => {
  if (!supports) return mediaCapabilities;

  const inputModes = { ...(mediaCapabilities?.input_modes ?? {}) };
  ['text', 'image', 'audio', 'location', 'file'].forEach((mode) => {
    if (typeof supports[mode] !== 'boolean') return;
    inputModes[mode] = {
      ...(inputModes[mode] ?? {}),
      enabled: supports[mode],
    };
  });

  return {
    ...(mediaCapabilities ?? { version: 'demo.chat_bootstrap.supports.v1' }),
    input_modes: inputModes,
  };
};

export default Demo;
