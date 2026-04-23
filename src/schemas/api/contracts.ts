import { z } from 'zod';

export const CitationSchema = z.object({
  id: z.string(),
  content: z.string(),
  source: z.string().optional(),
  url: z.string().url().optional(),
  score: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const PolicyDecisionSchema = z.object({
  decision: z.enum(['allowed', 'blocked', 'redacted', 'flagged']),
  reason: z.string().optional(),
  policy_id: z.string().optional(),
  matched_rules: z.array(z.string()).optional(),
});
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

export const AIResponseEnvelopeSchema = z.object({
  id: z.string(),
  request_id: z.string().optional(),
  content: z.string(),
  citations: z.array(CitationSchema).optional(),
  policy_decision: PolicyDecisionSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type AIResponseEnvelope = z.infer<typeof AIResponseEnvelopeSchema>;

export const TicketTimelineEventSchema = z.object({
  id: z.string(),
  ticket_id: z.string(),
  type: z.enum(['status_changed', 'assignment_changed', 'presence_changed', 'message_created', 'message_read', 'typing']),
  timestamp: z.string().datetime(),
  actor: z.object({
    id: z.string(),
    type: z.enum(['user', 'agent', 'system']),
    name: z.string().optional(),
  }),
  payload: z.record(z.unknown()).optional(),
});
export type TicketTimelineEvent = z.infer<typeof TicketTimelineEventSchema>;

export const RealtimePresenceEventSchema = z.object({
  ticket_id: z.string(),
  users: z.array(z.object({
    id: z.string(),
    type: z.enum(['user', 'agent']),
    status: z.enum(['online', 'offline', 'idle']),
    last_seen: z.string().datetime(),
  })),
});
export type RealtimePresenceEvent = z.infer<typeof RealtimePresenceEventSchema>;

export const VoiceSessionConfigSchema = z.object({
  session_id: z.string(),
  ws_url: z.string().url(),
  token: z.string(),
  ice_servers: z.array(z.object({
    urls: z.union([z.string(), z.array(z.string())]),
    username: z.string().optional(),
    credential: z.string().optional(),
  })).optional(),
  capabilities: z.object({
    transcription: z.boolean().optional(),
    interruption: z.boolean().optional(),
  }).optional(),
});
export type VoiceSessionConfig = z.infer<typeof VoiceSessionConfigSchema>;
