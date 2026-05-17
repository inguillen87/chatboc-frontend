// src/components/chat/ChatButtons.tsx
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Boton, SendPayload } from '@/types/chat';
import { openExternalLink } from '@/utils/openExternalLink';
import { useTenant } from '@/context/TenantContext';
import { buildTenantAwareUrl } from '@/utils/tenantUrls';
import { isDemoCatalogResourceUrl, normalizeDemoResourceUrl } from '@/utils/demoResourceUrls';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatButtonsProps {
  botones: Boton[];
  onButtonClick: (payload: SendPayload) => void;
  onInternalAction?: (action: string) => void;
  isDemoSelector?: boolean;
  maxVisible?: number;
  collapseExtra?: boolean;
  moreLabel?: string;
}

const endpointPathname = (endpoint?: string | null) => {
  const trimmed = endpoint?.trim();
  if (!trimmed) return "";
  try {
    const base = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost";
    return new URL(trimmed, base).pathname.toLowerCase();
  } catch {
    return trimmed.startsWith("/") ? trimmed.toLowerCase() : "";
  }
};

const isApiNavigationEndpoint = (endpoint?: string | null) => {
  if (isDemoCatalogResourceUrl(endpoint)) return false;
  const pathname = endpointPathname(endpoint);
  return pathname.startsWith("/api/") || /^\/v\d+\//.test(pathname);
};

const ChatButtons: React.FC<ChatButtonsProps> = ({
  botones,
  onButtonClick,
  onInternalAction,
  isDemoSelector = false,
  maxVisible,
  collapseExtra = false,
  moreLabel = "Mas",
}) => {
  const { currentSlug } = useTenant();
  const isMobile = useIsMobile();
  const [showAll, setShowAll] = useState(false);

  const resolveUrl = useMemo(
    () => (url?: string) => {
      const normalized = normalizeDemoResourceUrl(url);
      if (!normalized) return undefined;
      return isDemoCatalogResourceUrl(normalized)
        ? normalized
        : buildTenantAwareUrl(normalized, currentSlug);
    },
    [currentSlug],
  );

  const normalize = (value: string) =>
    value.toLowerCase().replace(/[\s_-]+/g, "");

  const filteredButtons = botones.filter((boton) => {
    const actionToUse = boton.action || boton.action_id;
    const normalizedAction = actionToUse ? normalize(actionToUse) : null;
    const normalizedInternal = boton.accion_interna ? normalize(boton.accion_interna) : null;
    const normalizedLabel = normalize(String(boton?.texto || ""));

    const isUnsupportedAuction = normalizedAction === "subastas" || normalizedInternal === "subastas";
    if (isUnsupportedAuction) return false;

    const isTopChipLabel = ["widget", "whatsapp", "voice"].includes(normalizedLabel);
    const hasValidAction = Boolean(actionToUse || boton.accion_interna || boton.url || boton.payload);
    if (isTopChipLabel && !hasValidAction) return false;

    return true;
  });

  const normalizedMaxVisible =
    typeof maxVisible === "number" && Number.isFinite(maxVisible) && maxVisible > 0
      ? Math.floor(maxVisible)
      : 0;
  const effectiveMaxVisible = isMobile
    ? Math.min(normalizedMaxVisible || 2, 2)
    : normalizedMaxVisible;
  const shouldCollapse =
    (collapseExtra || isMobile) && effectiveMaxVisible > 0 && filteredButtons.length > effectiveMaxVisible;
  const visibleButtons =
    shouldCollapse && !showAll
      ? filteredButtons.slice(0, effectiveMaxVisible)
      : filteredButtons;
  const hiddenCount = shouldCollapse ? filteredButtons.length - effectiveMaxVisible : 0;

  const formatButtonLabel = (label: string) => {
    const trimmed = label?.trim?.() || '';
    if (!trimmed) return '';
    const max = isMobile ? 28 : 44;
    return trimmed.length > max ? `${trimmed.slice(0, Math.max(0, max - 3))}...` : trimmed;
  };

  const loginActions = [
    "login",
    "loginpanel",
    "chatuserloginpanel",
  ].map(normalize);
  const registerActions = [
    "register",
    "registerpanel",
    "chatuserregisterpanel",
  ].map(normalize);

  const handleButtonClick = (boton: Boton) => {
    const actionToUse = boton.action || boton.action_id;
    const normalizedAction = actionToUse ? normalize(actionToUse) : null;
    const accionInterna = boton.accion_interna;
    const normalizedAccionInterna = accionInterna ? normalize(accionInterna) : null;

    if (normalizedAction && (loginActions.includes(normalizedAction) || registerActions.includes(normalizedAction))) {
      onInternalAction?.(normalizedAction);
      return;
    }

    if (normalizedAccionInterna && (loginActions.includes(normalizedAccionInterna) || registerActions.includes(normalizedAccionInterna))) {
      onInternalAction?.(normalizedAccionInterna);
      return;
    }

    if (actionToUse) {
      const actionId = boton.action_id || boton.action || boton.accion_interna || undefined;
      onButtonClick({
        text: boton.texto,
        action: actionToUse,
        action_id: actionId,
        payload: boton.payload,
        source: 'button',
      });
      return;
    }

    if (accionInterna) {
      onButtonClick({ text: boton.texto, action: accionInterna, source: 'button' });
      onInternalAction?.(accionInterna);
      return;
    }

    const resolvedUrl = boton.url ? resolveUrl(boton.url) : undefined;

    if (resolvedUrl && !isApiNavigationEndpoint(resolvedUrl)) {
      openExternalLink(resolvedUrl);
      return;
    }

    onButtonClick({
      text: boton.texto,
      payload: {
        ...(boton.payload ?? {}),
        endpoint: boton.url ?? undefined,
      },
      source: 'button',
    });
  };

  const baseClass = isDemoSelector
    ? "w-full min-h-11 rounded-xl px-3 py-2 text-left font-semibold bg-white text-blue-800 border border-blue-200 hover:bg-blue-50 hover:shadow transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    : "min-h-10 rounded-xl px-3 py-1.5 text-sm font-semibold bg-white text-blue-800 border border-blue-200 hover:bg-blue-50 hover:shadow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

  const containerClass = isDemoSelector
    ? "grid grid-cols-1 gap-2 mt-3 w-full"
    : "flex flex-wrap gap-2 mt-3";

  return (
    <motion.div
      className={containerClass}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.3 }}
    >
      {visibleButtons.map((boton, index) =>
        boton.url && !isApiNavigationEndpoint(boton.url) ? (
          <a
            key={index}
            href={resolveUrl(boton.url)}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            onClick={(event) => {
              event.preventDefault();
              const resolvedUrl = resolveUrl(boton.url);
              if (resolvedUrl) {
                openExternalLink(resolvedUrl);
              }
            }}
            className={`${baseClass} no-underline inline-flex items-center justify-center`}
            style={!isDemoSelector ? { maxWidth: 180 } : { maxWidth: "100%" }}
            title={formatButtonLabel(boton.texto)}
            aria-label={`Abrir opcion: ${boton.texto}`}
          >
            {formatButtonLabel(boton.texto)}
          </a>
        ) : (
          <button
            key={index}
            type="button"
            onClick={() => handleButtonClick(boton)}
            className={baseClass}
            style={!isDemoSelector ? { maxWidth: 180 } : { maxWidth: "100%" }}
            title={formatButtonLabel(boton.texto)}
            aria-label={`Enviar opcion: ${boton.texto}`}
          >
            {formatButtonLabel(boton.texto)}
          </button>
        )
      )}
      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className={baseClass}
          style={!isDemoSelector ? { maxWidth: 180 } : { maxWidth: "100%" }}
          aria-expanded={showAll}
          aria-label={showAll ? "Mostrar menos opciones" : `Mostrar ${hiddenCount} opciones mas`}
          title={showAll ? "Mostrar menos" : `${moreLabel} (${hiddenCount})`}
        >
          {showAll ? "Mostrar menos" : `${moreLabel} +${hiddenCount}`}
        </button>
      ) : null}
    </motion.div>
  );
};

export default ChatButtons;
