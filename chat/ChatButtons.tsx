// src/components/chat/ChatButtons.tsx
import React from 'react';
import { motion } from 'framer-motion';

// Definimos los tipos para los botones y las props
interface Boton {
    texto: string;
    url?: string;
    accion_interna?: string; // Usado por el backend para acciones pre-existentes
    action?: string; // Nuevo campo para acciones de botones más generales
}

interface ChatButtonsProps {
    botones: Boton[];
    // onButtonClick ahora puede enviar un payload estructurado
    onButtonClick: (payload: { text: string; action?: string; }) => void;
    onInternalAction?: (action: string) => void;
}

const ChatButtons: React.FC<ChatButtonsProps> = ({
    botones,
    onButtonClick,
    onInternalAction,
}) => {
    const normalize = (v: string) =>
        v.toLowerCase().replace(/[\s_-]+/g, "");

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
        const normalizedAction = boton.action ? normalize(boton.action) : null;
        const normalizedAccionInterna = boton.accion_interna ? normalize(boton.accion_interna) : null;

        // Priority 1: Handle internal auth actions (login/register) first and exclusively.
        if (normalizedAction && (loginActions.includes(normalizedAction) || registerActions.includes(normalizedAction))) {
            if (onInternalAction) {
                onInternalAction(normalizedAction);
            }
            return; // Stop further processing for these auth actions
        }
        if (normalizedAccionInterna && (loginActions.includes(normalizedAccionInterna) || registerActions.includes(normalizedAccionInterna))) {
            if (onInternalAction) {
                onInternalAction(normalizedAccionInterna);
            }
            return; // Stop further processing for these auth actions
        }

        // Priority 2: Handle other `boton.action` (non-auth internal actions or backend actions)
        if (normalizedAction) { // Will be non-auth at this point
            // Send to backend. The payload includes the action.
            onButtonClick({ text: boton.texto, action: normalizedAction });
            // If this non-auth action ALSO has a specific frontend internal behavior, trigger it.
            // (e.g., action 'open_cart_details' might be a backend query + frontend UI update)
            if (onInternalAction) {
                // This ensures that if an action is primarily for the backend but also has a UI side-effect,
                // the internal handler is still called.
                onInternalAction(normalizedAction);
            }
            return;
        }

        // Priority 3: Handle other `boton.accion_interna` (non-auth internal actions or backend actions)
        if (normalizedAccionInterna) { // Will be non-auth at this point
            // Send to backend. The payload includes the action.
            onButtonClick({ text: boton.texto, action: normalizedAccionInterna });
            // Similar to above, handle potential UI side-effects for these actions too.
            if (onInternalAction) {
                onInternalAction(normalizedAccionInterna);
            }
            return;
        }

        // Priority 4: Handle URL navigation
        if (boton.url) {
            window.open(boton.url, "_blank", "noopener,noreferrer");
            return;
        }

        // Priority 5: Default - send button text as a simple message to backend
        onButtonClick({ text: boton.texto });
    };

    const baseClass =
        "rounded-xl px-3 py-1 text-sm font-semibold bg-white text-blue-800 border border-blue-200 hover:bg-blue-50 hover:shadow transition-all";

    return (
        <motion.div
            className="flex flex-wrap gap-2 mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
        >
            {botones.map((boton, index) =>
                boton.url ? (
                    <a
                        key={index}
                        href={boton.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={baseClass + " no-underline inline-flex items-center justify-center"}
                        style={{ maxWidth: 180 }}
                        title={boton.texto}
                    >
                        {boton.texto}
                    </a>
                ) : (
                    <button
                        key={index}
                        onClick={() => handleButtonClick(boton)}
                        className={baseClass}
                        style={{ maxWidth: 180 }}
                        title={boton.texto}
                    >
                        {boton.texto}
                    </button>
                )
            )}
        </motion.div>
    );
};

export default ChatButtons;