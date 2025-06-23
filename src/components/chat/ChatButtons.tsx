// src/components/chat/ChatButtons.tsx
import React from 'react';
import { motion } from 'framer-motion';

// Definimos los tipos para los botones y las props
interface Boton {
    texto: string;
    url?: string;
    accion_interna?: string;
}

interface ChatButtonsProps {
    botones: Boton[];
    onButtonClick: (valueToSend: string) => void;
    onInternalAction?: (action: string) => void;
}

const ChatButtons: React.FC<ChatButtonsProps> = ({ botones, onButtonClick, onInternalAction }) => {

    const handleInternal = (accion: string) => {
        const normalized = accion.trim().toLowerCase();
        onInternalAction && onInternalAction(normalized);
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
                boton.accion_interna ? (
                    <button
                        key={index}
                        onClick={() => handleInternal(boton.accion_interna!)}
                        className={baseClass}
                    >
                        {boton.texto}
                    </button>
                ) : boton.url ? (
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
                        onClick={() => onButtonClick(boton.texto)}
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
