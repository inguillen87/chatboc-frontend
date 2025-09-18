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

/**
 * Resets the current chat session ID by removing the stored value and creating a new one.
 * Useful when starting a new conversation flow that should not reuse the previous context.
 */
export function resetChatSessionId(): string {
  const newSessionId = uuidv4();

  if (typeof window === 'undefined') {
    console.warn('resetChatSessionId called in a non-browser environment. Returning a new UUID without persisting it.');
    return newSessionId;
  }

  try {
    safeLocalStorage.removeItem(CHAT_SESSION_ID_KEY);
    safeLocalStorage.setItem(CHAT_SESSION_ID_KEY, newSessionId);
  } catch (error) {
    console.error('Error resetting chat session ID in localStorage:', error);
  }

  return newSessionId;
}

export default getOrCreateChatSessionId;
