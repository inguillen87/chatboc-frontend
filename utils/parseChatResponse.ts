import { Message } from "@/types/chat"; // Importar Message para usar su tipo AttachmentInfo

export interface Boton {
  texto: string;
  url?: string;
  accion_interna?: string;
  action?: string;
  action_id?: string;
}

export interface ChatApiResponse {
  respuesta?: string | { respuesta?: string; botones?: Boton[]; attachmentInfo?: Message['attachmentInfo'] };
  respuesta_usuario?: string | { respuesta?: string; botones?: Boton[]; attachmentInfo?: Message['attachmentInfo'] };
  /** Nuevo: campo usado por el backend para el texto principal */
  message_body?: string | { respuesta?: string; botones?: Boton[]; attachmentInfo?: Message['attachmentInfo'] };
  /** Algunas respuestas usan 'comentario' como cuerpo del mensaje */
  comentario?: string | { respuesta?: string; botones?: Boton[]; attachmentInfo?: Message['attachmentInfo'] };
  botones?: Boton[];
  contexto_actualizado?: any;
  attachmentInfo?: Message['attachmentInfo'];
  [key: string]: any;
}

export function parseChatResponse(data: ChatApiResponse): {
  text?: string;
  botones: Boton[];
  attachmentInfo?: Message['attachmentInfo'];
} {
  if (!data) return { text: undefined, botones: [], attachmentInfo: undefined };

  let text: string | undefined = undefined;
  let botones: Boton[] = [];
  let attachmentInfo: Message['attachmentInfo'] = undefined;

  // Buscar attachmentInfo primero a nivel raíz de la respuesta del bot
  if (data.attachmentInfo && typeof data.attachmentInfo === 'object') {
    attachmentInfo = data.attachmentInfo;
  }

  const rawRespuesta =
    data.message_body !== undefined
      ? data.message_body
      : data.respuesta !== undefined
      ? data.respuesta
      : data.respuesta_usuario !== undefined
      ? data.respuesta_usuario
      : data.comentario;

  if (typeof rawRespuesta === 'object' && rawRespuesta !== null) {
    if (typeof rawRespuesta.respuesta === 'string') {
      text = rawRespuesta.respuesta;
    }
    if (Array.isArray((rawRespuesta as any).botones)) {
      botones = (rawRespuesta as any).botones;
    }
    // Buscar attachmentInfo dentro del objeto respuesta si no se encontró a nivel raíz
    if (!attachmentInfo && rawRespuesta.attachmentInfo && typeof rawRespuesta.attachmentInfo === 'object') {
      attachmentInfo = rawRespuesta.attachmentInfo;
    }
  } else if (typeof rawRespuesta === 'string') {
    text = rawRespuesta;
  }

  if (Array.isArray(data.botones)) {
    botones = botones.length > 0 ? botones : data.botones;
  }

  botones = botones.map((b) => {
    let action = b.action ?? b.accion_interna;
    let url = b.url;

    if (!url && b.action_id) {
      if (typeof b.action_id === 'string' && b.action_id.startsWith('url:')) {
        url = b.action_id.slice(4);
      } else {
        action = action ?? b.action_id;
      }
    }

    return {
      ...b,
      action,
      url,
    };
  });

  // Validar y limpiar attachmentInfo si es necesario
  if (attachmentInfo) {
    if (!attachmentInfo.url || !attachmentInfo.name || !attachmentInfo.mimeType) {
      // Si falta información esencial, se descarta el adjunto.
      // Podríamos loggear un warning aquí.
      // console.warn("AttachmentInfo incompleto recibido del backend:", attachmentInfo);
      attachmentInfo = undefined;
    } else {
      // Asegurar que los campos opcionales sean undefined si no son del tipo correcto o están vacíos
      if (attachmentInfo.size !== undefined && typeof attachmentInfo.size !== 'number') {
        attachmentInfo.size = undefined;
      }
      if (attachmentInfo.metadata !== undefined && typeof attachmentInfo.metadata !== 'object') {
        attachmentInfo.metadata = undefined;
      }
    }
  }

  return { text, botones, attachmentInfo };
}
