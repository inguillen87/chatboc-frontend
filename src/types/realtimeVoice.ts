export type RealtimeVoiceVertical = "municipio" | "pyme" | "colegio" | "general" | string;

export interface RealtimeVoiceTransports {
  browser?: "webrtc" | string;
  server?: "websocket" | string;
  phone_bridge?: "twilio_media_streams" | string;
  sip_ready?: boolean;
  [key: string]: string | boolean | null | undefined;
}

export interface RealtimeVoiceFeatures {
  barge_in?: boolean;
  server_vad?: boolean;
  tool_calling?: boolean;
  whatsapp_followup?: boolean;
  post_call_receipt?: boolean;
  human_handoff?: boolean;
  [key: string]: string | number | boolean | null | undefined;
}

export interface RealtimeVoiceCapabilities {
  contract_version?: "realtime.voice_capabilities.v1" | string;
  provider?: "openai_realtime" | string;
  recommended_model?: string | null;
  fallback_model?: string | null;
  voice?: string | null;
  active_vertical?: RealtimeVoiceVertical | null;
  native_speech_to_speech?: boolean | null;
  avoid_external_stt_tts_loop?: boolean | null;
  transports?: RealtimeVoiceTransports | null;
  features?: RealtimeVoiceFeatures | null;
  starter_messages?: string[];
  starters?: string[];
  voice_starters?: string[];
  badges?: Array<string | { label?: string | null; text?: string | null }>;
  trust_badges?: Array<string | { label?: string | null; text?: string | null }>;
  badge_labels?: string[];
  request_id?: string | null;
  [key: string]: unknown;
}

export interface RealtimeVoiceQuery {
  tenant?: string | null;
  tenantSlug?: string | null;
  slug?: string | null;
  widgetToken?: string | null;
}
