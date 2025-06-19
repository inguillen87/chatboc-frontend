import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { motion } from "framer-motion";
import { Button } from '@/components/ui/button'; // Asegúrate de que esta ruta sea correcta
import { MessageCircle, X } from 'lucide-react'; // Asegúrate de que esta ruta sea correcta
import { cn } from '@/lib/utils'; // Asegúrate de que esta ruta sea correcta

const ChatRegisterPanel = React.lazy(() => import("./ChatRegisterPanel"));
import ChatHeader from "./ChatHeader";
const ChatPanel = React.lazy(() => import("./ChatPanel"));

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  // initialPosition solo es relevante si el modo no es "iframe",
  // ya que la posición del iframe la controla widget.js
  initialPosition?: { bottom: number; right: number }; 
  defaultOpen?: boolean;
  widgetId?: string;
  authToken?: string;
  // Estas props ahora traen las dimensiones finales que el iframe padre usará
  openWidth?: string;
  openHeight?: string;
  closedWidth?: string;
  closedHeight?: string;
  tipoChat?: 'pyme' | 'municipio';
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  initialPosition = { bottom: 30, right: 30 }, 
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
  authToken,
  // Usamos los defaults si no vienen por props (aunque deberían venir de widget.js)
  openWidth = "370px", 
  openHeight = "540px",
  closedWidth = "88px", 
  closedHeight = "88px",
  tipoChat = getCurrentTipoChat(),
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [view, setView] = useState<'chat' | 'register'>('chat');

  // Función para notificar al padre (widget.js) sobre el cambio de estado del chat
  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      // Solo envía el mensaje si estamos dentro de un iframe y hay un widgetId
      if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window && widgetId) {
        const dims = open
          ? { width: openWidth, height: openHeight }
          : { width: closedWidth, height: closedHeight };

        window.parent.postMessage(
          { 
            type: "chatboc-state-change", // <-- Este tipo de mensaje es el que widget.js espera
            widgetId: widgetId,
            dimensions: dims,
            isOpen: open 
          },
          "*", // '*' por simplicidad, en producción usa el origen específico del padre por seguridad
        );
      }
    },
    [mode, widgetId, openWidth, openHeight, closedWidth, closedHeight],
  );

  // Efecto para enviar el estado inicial del chat al script padre (widget.js)
  useEffect(() => {
    sendStateMessageToParent(defaultOpen);
  }, [defaultOpen, sendStateMessageToParent]); // Se ejecuta al montar el componente

  // Listener para mensajes entrantes (si el widget.js decide abrir/cerrar desde fuera)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Filtrar mensajes para asegurar que son relevantes y seguros
      // En producción, aquí debería ir el dominio esperado de chatboc.ar para mayor seguridad
      // if (event.origin !== "https://www.chatboc.ar" && !event.origin.startsWith("http://localhost")) return;
      
      // Si el mensaje es para TOGGLE_CHAT (ej. si el widget.js padre lo envía por un click en el iframe)
      if (event.data && event.data.type === "TOGGLE_CHAT" && event.data.widgetId === widgetId) {
        const newIsOpen = event.data.isOpen;
        if (newIsOpen !== isOpen) { // Evita bucles infinitos si el estado no cambia
          setIsOpen(newIsOpen);
          // Ya sendStateMessageToParent se llama en el useEffect de isOpen.
          // Si cambias el estado aquí, el useEffect para isOpen se encargará de notificar al padre.
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [widgetId, isOpen]); // Depende de isOpen para evitar que el listener se quede con un closure viejo

  const toggleChat = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    // sendStateMessageToParent(newState); // Ya se llama desde el useEffect de `isOpen`
  };

  // El `div` raíz de ChatWidget debe ocupar el 100% del iframe y ser el contenedor relativo para sus hijos.
  return (
    <div
      className={cn(
        "relative w-full h-full", // Ocupa el 100% del iframe y es el contenedor relativo
        "flex flex-col items-end justify-end", // Alinea el botón/panel a la esquina inferior derecha
      )}
    >
      <Suspense fallback={null}>
        {/* Panel del chat, se posiciona de forma absoluta dentro del div raíz de ChatWidget */}
        <motion.div
          className={cn(
            "chatboc-panel-wrapper", // Clase personalizada para estilos
            "absolute bottom-0 right-0", // Posicionado en la esquina inferior derecha del ChatWidget (que es 100% del iframe)
            "w-full h-full", // Ocupa todo el ancho y alto del iframe cuando está abierto
            "bg-card border shadow-2xl rounded-lg", // Estilos de fondo, borde, sombra
            "flex flex-col overflow-hidden", // IMPORTANTE: Oculta el desbordamiento del contenido del panel
            "transform transition-all duration-300 ease-in-out",
            isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
          )}
          initial={{ opacity: 0, scale: 0.9, y: 20 }} // Animación inicial (Framer Motion)
          animate={isOpen ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          style={{
            // Estas dimensiones aseguran que el panel del ChatWidget intenta llenar el iframe
            width: openWidth, // Usa la prop de ancho abierto
            height: openHeight, // Usa la prop de alto abierto
            borderRadius: "16px", // Mantener el borde del panel del chat
          }}
        >
          {isOpen && ( // Renderiza el contenido del panel solo si está abierto
            <>
              <ChatHeader onClose={toggleChat} /> {/* Pasa la función para cerrar */}
              {view === 'register' ? (
                <ChatRegisterPanel onSuccess={() => setView('chat')} />
              ) : (
                <ChatPanel
                  mode={mode}
                  widgetId={widgetId}
                  authToken={authToken}
                  // Pasa las dimensiones reales al ChatPanel si las necesita para su layout interno
                  openWidth={openWidth} 
                  openHeight={openHeight}
                  onClose={toggleChat}
                  tipoChat={tipoChat}
                  onRequireAuth={() => setView('register')}
                />
              )}
            </>
          )}
        </motion.div>

        {/* Botón flotante para abrir/cerrar el chat */}
        {/* Este botón SIEMPRE está dentro del iframe. Su visibilidad es controlada por 'isOpen' */}
        <Button
          className={cn(
            "chatboc-toggle-button", // Clase personalizada para el botón
            "absolute bottom-0 right-0", // Posicionado en la esquina inferior derecha del ChatWidget (que es 100% del iframe)
            "rounded-full", // Forma circular
            "flex items-center justify-center",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "shadow-lg",
            "transition-all duration-300 ease-in-out",
            isOpen ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100 pointer-events-auto"
          )}
          onClick={toggleChat}
          aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
          style={{
             width: closedWidth, // Usa la prop de ancho cerrado para el botón
             height: closedHeight, // Usa la prop de alto cerrado para el botón
             background: 'var(--primary)' // Color de fondo del botón
          }}
        >
          {/* Si el chat está abierto, muestra la 'X', si no, el logo/icono de chat */}
          {isOpen ? <X className="h-8 w-8" /> : <MessageCircle className="h-8 w-8" />}
          {/* El logo animado solo se muestra si el chat está cerrado y es el botón */}
          {!isOpen && <ChatbocLogoAnimated size={parseInt(closedWidth, 10) * 0.7} />} 
        </Button>
      </Suspense>
    </div>
  );
};

export default ChatWidget;