
export interface FAQ {
  question: string;
  answer: string;
}
export interface Message {
  id: number | string;
  text: string;
  isBot: boolean;
  timestamp: Date;
  botones?: {
    texto: string;
    payload?: string;
  }[];
}