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

const ChatButtons: React.FC<ChatButtonsProps> = ({ botones, onButtonClick, onInternalAction }) => {

    const loginActions = ['login', 'loginpanel', 'chatuserloginpanel'];
    const registerActions = ['register', 'registerpanel', 'chatuserregisterpanel'];

    const handleButtonClick = (boton: Boton) => {
        // Los nuevos botones de login/register vienen con `action` en lugar de URL.
        // Cuando existe esta propiedad disparamos la acción interna y no
        // reenviamos el texto al backend.
        if (boton.action) {
            const normalized = boton.action.trim().toLowerCase();
            onInternalAction && onInternalAction(normalized);
            return;
        }
        if (boton.accion_interna) {
            const normalized = boton.accion_interna.trim().toLowerCase();
            onInternalAction && onInternalAction(normalized);
            if (!loginActions.includes(normalized) && !registerActions.includes(normalized)) {
                onButtonClick(normalized);
            }
        } else if (boton.url) {
            window.open(boton.url, '_blank', 'noopener,noreferrer');
        } else {
            onButtonClick(boton.texto);
        }
    };

    return (
        <motion.div
            className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
        >
            {botones.map((boton, index) => (
                <button
                    key={index}
                    onClick={() => handleButtonClick(boton)}
                    className="
                        px-3 py-1.5 text-sm rounded-full
                        bg-primary text-primary-foreground
                        hover:bg-primary/90
                        font-semibold transition-colors duration-200
                        shadow-md hover:shadow-lg focus:outline-none
                        focus:ring-2 focus:ring-primary focus:ring-opacity-75
                        cursor-pointer
                    "
                >
                    {boton.texto}
                </button>
            ))}
        </motion.div>
    );
};

export default ChatButtons;
