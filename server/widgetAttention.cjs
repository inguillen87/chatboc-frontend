const DEFAULT_MESSAGE = '¿Necesitás ayuda?';

function getChoices() {
  const env = process.env.ATTENTION_BUBBLE_CHOICES;
  if (!env) return [];
  return env.split('|').map(s => s.trim()).filter(Boolean);
}

function getAttentionMessage() {
  const choices = getChoices();
  if (choices.length === 0) return DEFAULT_MESSAGE;
  const idx = Math.floor(Math.random() * choices.length);
  return choices[idx];
}

module.exports = { getAttentionMessage, DEFAULT_MESSAGE, getChoices };
