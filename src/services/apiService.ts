// --- src/services/apiService.ts (CORREGIDO Y COMPLETO) ---
import type { Ticket, Comment, TicketStatus } from '@/types'; // CAMBIO: Se agrega TicketStatus a la importación
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const API_URL = "https://api.chatboc.ar";

interface TicketsApiResponse { ok: boolean; tickets: Ticket[]; error?: string; }
interface CommentsApiResponse { ok: boolean; comentarios: Comment[]; error?: string; }

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = safeLocalStorage.getItem("authToken");
  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);

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
    apiFetch(`/tickets/municipio?user_id=${userId}`),
    
  getComments: (ticketId: number, userId: number): Promise<CommentsApiResponse> => 
    apiFetch(`/tickets/municipio/${ticketId}/comentarios?user_id=${userId}`),
    
  postComment: (ticketId: number, userId: number, comentario: string): Promise<{ ok: boolean }> => 
    apiFetch(`/tickets/municipio/${ticketId}/comentarios`, {
      method: 'POST',
      body: JSON.stringify({ comentario, user_id: userId }),
    }),
    
  updateStatus: (ticketId: number, userId: number, estado: TicketStatus): Promise<{ ok: boolean }> => 
    apiFetch(`/tickets/municipio/${ticketId}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado, user_id: userId }),
    }),
};