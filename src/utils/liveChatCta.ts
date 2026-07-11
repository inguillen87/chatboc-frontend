type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const asText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export interface LiveChatRequestAction {
  action: string;
  text: string;
  payload: {
    cta_id?: string;
    mode?: string;
  };
}

export const resolveLiveChatRequestAction = (contract: unknown): LiveChatRequestAction => {
  const cta = asRecord(asRecord(contract).cta);
  const primary = asRecord(cta.primary);
  const action = asText(primary.action) || 'request_agent';
  const mode = asText(primary.mode) || asText(asRecord(contract).mode);
  const ctaId = asText(primary.id);
  const offline = action === 'queue_offline_message';

  return {
    action,
    text: offline
      ? 'Quiero dejar un mensaje para el equipo'
      : 'Quisiera hablar con un representante',
    payload: {
      ...(ctaId ? { cta_id: ctaId } : {}),
      ...(mode ? { mode } : {}),
    },
  };
};
