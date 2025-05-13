
export interface Message {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

export interface FAQ {
  question: string;
  answer: string;
}
