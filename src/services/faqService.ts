import { FAQ } from "@/types/chat";

const faqs: FAQ[] = [
  {
    question: "¿Qué es Chatboc?",
    answer:
      "Chatboc es un asistente virtual con IA personalizado para pymes. Responde consultas de tus clientes 24/7, aprende de cada interacción y se adapta a tu negocio específico.",
  },
  {
    question: "¿Cuánto cuesta Chatboc?",
    answer:
      "Ofrecemos una prueba gratuita de 15 días con hasta 10 preguntas personalizadas. Nuestro plan Pro comienza desde USD 20 al mes, con hasta 50 preguntas personalizadas y muchas más funcionalidades.",
  },
  {
    question: "¿Cómo funciona la personalización?",
    answer:
      "Comenzamos configurando juntos 10 preguntas y respuestas cruciales para tu negocio. Así, desde el día uno, Chatboc habla el idioma de tus clientes y conoce tus productos/servicios.",
  },
  {
    question: "¿Necesito conocimientos técnicos para usar Chatboc?",
    answer:
      "¡No! Chatboc está diseñado para ser muy fácil de usar. Nuestro panel de administración es intuitivo, pensado para dueños de pymes, no para expertos en tecnología.",
  },
];

export const findBestMatch = (text: string): string => {
  const normalizedText = text.toLowerCase();
  let bestMatch: FAQ | null = null;
  let highestScore = 0;

  for (const faq of faqs) {
    const score = faq.question
      .toLowerCase()
      .split(" ")
      .reduce((acc, word) => acc + (normalizedText.includes(word) ? 1 : 0), 0);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = faq;
    }
  }

  return highestScore > 0 && bestMatch
    ? bestMatch.answer
    : "Lo siento, no tengo esa información específica. ¿Puedo ayudarte con algo más sobre Chatboc?";
};
