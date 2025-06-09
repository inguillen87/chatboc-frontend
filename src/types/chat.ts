
export interface Message {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
  botones?: { texto: string; payload?: string }[]; // <-- AÑADIR ESTA LÍNEA
}

export interface FAQ {
  question: string;
  answer: string;
}
export interface Message {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
  originalQuestion?: string; // <- usado en sugerencias
}
