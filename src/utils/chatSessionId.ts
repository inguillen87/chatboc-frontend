// src/utils/chatSessionId.ts
import { safeLocalStorage } from './safeLocalStorage';
import { v4 as uuidv4 } from 'uuid';

const CHAT_SESSION_ID_KEY = 'chat_session_id';

/**
 * Retrieves the chat session ID from local storage.
 * If not found, generates a new UUID v4, stores it, and returns it.
 * This ID is persistent for the user's browser until local storage is cleared.
 */
export function getOrCreateChatSessionId(): string {
  if (typeof window === 'undefined') {
    // Should not happen in a browser environment where chat operates
    console.warn('getOrCreateChatSessionId called in a non-browser environment.');
    return `server-generated-${uuidv4()}`; // Fallback for SSR or tests if needed, though client should always have one
  }
  try {
    let sessionId = safeLocalStorage.getItem(CHAT_SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = uuidv4();
      safeLocalStorage.setItem(CHAT_SESSION_ID_KEY, sessionId);
    }
    return sessionId;
  } catch (error) {
    console.error('Error accessing localStorage for chat session ID:', error);
    // Fallback if localStorage is completely inaccessible (e.g., security settings)
    // This ID will not be persisted.
    return uuidv4();
  }
}

export default getOrCreateChatSessionId;
