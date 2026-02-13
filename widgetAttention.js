export const DEFAULT_MESSAGE = '¿Necesitás ayuda?';

let choicesCache;

export function getChoices() {
  if (choicesCache !== undefined) return choicesCache;

  const env = process.env.ATTENTION_BUBBLE_CHOICES;
  if (!env) {
    choicesCache = [];
  } else {
    choicesCache = env.split('|').map((s) => s.trim()).filter(Boolean);
  }
  return choicesCache;
}

export function getAttentionMessage() {
  const choices = getChoices();
  if (choices.length === 0) return DEFAULT_MESSAGE;
  const idx = Math.floor(Math.random() * choices.length);
  return choices[idx];
}
