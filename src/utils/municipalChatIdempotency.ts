import { v4 as uuidv4 } from "uuid";

export const MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN =
  /^[A-Za-z0-9_.:-]{8,128}$/;

export const normalizeMunicipalChatIdempotencyKey = (
  value: unknown,
): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN.test(normalized)
    ? normalized
    : null;
};

export const createMunicipalChatIdempotencyKey = (): string => uuidv4();

export interface MunicipalInitIdempotencyState {
  scope: string;
  key: string;
}

export const resolveMunicipalInitIdempotencyState = ({
  tipoChat,
  scope,
  current,
  createKey = createMunicipalChatIdempotencyKey,
}: {
  tipoChat: "municipio" | "pyme";
  scope: string;
  current?: MunicipalInitIdempotencyState | null;
  createKey?: () => string;
}): MunicipalInitIdempotencyState | null => {
  if (tipoChat !== "municipio") return null;
  if (
    current?.scope === scope &&
    normalizeMunicipalChatIdempotencyKey(current.key)
  ) {
    return current;
  }

  const key = normalizeMunicipalChatIdempotencyKey(createKey());
  if (!key) {
    throw new Error("No se pudo generar una Idempotency-Key municipal valida.");
  }
  return { scope, key };
};

export const resolveMunicipalChatIdempotencyKey = ({
  tipoChat,
  action,
  currentClaimIdempotencyKey,
  createKey = createMunicipalChatIdempotencyKey,
}: {
  tipoChat: "municipio" | "pyme";
  action?: string | null;
  currentClaimIdempotencyKey?: string | null;
  createKey?: () => string;
}): string | null => {
  if (tipoChat !== "municipio") return null;

  if (action?.trim().toLowerCase() === "confirmar_reclamo") {
    const existingKey = normalizeMunicipalChatIdempotencyKey(
      currentClaimIdempotencyKey,
    );
    if (existingKey) return existingKey;
  }

  const generatedKey = normalizeMunicipalChatIdempotencyKey(createKey());
  if (!generatedKey) {
    throw new Error("No se pudo generar una Idempotency-Key municipal valida.");
  }
  return generatedKey;
};
