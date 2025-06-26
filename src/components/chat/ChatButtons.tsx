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
    onButtonClick: (payload: { text: string; action?: string; }) => void; // <-- MODIFICADO
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
        // PRIORIDAD: 1. `action` nuevo, 2. `accion_interna` viejo, 3. `url`, 4. `texto`
        if (boton.action) {
            onButtonClick({ text: boton.texto, action: boton.action }); // <-- MODIFICADO: Envía texto Y acción
            onInternalAction && onInternalAction(normalize(boton.action)); // Para acciones internas del frontend
            return;
        }

        if (boton.accion_interna) {
            const normalizedAccion = normalize(boton.accion_interna);
            // Si es una acción interna que NO es login/register, envíala como acción al backend
            if (!loginActions.includes(normalizedAccion) && !registerActions.includes(normalizedAccion)) {
                onButtonClick({ text: boton.texto, action: normalizedAccion }); // <-- MODIFICADO: Envía texto Y acción
            }
            onInternalAction && onInternalAction(normalizedAccion); // Para manejo del frontend (cambio de panel, etc.)
            return;
        }

        if (boton.url) {
            window.open(boton.url, "_blank", "noopener,noreferrer");
            return;
        }

        // Si es solo texto (como una categoría de reclamo), envíalo como texto normal
        onButtonClick({ text: boton.texto }); // <-- MODIFICADO: Envía un objeto con solo texto
    };

    const baseClass =
        "rounded-2xl px-4 py-2 font-semibold bg-white text-blue-800 border border-blue-200 hover:bg-blue-50 hover:shadow transition-all";

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