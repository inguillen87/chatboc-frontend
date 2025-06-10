import React from "react";
import { Message } from "@/types/chat";
import { motion } from "framer-motion";
import ChatButtons from "./ChatButtons";

const LOGO_BOT = "/favicon/favicon-48x48.png"; // Ruta para el avatar estático del bot

// --- Componente AvatarBot (se puede mover a un archivo separado como AvatarBot.tsx) ---
interface AvatarBotProps {
    isTyping: boolean; // Indica si el bot está "escribiendo"
}

const AvatarBot: React.FC<AvatarBotProps> = ({ isTyping }) => {
    // Si tienes un GIF animado para la boca que se mueve, puedes usarlo aquí.
    // Ejemplo: const AVATAR_TALKING_GIF = "/path/to/tu_avatar_hablando.gif";
    const AVATAR_TALKING_GIF = null; // Por ahora, lo dejamos en null si no tienes un GIF específico

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className={`
                flex-shrink-0 w-10 h-10 rounded-full bg-card flex items-center justify-center 
                border-2 transition-all duration-200 ease-in-out
                ${isTyping 
                    ? "border-blue-500 shadow-lg shadow-blue-500/50 scale-105" // Borde y sombra azul, y pequeña escala cuando está escribiendo
                    : "border-border shadow-sm"}
            `}
        >
            <img 
                src={isTyping && AVATAR_TALKING_GIF ? AVATAR_TALKING_GIF : LOGO_BOT} // Usa el GIF si existe y está escribiendo, de lo contrario la imagen estática
                alt="Chatboc" 
                className={`w-7 h-7 object-contain ${isTyping && !AVATAR_TALKING_GIF ? "animate-pulse-subtle" : ""}`} // Animación de pulso si no hay GIF
            />
        </motion.div>
    );
};

// --- Componente UserAvatar (sin cambios funcionales, solo por completitud) ---
const UserAvatar = () => (
    <motion.span
        className="flex-shrink-0 w-9 h-9 rounded-full bg-secondary flex items-center justify-center border border-border shadow-md dark:border-blue-700"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
        <span className="text-2xl font-bold text-primary dark:text-blue-100">🧑‍💼</span>
    </motion.span>
);

// --- Componente ChatMessage ---
interface ChatMessageProps {
    message: Message;
    isTyping: boolean; // <-- IMPORANTE: Esta prop es nueva y viene de ChatPage
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isTyping }) => {
    if (!message || typeof message.text !== "string") {
        return (
            <div className="text-xs text-destructive italic mt-2 px-3">
                ❌ Mensaje inválido o malformado.
            </div>
        );
    }

    // Lógica de botones CTA (sin cambios, ya que no es el foco de la mejora visual)
    if (message.text === "__cta__") {
        const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "null") : null;
        if (user?.token) return null;
        return (
            <div className="flex justify-center mt-4">
                <div className="text-center space-y-2">
                    <button
                        onClick={() => (window.location.href = "/demo")}
                        className="px-4 py-2 text-base bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow transition font-semibold"
                    >
                        Usar Chatboc en mi empresa
                    </button>
                    <button
                        onClick={() =>
                            window.open(
                                "https://wa.me/5492613168608?text=Hola! Estoy probando Chatboc y quiero implementarlo en mi empresa.",
                                "_blank"
                            )
                        }
                        className="px-4 py-2 text-base border border-primary text-primary bg-background rounded-full hover:bg-primary/5 dark:hover:bg-primary/20 transition font-semibold"
                    >
                        Hablar por WhatsApp
                    </button>
                </div>
            </div>
        );
    }

    const isBot = message.isBot;
    
    // Variantes para animación de entrada de la burbuja
    const bubbleVariants = {
        hidden: { opacity: 0, y: 10, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1 },
    };

    return (
        <div
            className={`flex items-end gap-2.5 ${isBot ? "justify-start" : "justify-end"}`}
        >
            {isBot && (
                // Aquí usamos el componente AvatarBot, pasándole el estado de escritura
                <AvatarBot isTyping={isTyping} />
            )}

            <div className="flex flex-col">
                <motion.div
                    className={`
                        px-4 py-3 max-w-[320px] shadow-md relative
                        ${isBot
                            ? "bg-muted text-foreground rounded-b-2xl rounded-tr-2xl dark:bg-[#333a4d] dark:text-gray-100" // Bot: Esquina superior izquierda redondeada
                            : "bg-primary text-primary-foreground rounded-b-2xl rounded-tl-2xl dark:bg-blue-600 dark:text-white" // Usuario: Esquina superior derecha redondeada
                        }
                        break-words // Asegura que el texto largo se ajuste
                        // Añadimos una cola a la burbuja con pseudo-elementos
                        after:content-[''] after:absolute after:bottom-0 
                        ${isBot 
                            ? "after:left-[-8px] after:w-0 after:h-0 after:border-8 after:border-transparent after:border-t-muted after:border-r-muted dark:after:border-t-[#333a4d] dark:after:border-r-[#333a4d]" 
                            : "after:right-[-8px] after:w-0 after:h-0 after:border-8 after:border-transparent after:border-t-primary after:border-l-primary dark:after:border-t-blue-600 dark:after:border-l-blue-600"}
                    `}
                    variants={bubbleVariants}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    initial="hidden"
                    animate="visible"
                >
                    <div
                        className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0"
                        dangerouslySetInnerHTML={{ __html: message.text }}
                    />
                </motion.div>

                {/* --- LÓGICA PARA MOSTRAR BOTONES DINÁMICOS --- */}
                {message.isBot && message.botones && message.botones.length > 0 && (
                    <ChatButtons botones={message.botones} />
                )}
            </div>

            {!isBot && <UserAvatar />}
        </div>
    );
};

export default ChatMessage;