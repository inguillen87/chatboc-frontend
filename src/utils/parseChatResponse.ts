export interface Boton {
  texto: string;
  url?: string;
  accion_interna?: string;
  action?: string;
}

export interface ChatApiResponse {
  respuesta?: string | { respuesta?: string; botones?: Boton[] };
  botones?: Boton[];
  contexto_actualizado?: any;
  [key: string]: any;
}

export function parseChatResponse(data: ChatApiResponse | any): { text?: string; botones: Boton[] } {
  if (!data) return { text: undefined, botones: [] };

  let text: string | undefined = undefined;
  let botones: Boton[] = [];

  if (typeof data.respuesta === 'object' && data.respuesta !== null) {
    if (typeof data.respuesta.respuesta === 'string') {
      text = data.respuesta.respuesta;
    }
    if (Array.isArray((data.respuesta as any).botones)) {
      botones = (data.respuesta as any).botones;
    }
  } else if (typeof data.respuesta === 'string') {
    text = data.respuesta;
  }

  if (Array.isArray(data.botones)) {
    botones = botones.length > 0 ? botones : data.botones;
  }

  return { text, botones };
}
