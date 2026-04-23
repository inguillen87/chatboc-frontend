import { z } from 'zod';
import { CitationSchema } from '../api/contracts';

export const AIStreamEventSchema = z.object({
  event_id: z.string(),
  type: z.enum([
    'response.started',
    'response.delta',
    'response.reasoning_summary',
    'tool.started',
    'tool.completed',
    'citation.added',
    'moderation.warning',
    'response.completed',
    'response.error'
  ]),
  timestamp: z.string().datetime(),
  payload: z.union([
    z.object({ content: z.string() }), // For delta, summary
    z.object({ tool_name: z.string(), tool_input: z.unknown().optional(), tool_result: z.unknown().optional() }), // For tools
    z.object({ citation: CitationSchema }), // For citations
    z.object({ message: z.string(), code: z.string().optional() }), // For warnings and errors
    z.record(z.unknown()) // Fallback
  ]).optional(),
});
export type AIStreamEvent = z.infer<typeof AIStreamEventSchema>;
