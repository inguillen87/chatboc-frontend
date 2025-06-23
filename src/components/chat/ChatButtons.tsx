// src/components/chat/ChatButtons.tsx
import React from 'react';
import { motion } from 'framer-motion';

// Definimos los tipos para los botones y las props
interface Boton {
    texto: string;
    url?: string;
    accion_interna?: string;
    action?: string;
}

interface ChatButtonsProps {
    botones: Boton[];
    onButtonClick: (valueToSend: string) => void;
    onInternalAction?: (action: string) => void;
}

const ChatButtons: React.FC<ChatButtonsProps> = ({
    botones,
    onButtonClick,
    onInternalAction,
}) => {
    const normalize = (v: string) =>
        v.toLowerCase().replace(/[_\s-]+/g, "");

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
        // Nuevos botones pueden traer `action` en lugar de `url` para acciones internas
        if (boton.action) {
            const normalized = normalize(boton.action);
            onInternalAction && onInternalAction(normalized);
            return;
        }

        if (boton.accion_interna) {
            const normalized = normalize(boton.accion_interna);
            onInternalAction && onInternalAction(normalized);
            if (
                !loginActions.includes(normalized) &&
                !registerActions.includes(normalized)
            ) {
                onButtonClick(normalized);
            }
            return;
        }

        if (boton.url) {
            window.open(boton.url, "_blank", "noopener,noreferrer");
            return;
        }

        onButtonClick(boton.texto);
    };

    const baseClass =
        "px-3 py-1.5 text-sm rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-colors duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-75 cursor-pointer";

    return (
        <motion.div
            className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border"
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
                    >
                        {boton.texto}
                    </a>
                ) : (
                    <button
                        key={index}
                        onClick={() => handleButtonClick(boton)}
                        className={baseClass}
                    >
                        {boton.texto}
                    </button>
                )
            )}
        </motion.div>
    );
};

export default ChatButtons;
