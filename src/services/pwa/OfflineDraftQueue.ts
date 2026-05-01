import { safeLocalStorage } from '@/utils/safeLocalStorage';

export interface QueuedAction {
  id: string;
  type: 'create_ticket_draft' | 'survey_response' | 'survey_draft';
  payload: any;
  timestamp: string;
}

const QUEUE_KEY = 'chatboc_offline_draft_queue';

export class OfflineDraftQueue {
  static getQueue(): QueuedAction[] {
    try {
      const raw = safeLocalStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static addAction(type: QueuedAction['type'], payload: any) {
    const queue = this.getQueue();
    const newAction: QueuedAction = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    safeLocalStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, newAction]));
    return newAction;
  }

  static removeAction(id: string) {
    const queue = this.getQueue().filter(action => action.id !== id);
    safeLocalStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  static clearQueue() {
    safeLocalStorage.removeItem(QUEUE_KEY);
  }

  /**
   * Intended to be called when online connectivity is restored.
   * Flushes standard payload events over standard endpoints sequentially.
   */
  static async syncQueue(apiFetchClient: Function) {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    for (const action of queue) {
       try {
         if (action.type === 'create_ticket_draft') {
            await apiFetchClient('/api/tickets/draft/sync', { method: 'POST', body: action.payload });
         } else if (action.type === 'survey_response') {
            await apiFetchClient('/api/surveys/sync', { method: 'POST', body: action.payload });
         } else if (action.type === 'survey_draft') {
            await apiFetchClient('/api/v2/surveys/draft', { method: 'POST', body: action.payload });
         }
         this.removeAction(action.id);
       } catch (err) {
         console.warn(`[OfflineQueue] No se pudo sincronizar la accion offline ${action.id}`, err);
         // Keep it in the queue for the next sync attempt if it's a network failure.
         // Wait before returning to let the network stabilize
       }
    }
  }
}
