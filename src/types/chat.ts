// src/types/chat.ts

// Define cómo es un objeto Botón
export interface Boton {
  texto: string;
  url?: string;
  accion_interna?: string;
}

// Define cómo es un objeto Mensaje
export interface Message {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
  botones?: Boton[]; // ¡Esta línea es crucial! Le dice a TypeScript que un mensaje PUEDE tener una lista de botones.
}