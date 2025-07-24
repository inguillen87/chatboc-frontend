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
  const headers: HeadersInit = { // Default headers
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  // No establecer Content-Type si el body es FormData, el navegador lo hará.
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    if (response.status === 404) {
      // Handle 404 errors gracefully
      if (endpoint.includes('/comentarios')) {
        return { ok: true, comentarios: [] } as T;
      }
    }
    if (response.status === 401) throw new Error("401: Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
    // Intenta parsear el cuerpo del error como JSON, si falla, usa el texto.
    let errorBody;
    try {
      errorBody = await response.json();
    } catch (e) {
      // Si no es JSON, response.text() podría ya haber sido consumido o no ser lo que queremos.
      // Es mejor manejar response.text() con cuidado o basarse en statusText si text() falla.
      // Por ahora, mantenemos una lógica simple, pero esto podría mejorarse.
      errorBody = { error: response.statusText || "Error desconocido" };
    }
    const errorMessage = errorBody?.error || errorBody?.message || `Error ${response.status}`;
    throw new Error(typeof errorMessage === 'string' ? errorMessage.slice(0,250) : JSON.stringify(errorMessage).slice(0,250));
  }
  
  // Manejo de respuestas vacías (común en PUT/POST/DELETE)
  // response.json() falla si el body está vacío.
  const contentType = response.headers.get("content-type");
  if (response.status === 204 || (contentType && contentType.includes("application/json") && response.headers.get("content-length") === "0") ) {
    return { ok: true } as T; // Asumir 'ok:true' para 204 o JSON vacío.
  }
  if (!contentType || !contentType.includes("application/json")) {
    // Si no es JSON, pero la respuesta es OK (ej. descarga de archivo), devolver la respuesta cruda.
    // Esto es un cambio de comportamiento: antes siempre intentaba response.json().
    // El llamador deberá manejar esto (ej. response.blob(), response.text()).
    // Para este proyecto, la mayoría de las respuestas OK son JSON.
    // Si se necesita manejar otros tipos, se puede hacer más específico.
    // Por ahora, si no es JSON y no es 204, se intenta parsear como JSON (comportamiento anterior).
     return response.json();
  }
  
  return response.json();
}

export const ticketService = {
  getTickets: (userId: number): Promise<TicketsApiResponse> =>
    apiFetch(`/tickets/municipio?user_id=${userId}`, { headers: { 'X-Send-Entity-Token': 'true' } }), // sendEntityToken es un header custom
    
  getComments: (ticketId: number, userId: number): Promise<CommentsApiResponse> =>
    apiFetch(`/tickets/municipio/${ticketId}/comentarios?user_id=${userId}`, { headers: { 'X-Send-Entity-Token': 'true' } }),
    
  postComment: (ticketId: number, userId: number, comentario: string): Promise<{ ok: boolean }> =>
    apiFetch(`/tickets/municipio/${ticketId}/comentarios`, {
      method: 'POST',
      body: JSON.stringify({ comentario, user_id: userId }),
      headers: { 'X-Send-Entity-Token': 'true' },
    }),
    
  updateStatus: (ticketId: number, userId: number, estado: TicketStatus): Promise<{ ok: boolean }> =>
    apiFetch(`/tickets/municipio/${ticketId}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado, user_id: userId }),
      headers: { 'X-Send-Entity-Token': 'true' },
    }),
};

// Exportar apiFetch para que pueda ser usado directamente por otros servicios o componentes
// (ej. para subida de archivos donde el Content-Type es manejado por FormData)
export { apiFetch };