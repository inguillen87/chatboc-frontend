import { readBackendFlag } from "@/utils/backendFlags";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const readEnvFlag = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
};

export const isGlobalSocketExplicitlyEnabled = (): boolean =>
  readEnvFlag(import.meta.env.VITE_ENABLE_GLOBAL_SOCKET) ||
  readEnvFlag(import.meta.env.VITE_ENABLE_SOCKET_IO);

export const shouldAttemptContractSocket = ({
  socketEnabled,
  allowWebsocket,
  allowRealtimeLiveChat,
}: {
  socketEnabled?: unknown;
  allowWebsocket?: unknown;
  allowRealtimeLiveChat?: unknown;
}): boolean => {
  if (readEnvFlag(import.meta.env.VITE_ENABLE_SOCKET_IO)) return true;

  return (
    readBackendFlag(socketEnabled, false) &&
    readBackendFlag(allowWebsocket, false) &&
    readBackendFlag(allowRealtimeLiveChat, false)
  );
};
