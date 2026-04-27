import { panelApi } from '@/api/v2/client';
import { ApiError } from '@/utils/api';
import type { ChatRatingValue } from './chatTypes';

export const sendConversationFeedback = async (
  conversationId: string,
  rating: ChatRatingValue,
  comment?: string,
): Promise<'sent' | 'noop'> => {
  if (!conversationId) return 'noop';

  try {
    await panelApi.post(`/api/v2/chat/conversations/${encodeURIComponent(conversationId)}/feedback`, {
      rating,
      comment: comment?.trim() || undefined,
    });
    return 'sent';
  } catch (error) {
    if (error instanceof ApiError && [404, 405, 501].includes(error.status)) {
      return 'noop';
    }
    throw error;
  }
};
