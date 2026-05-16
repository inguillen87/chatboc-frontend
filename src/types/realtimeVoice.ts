export type RealtimeVoiceVertical = "municipio" | "pyme" | "colegio" | "general" | string;

export interface RealtimeVoiceTransports {
  browser?: "webrtc" | string;
  server?: "websocket" | string;
  phone_primary?: "openai_realtime_sip" | string;
  phone_bridge?: "twilio_media_streams" | string;
  sip_ready?: boolean;
  [key: string]: string | boolean | null | undefined;
}

export interface RealtimeVoiceFeatures {
  barge_in?: boolean;
  semantic_vad?: boolean;
  server_vad?: boolean;
  tool_calling?: boolean;
  whatsapp_followup?: boolean;
  post_call_receipt?: boolean;
  human_handoff?: boolean;
  multilingual?: boolean;
  respond_in_user_language?: boolean;
  normalize_operational_fields_es?: boolean;
  live_video_analysis?: boolean;
  video_analysis_ready?: boolean;
  multimodal_capture?: boolean;
  [key: string]: string | number | boolean | null | undefined;
}

export interface RealtimeVoiceToolContract {
  id?: string | null;
  name?: string | null;
  label?: string | null;
  title?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  [key: string]: unknown;
}

export interface RealtimeVoiceLanguagePolicy {
  detect_language?: boolean | null;
  respond_in_user_language?: boolean | null;
  normalize_operational_fields_language?: string | null;
  supported_languages?: string[];
  [key: string]: unknown;
}

export interface RealtimeVoiceChannelCapability {
  enabled?: boolean | null;
  channel?: string | null;
  provider?: string | null;
  session_endpoint?: string | null;
  capabilities?: RealtimeVoiceCapabilities | null;
  features?: RealtimeVoiceFeatures | null;
  [key: string]: unknown;
}

export interface RealtimeVoiceSupportChannels {
  voice_call?: RealtimeVoiceChannelCapability | null;
  video_call?: RealtimeVoiceChannelCapability | null;
  [key: string]: unknown;
}

export interface RealtimeVoiceCapabilities {
  contract_version?: "realtime.voice_capabilities.v1" | string;
  enabled?: boolean | null;
  reason_code?: string | null;
  action_hint?: string | null;
  provider?: "openai_realtime" | string;
  recommended_model?: string | null;
  fallback_model?: string | null;
  voice?: string | null;
  active_vertical?: RealtimeVoiceVertical | null;
  native_speech_to_speech?: boolean | null;
  avoid_external_stt_tts_loop?: boolean | null;
  transports?: RealtimeVoiceTransports | null;
  features?: RealtimeVoiceFeatures | null;
  support_channels?: RealtimeVoiceSupportChannels | null;
  tools?:
    | RealtimeVoiceToolContract[]
    | Record<string, RealtimeVoiceToolContract | string | boolean | null>
    | null;
  tool_catalog?:
    | RealtimeVoiceToolContract[]
    | Record<string, RealtimeVoiceToolContract | string | boolean | null>
    | null;
  actions?:
    | RealtimeVoiceToolContract[]
    | Record<string, RealtimeVoiceToolContract | string | boolean | null>
    | null;
  verticals?: Record<
    string,
    {
      actions?:
        | RealtimeVoiceToolContract[]
        | Record<string, RealtimeVoiceToolContract | string | boolean | null>
        | null;
      tools?:
        | RealtimeVoiceToolContract[]
        | Record<string, RealtimeVoiceToolContract | string | boolean | null>
        | null;
      tool_catalog?:
        | RealtimeVoiceToolContract[]
        | Record<string, RealtimeVoiceToolContract | string | boolean | null>
        | null;
      [key: string]: unknown;
    } | null
  > | null;
  language_policy?: RealtimeVoiceLanguagePolicy | null;
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
