import { Message } from "@/types/chat"; // Importar Message para usar su tipo AttachmentInfo

export interface Boton {
  texto: string;
  url?: string;
  accion_interna?: string;
  action?: string;
}

export interface ChatApiResponse {
  respuesta?: string | { respuesta?: string; botones?: Boton[]; attachmentInfo?: Message['attachmentInfo'] }; // Añadir attachmentInfo aquí
  botones?: Boton[];
  contexto_actualizado?: any;
  attachmentInfo?: Message['attachmentInfo']; // Y/o aquí, a nivel raíz de la respuesta
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

  if (typeof data.respuesta === 'object' && data.respuesta !== null) {
    if (typeof data.respuesta.respuesta === 'string') {
      text = data.respuesta.respuesta;
    }
    if (Array.isArray((data.respuesta as any).botones)) {
      botones = (data.respuesta as any).botones;
    }
    // Buscar attachmentInfo dentro del objeto respuesta si no se encontró a nivel raíz
    if (!attachmentInfo && data.respuesta.attachmentInfo && typeof data.respuesta.attachmentInfo === 'object') {
      attachmentInfo = data.respuesta.attachmentInfo;
    }
  } else if (typeof data.respuesta === 'string') {
    text = data.respuesta;
  }

  if (Array.isArray(data.botones)) {
    botones = botones.length > 0 ? botones : data.botones;
  }

  botones = botones.map((b) => ({
    ...b,
    action: b.action ?? b.accion_interna,
  }));

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
