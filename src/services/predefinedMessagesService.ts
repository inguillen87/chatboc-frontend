import { apiFetch } from '@/utils/api';

export interface PredefinedMessage {
  id: string;
  title: string;
  message: string;
}

export const getPredefinedMessages = async (): Promise<PredefinedMessage[]> => {
  return apiFetch<PredefinedMessage[]>('/predefined-messages');
};

export const createPredefinedMessage = async (data: Omit<PredefinedMessage, 'id'>): Promise<PredefinedMessage> => {
  return apiFetch<PredefinedMessage>('/predefined-messages', {
    method: 'POST',
    body: data,
  });
};

export const updatePredefinedMessage = async (id: string, data: Partial<PredefinedMessage>): Promise<PredefinedMessage> => {
  return apiFetch<PredefinedMessage>(`/predefined-messages/${id}`, {
    method: 'PUT',
    body: data,
  });
};

export const deletePredefinedMessage = async (id: string): Promise<void> => {
  return apiFetch<void>(`/predefined-messages/${id}`, {
    method: 'DELETE',
  });
};
