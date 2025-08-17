// --- src/services/apiService.ts (CORREGIDO Y COMPLETO) ---
import type { Ticket, Comment, TicketStatus } from '@/types'; // CAMBIO: Se agrega TicketStatus a la importación
import { safeLocalStorage } from '@/utils/safeLocalStorage';

// Use the same base URL resolution as api.ts. Default to the Vite dev
// proxy path when no env variable is provided.
const API_URL = import.meta.env.VITE_API_URL || "/api";

interface TicketsApiResponse { ok: boolean; tickets: Ticket[]; error?: string; }
interface CommentsApiResponse { ok: boolean; comentarios: Comment[]; error?: string; }

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = safeLocalStorage.getItem("authToken");
  const entityToken = safeLocalStorage.getItem("entityToken");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(entityToken && { "X-Entity-Token": entityToken }),
    ...options.headers,
  };
  const config: RequestInit = {
    ...options,
    headers,
  };

  const mask = (t: string | null) => (t ? `${t.slice(0, 8)}...` : null);
  console.log('[apiService] Request', {
    endpoint,
    method: options.method || 'GET',
    authToken: mask(token),
    entityToken: mask(entityToken),
    hasBody: !!options.body,
    headers,
  });

  const response = await fetch(`${API_URL}${endpoint}`, config);

  console.log('[apiService] Response', { endpoint, status: response.status });

  if (!response.ok) {
    if (response.status === 401) throw new Error("401: Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
    const errorText = await response.text();
    throw new Error(`Error ${response.status}: ${errorText.slice(0, 150)}`);
  }
  
  // Manejo de respuestas vacías (común en PUT/POST/DELETE)
  if (response.status === 204 || !response.headers.get("content-length")) {
    return { ok: true } as T;
  }
  
  return response.json();
}

export const ticketService = {
  getTickets: (userId: number): Promise<TicketsApiResponse> =>
    apiFetch(`/tickets/municipio?user_id=${userId}`, { sendEntityToken: true }),
    
  getComments: (ticketId: number, userId: number): Promise<CommentsApiResponse> =>
    apiFetch(`/tickets/municipio/${ticketId}/comentarios?user_id=${userId}`, { sendEntityToken: true }),
    
  postComment: (ticketId: number, userId: number, comentario: string): Promise<{ ok: boolean }> =>
    apiFetch(`/tickets/municipio/${ticketId}/comentarios`, {
      method: 'POST',
      body: JSON.stringify({ comentario, user_id: userId }),
      sendEntityToken: true,
    }),
    
  updateStatus: (ticketId: number, userId: number, estado: TicketStatus): Promise<{ ok: boolean }> =>
    apiFetch(`/tickets/municipio/${ticketId}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado, user_id: userId }),
      sendEntityToken: true,
    }),
};