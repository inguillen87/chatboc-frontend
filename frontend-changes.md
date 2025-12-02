# Frontend Changes for Web Chat Fix

Here are the complete contents of the four frontend files that I have modified. Please replace the content of your local files with the content provided below. This will fix the issues with the web chat.

---

## `src/types/chat.ts`

```typescript
// src/types/chat.ts
export interface AttachmentInfo {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}
// Define cómo es un objeto Boton
export interface Boton {
  texto: string;
  url?: string;
  accion_interna?: string; // Para acciones que el frontend debe interpretar sin enviar al backend (ej. abrir panel)
  action?: string; // Valor que se envía al backend cuando se hace clic en el botón
  action_id?: string; // Compatibilidad con 'action_id' enviado desde algunos endpoints del backend
  payload?: any;
}

// Nuevo: Define la estructura para una categoría de botones
export interface Categoria {
  titulo: string; // Título de la categoría que se mostrará en el acordeón
  botones: Boton[]; // Array de botones dentro de esa categoría
}

// Nuevo: Define la estructura para contenido estructurado dentro de un mensaje
export interface StructuredContentItem {
  label: string; // Etiqueta del dato, ej. "Precio", "Stock"
  value: string | number; // Valor del dato
  type?: 'text' | 'quantity' | 'price' | 'date' | 'url' | 'badge'; // Tipo de dato para formateo/estilo
  unit?: string; // ej. "kg", "unidades", "cajas" (para type 'quantity')
  currency?: string; // ej. "ARS", "USD" (para type 'price')
  url?: string; // Si el valor debe ser un enlace (especialmente si type es 'url')
  styleHint?: 'normal' | 'bold' | 'italic' | 'highlight' | 'success' | 'warning' | 'danger'; // Sugerencia de estilo para el valor
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; // Para type 'badge'
}

// Define cómo es un objeto Mensaje
export interface Message {
  id: number; // Identificador único del mensaje
  text: string; // Texto principal o fallback del mensaje. Puede ser HTML sanitizado.
  isBot: boolean; // True si el mensaje es del bot, false si es del usuario
  timestamp: Date; // Fecha y hora del mensaje
  botones?: Boton[]; // Array de botones interactivos asociados al mensaje (si los hay)
  categorias?: Categoria[]; // Array de categorías con botones (formato anidado para acordeones)
  query?: string; // La consulta original del usuario que generó esta respuesta (opcional)

  // Campos para contenido multimedia y adjuntos
  mediaUrl?: string; // URL directa a una imagen/video (para compatibilidad o casos simples)
  audioUrl?: string; // URL a un archivo de audio para ser reproducido
  locationData?: { // Datos de ubicación (para mostrar un mapa o coordenadas)
    lat: number;
    lon: number;
    name?: string; // Nombre del lugar (ej. "Plaza Independencia")
    address?: string; // Dirección formateada
  };
  attachmentInfo?: { // Información detallada de un archivo adjunto
    name: string; // Nombre del archivo (ej. "documento.pdf")
    url: string; // URL para descargar/visualizar el archivo
    mimeType?: string; // Tipo MIME del archivo (ej. "application/pdf", "image/jpeg")
    size?: number; // Tamaño del archivo en bytes (opcional)
  };

  // Campos para contenido estructurado y personalización de la UI
  structuredContent?: StructuredContentItem[]; // Array de items para mostrar datos clave-valor o tarjetas de información
  displayHint?: 'default' | 'pymeProductCard' | 'municipalInfoSummary' | 'genericTable' | 'compactList'; // Sugerencia para el frontend sobre cómo renderizar la totalidad del mensaje
  chatBubbleStyle?: 'standard' | 'compact' | 'emphasis' | 'alert'; // Para controlar el estilo visual de la burbuja del mensaje
}

// --- INTERFAZ PARA EL PAYLOAD DE ENVÍO DE MENSAJES (lo que el usuario envía al bot) ---
export interface SendPayload {
  text: string; // Texto del mensaje del usuario

  // Para adjuntos que el usuario envía (el backend los procesa y puede devolver un Message con attachmentInfo)
  es_foto?: boolean; // Deprecar en favor de attachmentInfo con mimeType. Indica si el adjunto es una foto.
  archivo_url?: string; // Deprecar en favor de attachmentInfo. URL del archivo subido por el usuario.

  es_ubicacion?: boolean; // True si el payload incluye datos de ubicación del usuario
  ubicacion_usuario?: { lat: number; lon: number; }; // Coordenadas si es_ubicacion es true

  action?: string; // Si el envío es resultado de un clic en un botón con una acción específica que el backend debe procesar
  payload?: any; // Datos adicionales asociados a la acción del botón

  attachmentInfo?: { // Información del archivo que el usuario está adjuntando (antes de que el backend lo confirme)
    name: string;
    url: string; // URL temporal o final del archivo subido por el usuario
    mimeType?: string;
    size?: number;
  };
}
```

---

## `src/hooks/useChatLogic.ts`

```typescript
// src/hooks/useChatLogic.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { Message, SendPayload as TypeSendPayload } from "@/types/chat";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { getAskEndpoint } from "@/utils/chatEndpoints";
import { enforceTipoChatForRubro } from "@/utils/tipoChat";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateAnonId from "@/utils/anonId";
import { v4 as uuidv4 } from 'uuid';
import { MunicipioContext, updateMunicipioContext, getInitialMunicipioContext } from "@/utils/contexto_municipio";

interface UseChatLogicOptions {
  initialWelcomeMessage: string;
  tipoChat: 'pyme' | 'municipio';
}

export function useChatLogic({ initialWelcomeMessage, tipoChat }: UseChatLogicOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contexto, setContexto] = useState<MunicipioContext>(() => getInitialMunicipioContext());
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [currentClaimIdempotencyKey, setCurrentClaimIdempotencyKey] = useState<string | null>(null);

  const token = safeLocalStorage.getItem('authToken');
  const anonId = getOrCreateAnonId();
  const isAnonimo = !token;

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoMensajeIdRef = useRef<number>(0);
  const clientMessageIdCounter = useRef(0);

  const generateClientMessageId = () => {
    clientMessageIdCounter.current += 1;
    return `client-${Date.now()}-${clientMessageIdCounter.current}`;
  };

  const generateWelcomeMessage = (user: any): Message => {
    const welcomeMessageText = isAnonimo
      ? "¡Hola! Soy JuniA, el asistente virtual de la Municipalidad de Junín.\nEstas son las cosas que puedo hacer por vos:"
      : `¡Hola, ${user?.nombre}! Soy JuniA, tu Asistente Virtual. ¿Qué necesitas hoy?`;

    return {
      id: generateClientMessageId(),
      text: welcomeMessageText,
      isBot: true,
      timestamp: new Date(),
      categorias: [
        {
          titulo: "Reclamos y Denuncias",
          botones: [
            { texto: "Hacer un Reclamo", action: "show_reclamos_menu" },
            { texto: "Realizar una Denuncia", action: "hacer_denuncia" },
          ],
        },
        {
          titulo: "Trámites Frecuentes",
          botones: [
            { texto: "Licencia de Conducir", action: "licencia_de_conducir" },
            { texto: "Pago de Tasas", action: "consultar_deudas" },
            { texto: "Defensa del Consumidor", action: "defensa_del_consumidor" },
            { texto: "Veterinaria y Bromatología", action: "veterinaria_y_bromatologia" },
            { texto: "Consultar Multas de Tránsito", action: "consultar_multas" },
          ],
        },
        {
          titulo: "Consultas y Turnos",
          botones: [
              { texto: "Consultar otros trámites", action: "consultar_tramites" },
              { texto: "Solicitar Turnos", action: "solicitar_turnos" },
          ]
        },
        {
          titulo: "Información y Novedades",
          botones: [
            { texto: "Agenda Cultural y Turística", action: "agenda_cultural" },
            { texto: "Últimas Novedades", action: "ver_novedades" },
          ]
        }
      ],
    };
  };

  useEffect(() => {
    if (messages.length === 0) {
      const user = JSON.parse(safeLocalStorage.getItem('user') || 'null');
      const welcomeMessage = generateWelcomeMessage(user);
      setMessages([welcomeMessage]);
    }
  }, [initialWelcomeMessage, isAnonimo]);

  useEffect(() => {
    if (contexto.estado_conversacion === 'confirmando_reclamo' && !activeTicketId) {
      const newKey = uuidv4();
      setCurrentClaimIdempotencyKey(newKey);
      console.log("useChatLogic: Generated idempotency key for claim confirmation:", newKey);
    }
  }, [contexto.estado_conversacion, activeTicketId]);

  useEffect(() => {
    const fetchNewMessages = async () => {
      if (!activeTicketId) return;
      try {
        const data = await apiFetch<{ estado_chat: string; mensajes: any[] }>(
          `/tickets/chat/${activeTicketId}/mensajes?ultimo_mensaje_id=${ultimoMensajeIdRef.current}`,
        );
        if (data.mensajes?.length > 0) {
          const nuevosMensajes: Message[] = data.mensajes.map(msg => ({
            id: msg.id,
            text: msg.texto,
            isBot: msg.es_admin,
            timestamp: new Date(msg.fecha),
            attachmentInfo: msg.attachment_info,
          }));
          setMessages(prev => [...prev, ...nuevosMensajes]);
          ultimoMensajeIdRef.current = data.mensajes[data.mensajes.length - 1].id;
        }
        if (['resuelto', 'cerrado'].includes(data.estado_chat)) {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setMessages(prev => [...prev, { id: generateClientMessageId(), text: "Un agente ha finalizado esta conversación.", isBot: true, timestamp: new Date() }]);
          setCurrentClaimIdempotencyKey(null);
          setContexto(getInitialMunicipioContext());
        }
      } catch (error) {
        console.error("Error durante el polling:", error);
      }
    };

    if (activeTicketId) {
      fetchNewMessages();
      pollingIntervalRef.current = setInterval(fetchNewMessages, 15000);
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [activeTicketId]);

  const handleSend = useCallback(async (payload: string | TypeSendPayload) => {
    const actualPayload: TypeSendPayload = typeof payload === 'string' ? { text: payload.trim() } : { ...payload, text: payload.text?.trim() || "" };
    const { text: userMessageText, attachmentInfo, ubicacion_usuario, action } = actualPayload;
    const actionPayload = 'payload' in actualPayload ? actualPayload.payload : undefined;


    if (!userMessageText && !attachmentInfo && !ubicacion_usuario && !action && !actualPayload.archivo_url) return;
    if (isTyping) return;


    // Only show the user message if it's actual text input, not a button action without text
    if (userMessageText && !action) {
      const userMessage: Message = {
        id: generateClientMessageId(),
        text: userMessageText,
        isBot: false,
        timestamp: new Date(),
        attachmentInfo,
        locationData: ubicacion_usuario,
      };
      setMessages(prev => [...prev, userMessage]);
    }
    setIsTyping(true);

    try {
      if (activeTicketId) {
        const bodyRequest: any = {
            comentario: userMessageText,
            ...(attachmentInfo && { attachment_info: attachmentInfo }),
            ...(ubicacion_usuario && { ubicacion: ubicacion_usuario }),
        };
        await apiFetch(`/tickets/chat/${activeTicketId}/responder_ciudadano`, { method: "POST", body: bodyRequest });
      } else {
        const storedUser = JSON.parse(safeLocalStorage.getItem('user') || 'null');
        const rubro = storedUser?.rubro?.clave || storedUser?.rubro?.nombre || safeLocalStorage.getItem("rubroSeleccionado") || null;
        const tipoChatFinal = enforceTipoChatForRubro(tipoChat, rubro);

        const updatedContext = updateMunicipioContext(contexto, { userInput: userMessageText, action });
        setContexto(updatedContext);

        const requestBody: Record<string, any> = {
          pregunta: userMessageText,
          contexto_previo: updatedContext,
          tipo_chat: tipoChatFinal,
          ...(rubro && { rubro_clave: rubro }),
          ...(attachmentInfo && { attachment_info: attachmentInfo }),
          ...(ubicacion_usuario && { ubicacion_usuario: ubicacion_usuario }),
          ...(action && { action }),
          ...(actionPayload && { payload: actionPayload }),
          ...(action === "confirmar_reclamo" && currentClaimIdempotencyKey && { idempotency_key: currentClaimIdempotencyKey }),
        };

        const endpoint = getAskEndpoint({ tipoChat: tipoChatFinal, rubro });
        const data = await apiFetch<any>(endpoint, { method: 'POST', body: requestBody });

        const finalContext = updateMunicipioContext(updatedContext, { llmResponse: data });
        setContexto(finalContext);

        const isErrorResponse = !data.message_body;
        const botMessage: Message = {
          id: generateClientMessageId(),
          text: data.message_body || "⚠️ No se pudo generar una respuesta.",
          isBot: true,
          timestamp: new Date(),
          botones: data.botones || [],
          categorias: data.categorias || [],
          mediaUrl: data.media_url,
          locationData: data.location_data,
          attachmentInfo: data.attachment_info,
          isError: isErrorResponse,
        };
        setMessages(prev => [...prev, botMessage]);

        if (finalContext.id_ticket_creado) {
          setActiveTicketId(finalContext.id_ticket_creado);
          ultimoMensajeIdRef.current = 0;
          setCurrentClaimIdempotencyKey(null);
        }
      }
    } catch (error: any) {
      const errorMsg = getErrorMessage(error, '⚠️ No se pudo conectar con el servidor.');
      setMessages(prev => [...prev, { id: generateClientMessageId(), text: errorMsg, isBot: true, timestamp: new Date(), isError: true }]);
    } finally {
      setIsTyping(false);
    }
  }, [contexto, activeTicketId, isTyping, isAnonimo, anonId, currentClaimIdempotencyKey, tipoChat]);

  return { messages, isTyping, handleSend, activeTicketId, setMessages, setContexto, setActiveTicketId };
}
```

---

## `src/components/chat/ChatButtons.tsx`

```typescript
// src/components/chat/ChatButtons.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Boton } from '@/types/chat';

interface ChatButtonsProps {
    botones: Boton[];
    // onButtonClick ahora puede enviar un payload estructurado
    onButtonClick: (payload: { text: string; action?: string; payload?: any; }) => void;
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
        const actionToUse = boton.action || boton.action_id;
        const normalizedAction = actionToUse ? normalize(actionToUse) : null;
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
            onButtonClick({ text: boton.texto, action: normalizedAction, payload: boton.payload });
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
```

---

## `src/components/chat/CategorizedButtons.tsx`

```typescript
// src/components/chat/CategorizedButtons.tsx
import React from 'react';
import { Categoria, SendPayload, Boton } from '@/types/chat';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { motion } from 'framer-motion';

interface CategorizedButtonsProps {
  categorias: Categoria[];
  onButtonClick: (payload: SendPayload) => void;
  onInternalAction?: (action: string) => void;
}

// We need a simplified button handler here since ChatButtons is complex.
// Let's create a lean version for the accordion content.
const SimpleButton: React.FC<{ boton: Boton, onClick: (boton: Boton) => void }> = ({ boton, onClick }) => {
    const baseClass = "rounded-xl px-3 py-1 text-sm font-semibold bg-white text-blue-800 border border-blue-200 hover:bg-blue-50 hover:shadow transition-all text-left";

    if (boton.url) {
        return (
            <a
                href={boton.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${baseClass} no-underline inline-block w-full`}
                title={boton.texto}
            >
                {boton.texto}
            </a>
        );
    }

    return (
        <button
            onClick={() => onClick(boton)}
            className={`${baseClass} w-full`}
            title={boton.texto}
        >
            {boton.texto}
        </button>
    );
};


const CategorizedButtons: React.FC<CategorizedButtonsProps> = ({
  categorias,
  onButtonClick,
  onInternalAction,
}) => {
  if (!categorias || categorias.length === 0) {
    return null;
  }

  const handleButtonClick = (boton: Boton) => {
    const normalize = (v: string) => v.toLowerCase().replace(/[\s_-]+/g, "");
    const loginActions = ["login", "loginpanel", "chatuserloginpanel"].map(normalize);
    const registerActions = ["register", "registerpanel", "chatuserregisterpanel"].map(normalize);

    const action = boton.action || boton.accion_interna;
    const normalizedAction = action ? normalize(action) : null;

    if (normalizedAction && (loginActions.includes(normalizedAction) || registerActions.includes(normalizedAction))) {
        if (onInternalAction) onInternalAction(normalizedAction);
        return;
    }

    if (action) {
      onButtonClick({ text: boton.texto, action: action, payload: boton.payload });
      if (onInternalAction) onInternalAction(action);
      return;
    }

    if (boton.url) {
      window.open(boton.url, "_blank", "noopener,noreferrer");
      return;
    }

    onButtonClick({ text: boton.texto });
  };

  return (
    <motion.div
      className="w-full mt-2"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Accordion type="multiple" className="w-full">
        {categorias.map((categoria, index) => (
          <AccordionItem value={`cat-${index}`} key={index}>
            <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
              {categoria.titulo}
            </AccordionTrigger>
            <AccordionContent>
                <div className="flex flex-col gap-2 pt-1">
                    {categoria.botones.map((boton, btnIndex) => (
                        <SimpleButton
                            key={btnIndex}
                            boton={boton}
                            onClick={handleButtonClick}
                        />
                    ))}
                </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </motion.div>
  );
};

export default CategorizedButtons;
```
