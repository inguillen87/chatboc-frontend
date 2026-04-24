// src/components/chat/ChatButtons.tsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Boton, SendPayload } from '@/types/chat';
import { openExternalLink } from '@/utils/openExternalLink';
import { useTenant } from '@/context/TenantContext';
import { buildTenantAwareUrl } from '@/utils/tenantUrls';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatButtonsProps {
    botones: Boton[];
    // onButtonClick ahora puede enviar un payload estructurado
    onButtonClick: (payload: SendPayload) => void;
    onInternalAction?: (action: string) => void;
    isDemoSelector?: boolean;
}

const ChatButtons: React.FC<ChatButtonsProps> = ({
    botones,
    onButtonClick,
    onInternalAction,
    isDemoSelector = false,
}) => {
    const { currentSlug } = useTenant();
    const isMobile = useIsMobile();

    const resolveUrl = useMemo(
        () => (url?: string) => (url ? buildTenantAwareUrl(url, currentSlug) : undefined),
        [currentSlug],
    );

    const normalize = (v: string) =>
        v.toLowerCase().replace(/[\s_-]+/g, "");

    // Filter out unsupported "subastas" actions so they are not rendered or dispatched.
    const filteredButtons = botones.filter(boton => {
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

    const buttonsToRender = filteredButtons;


    const formatButtonLabel = (label: string) => {
        const trimmed = label?.trim?.() || '';
        if (!trimmed) return '';
        const max = isMobile ? 28 : 44;
        return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
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

        // Priority 1: Handle internal auth actions (login/register) first and exclusively.
        if (normalizedAction && (loginActions.includes(normalizedAction) || registerActions.includes(normalizedAction))) {
            onInternalAction?.(normalizedAction);
            return; // Stop further processing for these auth actions
        }
        if (normalizedAccionInterna && (loginActions.includes(normalizedAccionInterna) || registerActions.includes(normalizedAccionInterna))) {
            onInternalAction?.(normalizedAccionInterna);
            return; // Stop further processing for these auth actions
        }

        const isBackendOnlyAction = (actionStr: string | null) => {
            if (!actionStr) return false;
            const str = actionStr.toLowerCase();
            return str.startsWith("demo_segment:") ||
                   str.startsWith("demo_select_rubro:") ||
                   str.startsWith("demo_menu:");
        };

        // Priority 2: Handle other `boton.action` (non-auth internal actions or backend actions)
        if (actionToUse) { // Will be non-auth at this point
            const actionId = boton.action_id || undefined;
            // Send raw action to backend so it can match exactly.
            onButtonClick({ text: boton.texto, action: actionToUse, action_id: actionId, payload: boton.payload, source: 'button' });
            // Trigger potential frontend side-effects for this action, unless it's strictly backend.
            if (!isBackendOnlyAction(actionToUse)) {
                onInternalAction?.(actionToUse);
            }
            return;
        }

        // Priority 3: Handle other `boton.accion_interna` (non-auth internal actions or backend actions)
        if (accionInterna) { // Will be non-auth at this point
            // Send raw internal action to backend.
            onButtonClick({ text: boton.texto, action: accionInterna, source: 'button' });
            // Handle potential UI side-effects for these actions too.
            if (!isBackendOnlyAction(accionInterna)) {
                onInternalAction?.(accionInterna);
            }
            return;
        }

        const resolvedUrl = boton.url ? resolveUrl(boton.url) : undefined;

        if (resolvedUrl) {
            openExternalLink(resolvedUrl);
            return;
        }

        // Priority 5: Default - send button text along with payload (if any)
        onButtonClick({ text: boton.texto, payload: boton.payload, source: 'button' });
    };

    const baseClass = isDemoSelector
        ? "w-full min-h-11 rounded-xl px-3 py-2 text-left font-semibold bg-white text-blue-800 border border-blue-200 hover:bg-blue-50 hover:shadow transition-all shadow-sm"
        : "rounded-xl px-3 py-1 text-sm font-semibold bg-white text-blue-800 border border-blue-200 hover:bg-blue-50 hover:shadow transition-all";

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
            {buttonsToRender.map((boton, index) =>
                boton.url ? (
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
                        className={baseClass + " no-underline inline-flex items-center justify-center"}
                        style={!isDemoSelector ? { maxWidth: 180 } : { maxWidth: "100%" }}
                        title={formatButtonLabel(boton.texto)}
                    >
                        {formatButtonLabel(boton.texto)}
                    </a>
                ) : (
                    <button
                        key={index}
                        onClick={() => handleButtonClick(boton)}
                        className={baseClass}
                        style={!isDemoSelector ? { maxWidth: 180 } : { maxWidth: "100%" }}
                        title={formatButtonLabel(boton.texto)}
                    >
                        {formatButtonLabel(boton.texto)}
                    </button>
                )
            )}
        </motion.div>
    );
};

export default ChatButtons;
