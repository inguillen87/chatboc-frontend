export interface CustomerProfile {
  name?: string | null;
  display_name?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_key?: string | null;
  channel_group?: string | null;
  whatsapp?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  picture?: string | null;
  avatar_source?: string | null;
  avatarSource?: string | null;
  avatar_consent?: boolean | string | number | null;
  avatarConsent?: boolean | string | number | null;
  profile_picture_consent?: boolean | string | number | null;
  avatar_policy?: string | null;
  fallback?: string | null;
  identity?: Record<string, unknown> | null;
}

export interface CommercialState {
  stage?: string | null;
  channel?: string | null;
  supports_handoff?: boolean | null;
  continuation_available?: boolean | null;
}

export interface AssistedCatalogCandidate {
  id?: string | number | null;
  catalogo_item_id?: string | number | null;
  product_id?: string | number | null;
  sku?: string | null;
  codigo?: string | null;
  code?: string | null;
  nombre?: string | null;
  name?: string | null;
  title?: string | null;
  label?: string | null;
  precio?: string | number | null;
  price?: string | number | null;
  precio_unitario?: string | number | null;
  unit_price?: string | number | null;
  price_label?: string | null;
  precio_str?: string | null;
  moneda?: string | null;
  currency?: string | null;
  unidad?: string | null;
  score?: string | number | null;
  confidence?: 'high' | 'medium' | 'low' | string | null;
  reason?: string | null;
  match_reason?: string | null;
  motivo?: string | null;
  href?: string | null;
  url?: string | null;
  product_url?: string | null;
  reference_url?: string | null;
  admin_url?: string | null;
  public_url?: string | null;
  permalink?: string | null;
  reference?: string | number | null;
  [key: string]: unknown;
}

export interface AssistedCatalogCandidateGroup {
  item?: string | null;
  item_label?: string | null;
  requested_item?: string | null;
  query?: string | null;
  text?: string | null;
  row?: Record<string, unknown> | null;
  candidates?: AssistedCatalogCandidate[];
  catalog_candidates?: AssistedCatalogCandidate[];
  suggested_candidates?: AssistedCatalogCandidate[];
  alternatives?: AssistedCatalogCandidate[];
  alternativas?: AssistedCatalogCandidate[];
  [key: string]: unknown;
}

export interface CrmOrderDraftLine {
  line_id?: string | null;
  status?: 'catalog_matched' | 'needs_catalog_resolution' | 'needs_review' | string | null;
  source_name?: string | null;
  quantity?: string | number | null;
  unit?: string | null;
  sku?: string | null;
  catalog_item_id?: string | number | null;
  catalog_match?: AssistedCatalogCandidate | null;
  candidate_count?: number | null;
  needs_operator_review?: boolean | null;
  [key: string]: unknown;
}

export interface CrmOrderDraft {
  contract_version?: string | null;
  request_kind?: string | null;
  request_kind_label?: string | null;
  target_module?: string | null;
  recommended_record?: string | null;
  recommended_next_step?: string | null;
  needs_operator_review?: boolean | null;
  pedido_id?: string | number | null;
  lead_id?: string | number | null;
  reference?: string | null;
  contact_state?: string | null;
  contact?: Record<string, unknown> | null;
  source?: Record<string, unknown> | null;
  lines?: CrmOrderDraftLine[];
  catalog_candidate_groups?: number | null;
  summary?: {
    detected?: number | null;
    matched?: number | null;
    unmatched?: number | null;
    has_contact?: boolean | null;
    needs_operator_review?: boolean | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface CrmOperatorAction {
  id?: string | null;
  label?: string | null;
  type?: string | null;
  method?: string | null;
  target_status?: string | null;
  href?: string | null;
  enabled?: boolean | null;
  requires_review?: boolean | null;
  creates?: string[];
  description?: string | null;
  [key: string]: unknown;
}

export interface CrmReviewCard {
  contract_version?: 'marketplace.crm_review_card.v1' | string | null;
  reference?: string | null;
  request_kind?: string | null;
  request_kind_label?: string | null;
  status?: 'needs_review' | 'ready_to_reply' | string | null;
  priority?: 'high' | 'normal' | string | null;
  primary_intent?: string | null;
  needs_operator_review?: boolean | null;
  operational_state?: string | null;
  primary_action_id?: string | null;
  contact_state?: string | null;
  recommended_next_step?: string | null;
  summary?: {
    detected?: number | null;
    matched?: number | null;
    unmatched?: number | null;
    needs_operator_review?: boolean | null;
    [key: string]: unknown;
  } | null;
  source?: {
    channel?: string | null;
    input_type?: string | null;
    archivo_url?: string | null;
    archivo_nombre?: string | null;
    thumbnail_url?: string | null;
    text_preview?: string | null;
    [key: string]: unknown;
  } | null;
  contact?: (CustomerProfile & { notes?: string | null }) | Record<string, unknown> | null;
  lines?: CrmOrderDraftLine[];
  unmatched_items?: string[];
  catalog_candidates?: AssistedCatalogCandidateGroup[];
  suggested_reply?: string | null;
  suggested_tasks?: Array<{
    id?: string | null;
    label?: string | null;
    description?: string | null;
    tone?: string | null;
  }>;
  contact_links?: Array<{
    type?: string | null;
    label?: string | null;
    href?: string | null;
  }>;
  next_actions?: Array<Record<string, unknown>>;
  operator_actions?: CrmOperatorAction[];
  customer_next_steps?: Array<{
    id?: string | null;
    label?: string | null;
    description?: string | null;
    status?: string | null;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface AssistedOrderRequest {
  contract_version?: string | null;
  mode?: string | null;
  crm_state?: string | null;
  request_kind?: string | null;
  request_kind_label?: string | null;
  document_profile?: {
    kind?: string | null;
    label?: string | null;
    crm_type?: string | null;
    primary_intent?: string | null;
    catalog_matching?: boolean | null;
    input_type?: string | null;
    input_mode?: string | null;
    operator_goal?: string | null;
    supports_anonymous_intake?: boolean | null;
    [key: string]: unknown;
  } | null;
  structured_extraction?: {
    contract_version?: string | null;
    primary_intent?: string | null;
    catalog_matching?: boolean | null;
    confidence?: string | null;
    fields?: Record<string, unknown>;
    missing_fields?: string[];
    source?: string | null;
    [key: string]: unknown;
  } | null;
  crm_handoff?: {
    contract_version?: string | null;
    primary_intent?: string | null;
    operator_goal?: string | null;
    target_module?: string | null;
    recommended_record?: string | null;
    contact?: Record<string, unknown> | null;
    source?: Record<string, unknown> | null;
    structured_extraction?: Record<string, unknown> | null;
    draft_ticket?: Record<string, unknown> | null;
    draft_task?: Record<string, unknown> | null;
    draft_order?: Record<string, unknown> | null;
    draft_assisted_order?: Record<string, unknown> | null;
    [key: string]: unknown;
  } | null;
  crm_order_draft?: CrmOrderDraft | null;
  crm_review_card?: CrmReviewCard | null;
  contact?: (CustomerProfile & { notes?: string | null }) | null;
  source?: {
    channel?: string | null;
    input_type?: string | null;
    archivo_url?: string | null;
    archivo_nombre?: string | null;
    original_filename?: string | null;
    mime_type?: string | null;
    file_size_bytes?: number | null;
    text_preview?: string | null;
    request_kind?: string | null;
    request_kind_label?: string | null;
    extraction_error?: string | null;
    [key: string]: unknown;
  } | null;
  match_summary?: {
    matched?: number | null;
    unmatched?: number | null;
    detected?: number | null;
    needs_operator_review?: boolean | null;
    [key: string]: unknown;
  } | null;
  review_context?: {
    contract_version?: string | null;
    primary_intent?: string | null;
    operator_goal?: string | null;
    review_reasons?: string[];
    priority?: string | null;
    priority_reason?: string | null;
    priority_reason_label?: string | null;
    sla_hint?: Record<string, unknown> | string | null;
    operator_queue?: string | null;
    operator_queue_label?: string | null;
    primary_missing_field?: string | null;
    missing_fields?: string[] | null;
    catalog_matching_enabled?: boolean | null;
    catalog_candidate_groups?: number | null;
    recommended_channels?: string[];
    summary?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  row_errors?: Array<Record<string, unknown>>;
  extraction_error?: string | null;
  next_actions?: Array<Record<string, unknown>>;
  public_follow_up?: {
    contract_version?: string | null;
    tracking?: {
      kind?: string | null;
      code?: string | null;
      path?: string | null;
      api_endpoint?: string | null;
      label?: string | null;
      [key: string]: unknown;
    } | null;
    channels?: Array<{
      id?: string | null;
      label?: string | null;
      type?: string | null;
      href?: string | null;
      description?: string | null;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  } | null;
  operator_pack?: {
    priority?: 'high' | 'normal' | string | null;
    priority_reason?: string | null;
    priority_reason_label?: string | null;
    sla_hint?: Record<string, unknown> | string | null;
    operator_queue?: string | null;
    operator_queue_label?: string | null;
    target_module?: string | null;
    primary_missing_field?: string | null;
    missing_fields?: string[] | null;
    reference?: string | null;
    suggested_reply?: string | null;
    needs_human_review?: boolean | null;
    suggested_tasks?: Array<{
      id?: string | null;
      label?: string | null;
      description?: string | null;
      tone?: string | null;
    }>;
    contact_links?: Array<{
      type?: string | null;
      label?: string | null;
      href?: string | null;
    }>;
    [key: string]: unknown;
  } | null;
  operator_intake_summary?: {
    contract_version?: string | null;
    title?: string | null;
    objective?: string | null;
    primary_intent?: string | null;
    target_module?: string | null;
    recommended_record?: string | null;
    recommended_next_step?: string | null;
    needs_operator_review?: boolean | null;
    priority?: string | null;
    priority_reason?: string | null;
    priority_reason_label?: string | null;
    sla_hint?: Record<string, unknown> | string | null;
    operator_queue?: string | null;
    operator_queue_label?: string | null;
    primary_missing_field?: string | null;
    missing_fields?: string[] | null;
    contact_state?: string | null;
    contact_channels?: string[] | null;
    input?: Record<string, unknown> | null;
    detected_preview?: string[] | null;
    match_summary?: Record<string, unknown> | null;
    follow_up?: Record<string, unknown> | null;
    [key: string]: unknown;
  } | null;
  intake_experience?: {
    contract_version?: string | null;
    render_as?: string | null;
    title?: string | null;
    summary?: string | null;
    anonymous_intake?: boolean | null;
    customer_has_contact?: boolean | null;
    catalog_matching?: boolean | null;
    needs_operator_review?: boolean | null;
    input_examples?: string[];
    capabilities?: Array<{
      id?: string | null;
      label?: string | null;
      description?: string | null;
      status?: string | null;
      [key: string]: unknown;
    }>;
    pipeline?: Array<{
      id?: string | null;
      label?: string | null;
      description?: string | null;
      status?: string | null;
      [key: string]: unknown;
    }>;
    customer_prompts?: Array<{
      id?: string | null;
      label?: string | null;
      document_type?: string | null;
      [key: string]: unknown;
    }>;
    crm_handoff?: {
      label?: string | null;
      recommended_next_action?: string | null;
      channels?: string[];
      [key: string]: unknown;
    } | null;
    frontend_contract?: Record<string, unknown> | null;
    [key: string]: unknown;
  } | null;
  customer_message?: string | null;
  customer_next_steps?: Array<{
    id?: string | null;
    label?: string | null;
    description?: string | null;
    status?: string | null;
    [key: string]: unknown;
  }>;
  detected_items?: Array<Record<string, unknown>>;
  catalog_candidates?: AssistedCatalogCandidateGroup[];
  suggested_candidates?: AssistedCatalogCandidateGroup[] | AssistedCatalogCandidate[];
  candidate_groups?: AssistedCatalogCandidateGroup[];
  product_candidates?: AssistedCatalogCandidateGroup[];
  unmatched_items?: string[];
  raw_unmatched_rows?: Array<
    Record<string, unknown> & {
      catalog_candidates?: AssistedCatalogCandidate[];
      candidates?: AssistedCatalogCandidate[];
      suggested_candidates?: AssistedCatalogCandidate[];
    }
  >;
}

export interface Order {
  id: string | number;
  tenant_id?: string;
  user_id?: string;
  total: number;
  status: string;
  items: OrderItem[];
  created_at: string;
  updated_at?: string;
  channel?: string;
  notes?: string;
  // Customer Info
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  contact_name?: string; // Payload alias
  // Dispatch Info
  dispatch_email?: string;
  dispatch_phone?: string;
  // External Refs
  externalId?: string;
  externalUrl?: string;
  external_refs?: Record<string, string | number | null | undefined> | null;
  source_model?: string | null;
  market_order_id?: string | number | null;
  order_id?: string | number | null;
  preference_id?: string | null;
  init_point?: string | null;
  tipo?: string | null;
  customer_profile?: CustomerProfile | null;
  customer_identity?: CustomerProfile | Record<string, unknown> | null;
  commercial_state?: CommercialState | null;
  commercial_stage?: string | null;
  contact?: CustomerProfile | null;
  assisted_request?: AssistedOrderRequest | null;
  crm_review_card?: CrmReviewCard | null;
  metadata?: Record<string, unknown> | null;
  totals?: {
    monetary?: number | null;
    subtotal?: number | null;
    total?: number | null;
    currency?: string | null;
  } | null;
}

export interface OrderOperationalSummary {
  contract_version?: 'orders.unified_summary.v1' | string;
  total?: number;
  page_limit?: number | null;
  sources?: string[];
  by_source_model?: Record<string, number>;
  by_status?: Record<string, number>;
  by_commercial_stage?: Record<string, number>;
  by_channel?: Record<string, number>;
  by_operational_state?: Record<string, number>;
  by_operator_queue?: Record<string, number>;
  assisted_requests?: number;
  needs_operator_review?: number;
  ready_for_order_creation?: number;
  ready_to_reply?: number;
  totals?: {
    monetary?: number | null;
    points?: number | null;
  } | null;
  latest_activity_at?: string | null;
  crm_focus?: {
    has_assisted_intake?: boolean;
    has_operator_review_queue?: boolean;
    has_ready_order_creation?: boolean;
    primary_next_action?: string | null;
    [key: string]: unknown;
  } | null;
}

export interface AdminOrdersResponse {
  orders: Order[];
  count: number;
  total: number;
  sources: string[];
  summary?: OrderOperationalSummary | null;
}

export interface OrderItem {
  id: string | number;
  product_id?: string | number | null;
  quantity: number;
  price: number;
  name: string;
  title?: string;
  unit_price?: number;
  subtotal?: number;
  currency?: string;
  sku?: string;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
  totalPoints?: number;
}

export interface CartItem {
  id: string | number;
  product_id: string | number;
  quantity: number;
  price: number;
  name?: string;
}

export interface Ticket {
  id: string | number;
  subject: string;
  status: 'open' | 'closed' | 'pending';
  created_at: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string | number;
  content: string;
  sender: 'user' | 'agent';
  timestamp: string;
}

// Enhanced Portal Content Types
export interface PortalNotification {
  id: string;
  title: string;
  message: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  actionLabel?: string;
  actionHref?: string;
  date?: string;
  read?: boolean;
}

export interface PortalEvent {
  id: string;
  title: string;
  date?: string;
  location?: string;
  status?: string;
  description?: string;
  spots?: number;
  registered?: number;
  coverUrl?: string;
  link?: string;
}

export interface PortalNews {
  id: string;
  title: string;
  category?: string;
  date?: string;
  summary?: string;
  featured?: boolean;
  coverUrl?: string;
  link?: string;
}

export interface PortalCatalogItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  priceLabel?: string;
  price?: number;
  status?: string;
  imageUrl?: string;
  link?: string;
}

export interface PortalActivity {
  id: string;
  description: string;
  type?: string; // 'pedido', 'reclamo', etc.
  status?: string;
  statusType?: 'info' | 'success' | 'warning' | 'error';
  date?: string;
  link?: string;
}

export interface PortalSurvey {
  id: string;
  title: string;
  link?: string;
}

export interface LoyaltyTransaction {
  id: string;
  description: string;
  points: number;
  date: string;
  type: 'earned' | 'redeemed';
}

export interface LoyaltyReward {
  id: string;
  title: string;
  cost: number;
  type: string;
  description?: string;
}

export interface PortalLoyaltySummary {
  points: number;
  level: string;
  surveysCompleted: number;
  suggestionsShared: number;
  claimsFiled: number;
  hasParticipationMetrics?: boolean;
  transactions?: LoyaltyTransaction[];
  availableRewards?: LoyaltyReward[];
}

export interface PortalQuickAction {
  id: string;
  label: string;
  description?: string;
  href?: string;
}

export interface PortalModuleCard {
  id: string;
  title: string;
  description?: string;
  href?: string;
  badge?: string;
}

export interface PortalBundleSummarySection {
  items?: any[];
  open_count?: number;
  active_count?: number;
  total_spent?: number;
  available?: number;
  history?: any[];
  wallet?: Record<string, unknown> | null;
  benefits?: any[];
  redeems?: any[];
  [key: string]: unknown;
}

export interface PortalPremiumBundle {
  member?: Record<string, unknown> | null;
  club?: Record<string, unknown> | null;
  orders?: PortalBundleSummarySection | null;
  claims?: PortalBundleSummarySection | null;
  promotions?: PortalBundleSummarySection | null;
  surveys?: PortalBundleSummarySection | null;
  rewards?: PortalBundleSummarySection | null;
  suggestions?: PortalBundleSummarySection | null;
  history?: { timeline?: any[]; [key: string]: unknown } | null;
  highlights?: Array<Record<string, unknown>> | null;
  quick_actions?: Array<Record<string, unknown>> | null;
  modules?: Array<Record<string, unknown>> | null;
}

export interface PortalContent {
  notifications: PortalNotification[];
  events: PortalEvent[];
  news: PortalNews[];
  catalog: PortalCatalogItem[];
  activities: PortalActivity[];
  surveys: PortalSurvey[];
  loyaltySummary: PortalLoyaltySummary | null;
}

export interface IntegrationStatus {
  provider: 'mercadolibre' | 'tiendanube' | 'whatsapp';
  connected: boolean;
  lastSync?: string;
}
