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
    const queryParams = new URLSearchParams();
    queryParams.set('query', query);
    if (language) {
      queryParams.set('language', language);
    }

    const request = async (method: 'POST' | 'GET') =>
      apiFetch<SuggestionResponse>(
        method === 'GET' ? `${endpoint}?${queryParams.toString()}` : endpoint,
        {
          method,
          body:
            method === 'POST'
              ? JSON.stringify({ query, language: language || undefined })
              : undefined,
          tenantSlug,
          isWidgetRequest: true,
          omitCredentials: true,
        },
      );

    let response: SuggestionResponse | null = null;

    try {
      response = await request('POST');
    } catch (error) {
      if (error instanceof ApiError && error.status === 405) {
        response = await request('GET');
      } else {
        throw error;
      }
    }

    return Array.isArray(response?.suggestions) ? response.suggestions : [];
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }
    console.error('Error fetching knowledge base suggestions', error);
    throw error;
  }
}

