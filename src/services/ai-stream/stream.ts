import { AIStreamEvent } from '@/schemas/stream';

export interface StreamCallbacks {
  onStart?: (eventId: string) => void;
  onDelta?: (content: string) => void;
  onReasoning?: (content: string) => void;
  onToolStart?: (toolName: string, input?: any) => void;
  onToolComplete?: (toolName: string, result?: any) => void;
  onCitation?: (citation: any) => void;
  onWarning?: (message: string, code?: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

/**
 * Consumes an EventSource or Fetch stream that yields AIStreamEvent JSON lines.
 */
export async function consumeStream(
  response: Response,
  callbacks: StreamCallbacks
) {
  if (!response.body) {
    callbacks.onError?.(new Error("No response body"));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            callbacks.onComplete?.();
            return;
          }

          try {
            const event = JSON.parse(data) as AIStreamEvent;

            switch (event.type) {
              case 'response.started':
                callbacks.onStart?.(event.event_id);
                break;
              case 'response.delta':
                if (event.payload && 'content' in event.payload && typeof event.payload.content === 'string') {
                  callbacks.onDelta?.(event.payload.content);
                }
                break;
              case 'response.reasoning_summary':
                if (event.payload && 'content' in event.payload && typeof event.payload.content === 'string') {
                  callbacks.onReasoning?.(event.payload.content);
                }
                break;
              case 'tool.started':
                if (event.payload && 'tool_name' in event.payload && typeof event.payload.tool_name === 'string') {
                  callbacks.onToolStart?.(event.payload.tool_name, event.payload.tool_input);
                }
                break;
              case 'tool.completed':
                if (event.payload && 'tool_name' in event.payload && typeof event.payload.tool_name === 'string') {
                  callbacks.onToolComplete?.(event.payload.tool_name, event.payload.tool_result);
                }
                break;
              case 'citation.added':
                if (event.payload && 'citation' in event.payload) {
                  callbacks.onCitation?.(event.payload.citation);
                }
                break;
              case 'moderation.warning':
                if (event.payload && 'message' in event.payload && typeof event.payload.message === 'string') {
                  callbacks.onWarning?.(event.payload.message, event.payload.code as string | undefined);
                }
                break;
              case 'response.completed':
                callbacks.onComplete?.();
                break;
              case 'response.error':
                if (event.payload && 'message' in event.payload && typeof event.payload.message === 'string') {
                  callbacks.onError?.(new Error(event.payload.message));
                } else {
                   callbacks.onError?.(new Error("Stream returned an error event"));
                }
                break;
            }
          } catch (e) {
            console.warn("Failed to parse stream JSON chunk", e, data);
          }
        }
      }
    }
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  } finally {
    reader.releaseLock();
  }
}
