import { apiFetch, ApiError } from '@/utils/api';

export interface KnowledgeBaseSuggestion {
  answer: string;
  title?: string;
  source?: string;
  confidence?: number;
  language?: string;
}

interface FetchSuggestionsParams {
  ticketId?: number;
  query: string;
  tenantSlug?: string | null;
  language?: string | null;
}

interface SuggestionResponse {
  suggestions?: KnowledgeBaseSuggestion[];
}

export async function fetchKnowledgeBaseSuggestions({
  ticketId,
  query,
  tenantSlug,
  language,
}: FetchSuggestionsParams): Promise<KnowledgeBaseSuggestion[]> {
  if (!query.trim()) return [];

  try {
    const endpoint = ticketId
      ? `/tickets/${encodeURIComponent(ticketId)}/knowledge-base/suggestions`
      : '/knowledge-base/suggestions';

    const response = await apiFetch<SuggestionResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ query, language: language || undefined }),
      tenantSlug,
      isWidgetRequest: true,
      omitCredentials: true,
    });

    return Array.isArray(response.suggestions) ? response.suggestions : [];
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }
    console.error('Error fetching knowledge base suggestions', error);
    throw error;
  }
}

