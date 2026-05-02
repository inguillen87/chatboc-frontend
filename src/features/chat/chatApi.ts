import { panelApi } from '@/api/v2/client';
import { ApiError, apiFetch } from '@/utils/api';
import type { ChatRatingValue } from './chatTypes';
import type { ChatLeadCaptureConfig } from '@/types/chat';

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

export const submitLeadCapture = async (
  config: ChatLeadCaptureConfig,
  payload: Record<string, unknown>,
  tenantSlug?: string | null,
) => {
  const endpoint = config.endpoint?.trim() || '/api/public/lead-capture';
  return apiFetch(endpoint, {
    method: 'POST',
    body: payload,
    skipAuth: true,
    isWidgetRequest: true,
    tenantSlug,
    suppressPanel401Redirect: true,
  });
};
