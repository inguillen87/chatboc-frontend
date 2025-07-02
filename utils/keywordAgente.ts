export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const KEYWORDS_AGENTE = [
  'agente',
  'humano',
  'persona',
  'operador',
  'representante',
  'asesor',
  'hablar con un agente',
  'hablar con una persona',
  'quiero hablar con alguien',
  'quiero hablar con un humano',
  'necesito ayuda de una persona',
  'soporte real',
  'ayuda humana',
  'auxilio',
  'emergencia',
  'chat en vivo',
  'soporte tecnico',
  'incendio',
  'denuncia',
  'boton de panico',
  'hablar con alguien',
  'ayuda',
];

export function contieneKeywordAgente(textoUsuario: string): boolean {
  const textoNorm = normalizarTexto(textoUsuario);
  return KEYWORDS_AGENTE.some((kw) => textoNorm.includes(normalizarTexto(kw)));
}
