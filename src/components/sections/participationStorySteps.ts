export type ParticipationStep = { id: string; label: string; title: string; body: string };

export const PARTICIPATION_STEPS: readonly ParticipationStep[] = [
  {
    id: "participa",
    label: "Participás",
    title: "Votás qué querés para tu plaza",
    body: "Una encuesta corta por WhatsApp. Tu opinión llega ordenada al municipio.",
  },
  {
    id: "suma",
    label: "Sumás puntos",
    title: "Cada aporte queda registrado",
    body: "Encuestas, votaciones y reportes del barrio suman a tu cuenta ciudadana.",
  },
  {
    id: "elige",
    label: "Elegís",
    title: "Un formulario dentro del chat",
    body: "Kit escolar, beca, descuento en remedios o una entrada. Sin descargar nada.",
  },
  {
    id: "recibe",
    label: "Recibís",
    title: "El pedido sigue solo",
    body: "Te avisamos por el mismo chat dónde y cuándo retirarlo.",
  },
] as const;
