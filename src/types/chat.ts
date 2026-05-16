// src/types/chat.ts
export interface AttachmentInfo {
  name: string;
  url: string;
  thumbUrl?: string;
  thumb_url?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  size?: number;
}
// Define cómo es un objeto Boton
export interface Boton {
  texto: string;
  url?: string;
  accion_interna?: string; // Para acciones que el frontend debe interpretar sin enviar al backend (ej. abrir panel)
  action?: string; // Valor que se envía al backend cuando se hace clic en el botón
  action_id?: string; // Compatibilidad con 'action_id' enviado desde algunos endpoints del backend
  payload?: any;
}

// Nuevo: Define la estructura para una categoría de botones
export interface Categoria {
  titulo: string; // Título de la categoría que se mostrará en el acordeón
  botones: Boton[]; // Array de botones dentro de esa categoría
}

// Nuevo: Define la estructura para contenido estructurado dentro de un mensaje
export interface StructuredContentItem {
  label: string; // Etiqueta del dato, ej. "Precio", "Stock"
  value: string | number; // Valor del dato
  type?: "text" | "quantity" | "price" | "date" | "url" | "badge"; // Tipo de dato para formateo/estilo
  unit?: string; // ej. "kg", "unidades", "cajas" (para type 'quantity')
  currency?: string; // ej. "ARS", "USD" (para type 'price')
  url?: string; // Si el valor debe ser un enlace (especialmente si type es 'url')
  styleHint?:
    | "normal"
    | "bold"
    | "italic"
    | "highlight"
    | "success"
    | "warning"
    | "danger"; // Sugerencia de estilo para el valor
  badgeVariant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning"; // Para type 'badge'
}

// Nuevo: Define la estructura de un Post (Evento o Noticia)
export interface Post {
  id: number | string;
  titulo: string;
  subtitulo?: string;
  contenido: string;
  tipo_post: "noticia" | "evento";
  imagen_url?: string;
  image?: string; // compatibilidad con "image"
  imageUrl?: string; // alias adicional para imagen
  thumbnail_url?: string;
  thumbnailUrl?: string;
  fecha_evento_inicio?: string; // ISO 8601 string
  fecha_evento_fin?: string; // ISO 8601 string
  url?: string; // Un enlace principal
  enlace?: string; // alias para URL
  link?: string; // alias adicional
  facebook?: string; // enlaces opcionales a redes
  instagram?: string;
  youtube?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface MenuRow {
  id: string;
  title: string;
  description?: string;
}

export interface MenuSection {
  title?: string;
  rows: MenuRow[];
}

export interface InteractiveListConfig {
  buttonLabel: string;
  title?: string; // Title for the list/modal header
  sections: MenuSection[];
}

// Define cómo es un objeto Mensaje

export interface ChatUxChannelCapabilities {
  supports_audio_input?: boolean;
  supports_file_upload?: boolean;
  supports_image_input?: boolean;
  supports_location_share?: boolean;
  supports_realtime?: boolean;
  audio_input_label?: string;
  file_upload_label?: string;
  image_input_label?: string;
  location_share_label?: string;
  realtime_label?: string;
}

export type ChatComposerInputMode = "text" | "image" | "audio" | "location" | "file" | string;

export interface ChatMediaComposerAction {
  id: string;
  type: ChatComposerInputMode;
  icon?: string | null;
  label: string;
}

export interface ChatMediaInputModeConfig {
  enabled?: boolean;
  chat_endpoint?: string | null;
  upload_endpoint?: string | null;
  payload_key?: string | null;
  upload_response_key?: string | null;
  chat_payload_key?: string | null;
  multipart_field?: string | null;
  max_seconds?: number | null;
  fields?: string[];
}

export interface ChatMediaCapabilities {
  version?: string | null;
  composer?: {
    placeholder?: string | null;
    actions?: ChatMediaComposerAction[];
    states?: string[];
  } | null;
  input_modes?: Record<string, ChatMediaInputModeConfig>;
}

export interface ChatRubroToolResource {
  id?: string | null;
  key?: string | null;
  label?: string | null;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  url?: string | null;
  href?: string | null;
  download_url?: string | null;
  action_url?: string | null;
  deeplink?: string | null;
  wa_deeplink?: string | null;
  maps_url?: string | null;
  google_maps_url?: string | null;
  action_label?: string | null;
  cta_label?: string | null;
  type?: string | null;
  [key: string]: unknown;
}

export interface ChatRubroToolLocation {
  id?: string | null;
  label?: string | null;
  name?: string | null;
  address?: string | null;
  direccion?: string | null;
  lat?: string | number | null;
  lng?: string | number | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  maps_url?: string | null;
  google_maps_url?: string | null;
  map_url?: string | null;
  action_url?: string | null;
  url?: string | null;
  href?: string | null;
  action_label?: string | null;
  cta_label?: string | null;
  [key: string]: unknown;
}

export interface ChatRubroToolField {
  label?: string | null;
  title?: string | null;
  key?: string | null;
  name?: string | null;
  value?: string | number | boolean | null;
  text?: string | number | boolean | null;
  detail?: string | number | boolean | null;
  [key: string]: unknown;
}

export interface ChatRubroTool {
  id?: string | null;
  key?: string | null;
  type?: string | null;
  kind?: string | null;
  label?: string | null;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  action_label?: string | null;
  cta_label?: string | null;
  action_url?: string | null;
  url?: string | null;
  href?: string | null;
  deeplink?: string | null;
  wa_deeplink?: string | null;
  maps_url?: string | null;
  google_maps_url?: string | null;
  fields?: ChatRubroToolField[] | Record<string, unknown>;
  items?: unknown[];
  resources?: ChatRubroToolResource[];
  price_resources?: ChatRubroToolResource[];
  locations?: ChatRubroToolLocation[];
  contact?: Record<string, unknown> | null;
  hours?: unknown;
  faq_preview?: unknown[];
  frontend_contract?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface ChatRubroToolsContract {
  contract_version?: string | null;
  sector?: string | null;
  rubro?: string | null;
  tenant_slug?: string | null;
  display_name?: string | null;
  tools?: ChatRubroTool[];
  enabled_tools?: ChatRubroTool[];
  resources?: ChatRubroToolResource[];
  price_resources?: ChatRubroToolResource[];
  locations?: ChatRubroToolLocation[];
  contact?: Record<string, unknown> | null;
  hours?: unknown;
  faq_preview?: unknown[];
  frontend_contract?: {
    render_as?: string | null;
    source_path?: string | null;
    hide_disabled_tools?: boolean | null;
    open_maps_with?: string | null;
    do_not_invent_missing_tools?: boolean | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface ChatUxRecommendedExperience {
  supports_confirmation_cards?: boolean;
  supports_multimodal_intake?: boolean;
  preferred_handoff_channels?: string[];
  label?: string;
  summary_text?: string;
}

export interface ConfirmationCardField {
  label: string;
  value: string | number;
}

export interface ConfirmationCardItem {
  label?: string;
  description?: string;
  quantity?: string | number;
  amount?: string | number;
}

export interface ConfirmationCardData {
  title?: string;
  subtitle?: string;
  summary_text?: string;
  summary_voice?: string;
  flow_type?: string;
  status?: string;
  contact?: string;
  location?: string;
  category?: string;
  detail?: string;
  total?: string | number;
  currency?: string;
  fields?: ConfirmationCardField[];
  items?: ConfirmationCardItem[];
  preferred_handoff_channels?: string[];
  raw?: Record<string, unknown>;
}

export interface ChatUxContext {
  trusted_owner?: boolean;
  owner_tipo_chat?: "municipio" | "pyme" | string;
  owner_name?: string;
  should_render_demo_shell?: boolean;
  demo_selector?: {
    mode?: string;
    items?: Array<Record<string, unknown>>;
  } | null;
  suggested_next_actions?: Array<Record<string, unknown>>;
  visibility_rules?: Record<
    string,
    boolean | string | number | null | undefined
  >;
  channel_capabilities?: ChatUxChannelCapabilities;
  recommended_experience?: ChatUxRecommendedExperience;
}

export interface ChatLeadCaptureField {
  id?: string;
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string | null;
  options?: Array<{ label?: string; value?: string }>;
}

export interface ChatLeadCaptureConfig {
  enabled?: boolean;
  title?: string | null;
  fields?: ChatLeadCaptureField[];
  required_fields?: string[];
  required_any_of?: string[][];
  submit_contract?: string | null;
  trigger_intents?: string[];
  endpoint?: string | null;
  success_message?: string | null;
}

export interface ChatConversionCtaAction {
  id: string;
  label: string;
  intent?: string | null;
  endpoint?: string | null;
  show_when?: string[];
  style?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface ChatConversionCtasConfig {
  version?: string | null;
  actions?: ChatConversionCtaAction[];
  rules?: {
    max_visible?: number | null;
    prefer_backend_labels?: boolean | null;
    fallback_behavior?: string | null;
    preserve_context_on_click?: boolean | null;
  } | null;
}

export interface ChatExperienceBlock {
  id?: string | null;
  title?: string | null;
  label?: string | null;
  detail?: string | null;
  description?: string | null;
  subtitle?: string | null;
  text?: string | null;
  intent?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface ChatExperienceBlueprint {
  version?: string | null;
  hero?: ChatExperienceBlock | null;
  first_visit?: ChatExperienceBlock | null;
  quick_actions?: ChatExperienceBlock[];
  sample_conversations?: ChatExperienceBlock[];
  trust_signals?: ChatExperienceBlock[];
  channels?: ChatExperienceBlock[];
  lead_capture?: ChatLeadCaptureConfig | null;
  media_capabilities?: ChatMediaCapabilities | null;
  conversion_ctas?: ChatConversionCtasConfig | null;
  animation_tokens?: ChatAnimationTokens | null;
  empty_states?: Record<string, ChatExperienceBlock>;
  component_pack?: string[] | ChatExperienceBlock[];
  agent_copilot?: {
    suggestions?: ChatExperienceBlock[];
  } | null;
}

export interface ChatAnimationTokens {
  version?: string | null;
  respect_reduced_motion?: boolean | null;
  motion_level?: string | null;
  events?: Array<{
    id?: string;
    trigger?: string;
    pattern?: string;
    duration_ms?: number;
  }>;
}

export interface ChatWidgetOnboardingOption {
  id?: string | null;
  key?: string | null;
  value?: string | null;
  label?: string | null;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  cta_label?: string | null;
  intent?: string | null;
  action?: string | null;
  action_id?: string | null;
  sector?: string | null;
  tenant_slug?: string | null;
  rubro?: string | null;
  slug?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface ChatWidgetOnboarding {
  contract_version?: string | null;
  mode?: string | null;
  status?: string | null;
  title?: string | null;
  entry_question?: string | null;
  required_step?: string | null;
  autostart_after_selection?: boolean | null;
  selection_endpoint?: string | null;
  catalog_endpoint?: string | null;
  chat_header_policy?: string | null;
  open_chat?: boolean | null;
  close_selector?: boolean | null;
  send_init_once?: boolean | null;
  rubro_selector?: Record<string, unknown> | null;
  default_menu?: unknown;
  quick_menu?: ChatWidgetOnboardingOption[];
}

export interface ChatWidgetUiHints {
  contract_version?: string | null;
  density?: string | null;
  max_visible_quick_replies?: number | null;
  collapse_extra_quick_replies?: boolean | null;
  composer?: {
    single_row_actions?: boolean | null;
    icon_buttons_only?: boolean | null;
    show_labels_on_hover?: boolean | null;
    hide_disabled_actions?: boolean | null;
    send_button_always_visible?: boolean | null;
  } | null;
  toolbar?: {
    position?: string | null;
    avoid_header_action_overload?: boolean | null;
    show?: string[];
    collapse?: string[];
  } | null;
  accessibility?: {
    dyslexia?: boolean | null;
    dyslexia_mode?: boolean | null;
    dyslexia_friendly?: boolean | null;
    simple_text?: boolean | null;
    simplified_text?: boolean | null;
    high_contrast?: boolean | null;
    large_controls?: boolean | null;
    captions?: boolean | null;
    reduced_motion?: boolean | null;
    min_touch_target_px?: number | null;
    [key: string]: string | number | boolean | null | undefined;
  } | null;
}

export interface Message {
  id: number | string; // Identificador único del mensaje
  text: string; // Texto principal o fallback del mensaje. Puede ser HTML sanitizado.
  isBot: boolean; // True si el mensaje es del bot, false si es del usuario
  timestamp: Date; // Fecha y hora del mensaje
  origen?: "chat" | "email"; // Nuevo campo para diferenciar el origen del mensaje
  messageType?: string; // Tipo de mensaje enviado por backend (catalog_share, interactive_list, etc.)
  action?: string; // Acción asociada al mensaje
  data?: Record<string, unknown> | null; // Payload adicional para renderizado estructurado
  botones?: Boton[]; // Array de botones interactivos asociados al mensaje (si los hay)
  categorias?: Categoria[]; // Array de categorías con botones (formato anidado para acordeones)
  menu_sections?: MenuSection[]; // Sections for structured menus
  interactive_list?: InteractiveListConfig; // Config for opening a list in a drawer/modal
  query?: string; // La consulta original del usuario que generó esta respuesta (opcional)
  isError?: boolean; // Indica si el mensaje representa un estado de error
  ticketId?: number; // Ticket asociado cuando el backend crea uno

  // Campos para contenido multimedia y adjuntos
  mediaUrl?: string; // URL directa a una imagen/video (para compatibilidad o casos simples)
  audioUrl?: string; // URL a un archivo de audio para ser reproducido
  locationData?: {
    // Datos de ubicación (para mostrar un mapa o coordenadas)
    lat: number;
    lon: number;
    name?: string; // Nombre del lugar (ej. "Plaza Independencia")
    address?: string; // Dirección formateada
  };
  attachmentInfo?: {
    // Información detallada de un archivo adjunto
    id?: string | number;
    name: string; // Nombre del archivo (ej. "documento.pdf")
    url: string; // URL para descargar/visualizar el archivo
    thumbUrl?: string; // URL a una miniatura de la imagen/PDF
    thumb_url?: string;
    thumbnail_url?: string;
    thumbnailUrl?: string;
    mimeType?: string; // Tipo MIME del archivo (ej. "application/pdf", "image/jpeg")
    size?: number; // Tamaño del archivo en bytes (opcional)
    type?: string; // Tipo de adjunto derivado (image, pdf, audio, etc.)
    extension?: string; // Extensión de archivo normalizada
    isUploading?: boolean; // Marca si el adjunto está en proceso de subida
  };

  // Campos para contenido estructurado y personalización de la UI
  structuredContent?: StructuredContentItem[]; // Array de items para mostrar datos clave-valor o tarjetas de información
  displayHint?:
    | "default"
    | "pymeProductCard"
    | "municipalInfoSummary"
    | "genericTable"
    | "compactList"; // Sugerencia para el frontend sobre cómo renderizar la totalidad del mensaje
  chatBubbleStyle?: "standard" | "compact" | "emphasis" | "alert"; // Para controlar el estilo visual de la burbuja del mensaje
  posts?: Post[]; // Array de posts para mostrar como tarjetas de eventos/noticias
  socialLinks?: Record<string, string>; // Enlaces generales a redes sociales
  listItems?: string[]; // Lista de elementos para mostrar como viñetas numeradas o con emojis
  confirmationCard?: ConfirmationCardData;
}

// --- INTERFAZ PARA EL PAYLOAD DE ENVÍO DE MENSAJES (lo que el usuario envía al bot) ---
export interface SendPayload {
  text: string; // Texto del mensaje del usuario

  /**
   * Indica desde qué parte de la interfaz se originó el mensaje.
   * Permite ajustar el payload que se envía al backend (ej. preservar emojis en botones).
   */
  source?: "input" | "button" | "system";

  // Para adjuntos que el usuario envía (el backend los procesa y puede devolver un Message con attachmentInfo)
  es_foto?: boolean; // Deprecar en favor de attachmentInfo con mimeType. Indica si el adjunto es una foto.
  archivo_url?: string; // Deprecar en favor de attachmentInfo. URL del archivo subido por el usuario.

  es_ubicacion?: boolean; // True si el payload incluye datos de ubicación del usuario
  ubicacion_usuario?: { lat: number; lon: number }; // Coordenadas si es_ubicacion es true
  location?: { lat: number; lon: number }; // NUEVO: Para el envío de ubicación desde el widget
  audioBlob?: Blob;
  audioFilename?: string;
  audioField?: string;
  audioEndpoint?: string;

  action?: string; // Si el envío es resultado de un clic en un botón con una acción específica que el backend debe procesar
  action_id?: string; // ID de acción explícito para compatibilidad con payloads interactivos del backend
  payload?: any; // Datos adicionales asociados a la acción del botón

  attachmentInfo?: {
    // Información del archivo que el usuario está adjuntando (antes de que el backend lo confirme)
    name: string;
    url: string; // URL temporal o final del archivo subido por el usuario
    thumbUrl?: string;
    thumb_url?: string;
    thumbnail_url?: string;
    thumbnailUrl?: string;
    mimeType?: string;
    size?: number;
  };
}
