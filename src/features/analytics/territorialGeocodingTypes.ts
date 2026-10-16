export const TERRITORIAL_GEOCODING_CONTRACT = 'operations.territorial_geocoding_admin.v1' as const;
export const TERRITORIAL_GEOCODING_SYNC_CONTRACT = 'operations.territorial_geocoding_sync.v1' as const;
export const TERRITORIAL_GEOCODING_PREVIEW_CONTRACT = 'operations.territorial_geocoding_preview.v1' as const;
export const TERRITORIAL_GEOCODING_EXECUTION_CONTRACT = 'operations.territorial_geocoding_execution.v1' as const;

export type TerritorialReviewDecision = 'approved' | 'rejected';
export type TerritorialReviewState = 'unreviewed' | 'approved' | 'rejected' | 'stale';
export type TerritorialTicketSourceModel = 'TenantTicket' | 'MunicipioTicket' | 'PymeTicket';

export interface TerritorialProposalVersion {
  attemptId: string;
  attemptNumber: number;
}

export interface TerritorialProposalExpectation {
  expectedProposalDigest: string;
  expectedAttemptId: string;
  expectedAttemptNumber: number;
}

export interface TerritorialReviewReceipt {
  id: string;
  decision: TerritorialReviewDecision;
  effectiveState: TerritorialReviewState;
  reasonCode: string;
  reviewerUserId: string | null;
  reviewedJobStatus: string;
  proposalCurrent: boolean;
  proposalDigest: string;
  proposalVersion: TerritorialProposalVersion | null;
  coordinateWritePerformed: false;
  createdAt: string | null;
}

export interface TerritorialGeocodingQuality {
  state: string;
  hasProposal: boolean;
  autoApplyEligible: boolean;
  jurisdictionStatus: string | null;
  locationType: string | null;
  partialMatch: boolean | null;
  localityMatch: boolean | null;
  provinceMatch: boolean | null;
  countryMatch: boolean | null;
  issues: string[];
}

export interface TerritorialGeocodingReviewAction {
  href: string | null;
  canApprove: boolean;
  canReject: boolean;
  approvedReasonCodes: string[];
  rejectedReasonCodes: string[];
  coordinateApplicationSupported: false;
}

export interface TerritorialGeocodingExecutionAction {
  href: string | null;
  enabled: boolean;
  reasonCode: string;
  confirmationRequired: boolean;
}

export interface TerritorialGeocodingItem {
  id: string;
  ticketId: string | null;
  sourceModelRaw: string | null;
  ticketSourceModel: TerritorialTicketSourceModel | null;
  status: string;
  reasonCode: string;
  reviewState: TerritorialReviewState;
  latestReview: TerritorialReviewReceipt | null;
  category: string | null;
  zone: string | null;
  quality: TerritorialGeocodingQuality;
  attemptCount: number;
  lastAttemptAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  detailHref: string | null;
  attemptsHref: string | null;
  reviewAction: TerritorialGeocodingReviewAction;
  resolveAction: TerritorialGeocodingExecutionAction;
  applyAction: TerritorialGeocodingExecutionAction;
}

export interface TerritorialGeocodingQueue {
  contractVersion: typeof TERRITORIAL_GEOCODING_CONTRACT;
  requestId: string | null;
  tenantId: string;
  summary: {
    total: number;
    withProposal: number;
    needsHumanReview: number;
    coordinateWritesFromReview: 0;
    byStatus: Record<string, number>;
    byReviewState: Record<string, number>;
    byReasonCode: Record<string, number>;
    byQualityState: Record<string, number>;
  };
  pagination: { page: number; perPage: number; total: number; hasNext: boolean };
  items: TerritorialGeocodingItem[];
  privacy: {
    rawAddressExposed: false;
    addressDigestExposed: false;
    exactCoordinatesExposed: false;
    aggregateListOnly: true;
  };
}

export interface TerritorialProposalValidation {
  autoApplyEligible: boolean;
  issues: string[];
  jurisdictionStatus: string | null;
  localityMatch: boolean | null;
  provinceMatch: boolean | null;
  countryMatch: boolean | null;
}

export interface TerritorialGeocodingProposal {
  lat: number | null;
  lng: number | null;
  locationType: string | null;
  partialMatch: boolean | null;
  provider: string | null;
  providerReferencePresent: boolean;
  coordinateReference: 'WGS84' | null;
  provenance: {
    source: string | null;
    provider: string | null;
    proposalDigest: string | null;
    sourceAddressRetained: false;
  } | null;
  validation: TerritorialProposalValidation;
}

export interface TerritorialGeocodingAttempt {
  id: string;
  attemptNumber: number;
  outcomeStatus: string;
  reasonCode: string;
  provider: string | null;
  externalCallPerformed: boolean;
  coordinateWritePerformed: boolean;
  proposal: Pick<TerritorialGeocodingProposal, 'lat' | 'lng' | 'locationType' | 'partialMatch'> | null;
  validation: TerritorialProposalValidation;
  createdAt: string | null;
}

export interface TerritorialGeocodingDetail {
  contractVersion: typeof TERRITORIAL_GEOCODING_CONTRACT;
  tenantId: string;
  item: TerritorialGeocodingItem;
  proposal: TerritorialGeocodingProposal;
  proposalDigest: string;
  proposalVersion: TerritorialProposalVersion | null;
  attempts: TerritorialGeocodingAttempt[];
  reviews: TerritorialReviewReceipt[];
  privacy: {
    rawAddressExposed: false;
    addressDigestExposed: false;
    exactCoordinatesExposed: boolean;
    exactCoordinatesClassification: 'restricted_operational';
    exactCoordinatesAccess: 'tenant_admin_only';
    providerPlaceIdExposed: false;
    authorizedAdminDetail: true;
  };
  writePolicy: {
    getIsReadOnly: true;
    providerCallPerformed: false;
    coordinateApplicationSupported: true;
    reviewIsHumanDecisionOnly: true;
    applyRequiresSeparateConfirmedPost: true;
  };
}

export interface TerritorialGeocodingAttemptsResponse {
  contractVersion: typeof TERRITORIAL_GEOCODING_CONTRACT;
  tenantId: string;
  jobId: string;
  ticketId: string | null;
  sourceModelRaw: string | null;
  ticketSourceModel: TerritorialTicketSourceModel | null;
  attempts: TerritorialGeocodingAttempt[];
  privacy: {
    rawAddressExposed: false;
    addressDigestExposed: false;
    exactCoordinatesExposed: boolean;
    exactCoordinatesClassification: 'restricted_operational';
    exactCoordinatesAccess: 'tenant_admin_only';
    providerPlaceIdExposed: false;
    authorizedAdminDetail: true;
  };
}

export interface TerritorialGeocodingReviewResponse {
  contractVersion: typeof TERRITORIAL_GEOCODING_CONTRACT;
  action: 'review';
  tenantId: string;
  tenantSlug: string;
  jobId: string;
  proposalDigest: string;
  proposalVersion: TerritorialProposalVersion;
  review: TerritorialReviewReceipt;
  idempotentReplay: boolean;
  providerCallPerformed: false;
  coordinateWritePerformed: false;
}

export interface TerritorialGeocodingQueueParams {
  tenantSlug: string;
  page?: number;
  perPage?: number;
  status?: string;
  reviewState?: TerritorialReviewState;
  sourceModel?: string;
  reasonCode?: string;
  ticketId?: string;
  category?: string;
  zone?: string;
  qualityState?: string;
}

export interface TerritorialGeocodingReviewRequest extends TerritorialProposalExpectation {
  tenantSlug: string;
  jobId: string;
  decision: TerritorialReviewDecision;
  reasonCode: string;
  idempotencyKey: string;
}

export interface TerritorialGeocodingSyncResponse {
  contractVersion: typeof TERRITORIAL_GEOCODING_SYNC_CONTRACT;
  tenantId: string;
  summary: { discovered: number; created: number; existing: number; stale: number; refreshed: number; hidden: number };
  execution: { providerCallPerformed: false; coordinateWritePerformed: false };
  idempotentReplay: boolean;
}

export interface TerritorialGeocodingSyncRequest { tenantSlug: string; idempotencyKey: string }

export interface TerritorialGeocodingExecutionResponse {
  contractVersion: typeof TERRITORIAL_GEOCODING_EXECUTION_CONTRACT;
  tenantId: string;
  tenantSlug: string;
  jobId: string;
  action: 'resolve' | 'apply';
  status: string;
  reasonCode: string;
  proposalDigest: string;
  proposalVersion: TerritorialProposalVersion;
  proposal: TerritorialGeocodingProposal | null;
  validation: TerritorialProposalValidation;
  execution: {
    providerCallPerformed: boolean;
    coordinateWritePerformed: boolean;
    coordinatesApplied: boolean;
    writePerformed: boolean;
  };
  transition: { action: 'resolve' | 'apply'; fromStatus: string; toStatus: string } | null;
  idempotentReplay: boolean;
}

export interface TerritorialGeocodingExecutionRequest { tenantSlug: string; jobId: string; idempotencyKey: string }

export interface TerritorialGeocodingApplyRequest extends TerritorialGeocodingExecutionRequest, TerritorialProposalExpectation {}

export interface TerritorialGeocodingPreviewItem {
  id: string;
  ticketId: string;
  sourceModelRaw: string;
  ticketSourceModel: TerritorialTicketSourceModel;
  category: string | null;
  zone: string | null;
  state: 'awaiting_materialization';
  reasonCode: 'persisted_address_without_coordinates';
  inspectSourceEnabled: true;
}

export interface TerritorialGeocodingPreviewQueue {
  contractVersion: typeof TERRITORIAL_GEOCODING_PREVIEW_CONTRACT;
  tenantId: string;
  summary: {
    discovered: number;
    unique: number;
    matching: number;
    hidden: number;
    bySourceModel: Record<string, number>;
    byCategory: Record<string, number>;
    byZone: Record<string, number>;
  };
  pagination: { page: number; perPage: number; total: number; hasNext: boolean };
  items: TerritorialGeocodingPreviewItem[];
  execution: { readOnly: true; databaseWritePerformed: false; providerCallPerformed: false; coordinateWritePerformed: false };
  privacy: { rawAddressExposed: false; addressDigestExposed: false; candidateFingerprintExposed: false; exactCoordinatesExposed: false; tenantScoped: true };
}

export interface TerritorialGeocodingPreviewParams {
  tenantSlug: string;
  page?: number;
  perPage?: number;
  sourceModel?: string;
  ticketId?: string;
  category?: string;
  zone?: string;
}
