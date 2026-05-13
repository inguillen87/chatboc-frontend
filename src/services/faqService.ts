import { FAQ } from "@/types/chat";

const faqs: FAQ[] = [
  {
    question: "Que es Chatboc?",
    answer:
      "Chatboc combina consultoria, agente IA y panel operativo para atender consultas, vender, crear casos, medir resultados y derivar a personas cuando hace falta.",
  },
  {
    question: "Para que organizaciones sirve?",
    answer:
      "Sirve para empresas, comercios, gobiernos, municipios y colegios que necesitan ordenar conversaciones, reclamos, pedidos, encuestas, votaciones y seguimiento.",
  },
  {
    question: "Que puede entender el agente?",
    answer:
      "Puede trabajar con texto, notas de voz, imagenes, archivos, ubicaciones y llamadas cuando el canal esta habilitado por la organizacion.",
  },
  {
    question: "Que pasa despues de una conversacion?",
    answer:
      "La conversacion puede dejar un lead, pedido, reclamo, caso escolar, respuesta de encuesta, comentario o derivacion humana con contexto para el equipo.",
  },
  {
    question: "Necesito conocimientos tecnicos?",
    answer:
      "No. El equipo de Chatboc acompana la configuracion para que la experiencia quede clara para usuarios, operadores y administradores.",
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
    : "Puedo ayudarte a entender como Chatboc atiende, vende, mide y ordena operaciones reales.";
};
