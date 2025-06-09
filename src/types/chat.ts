
export interface FAQ {
  question: string;
  answer: string;
}
export interface Message {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
  botones?: { texto: string; payload?: string }[];
  originalQuestion?: string;
}
