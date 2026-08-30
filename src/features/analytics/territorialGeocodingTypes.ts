export const TERRITORIAL_GEOCODING_CONTRACT = 'operations.territorial_geocoding_admin.v1' as const;
export const TERRITORIAL_GEOCODING_SYNC_CONTRACT = 'operations.territorial_geocoding_sync.v1' as const;

export type TerritorialReviewDecision = 'approved' | 'rejected';
export type TerritorialReviewState = 'unreviewed' | 'approved' | 'rejected' | 'stale';
export type TerritorialTicketSourceModel = 'TenantTicket' | 'MunicipioTicket' | 'PymeTicket';

export interface TerritorialReviewReceipt {
  id: string;
  decision: TerritorialReviewDecision;
  effectiveState: TerritorialReviewState;
  reasonCode: string;
  reviewerUserId: string | null;
  reviewedJobStatus: string;
  proposalCurrent: boolean;
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
  providerPlaceId: string | null;
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
  attempts: TerritorialGeocodingAttempt[];
  reviews: TerritorialReviewReceipt[];
  privacy: {
    rawAddressExposed: false;
    addressDigestExposed: false;
    exactCoordinatesExposed: boolean;
    authorizedAdminDetail: true;
  };
  writePolicy: {
    getIsReadOnly: true;
    providerCallPerformed: false;
    coordinateApplicationSupported: false;
    reviewIsHumanDecisionOnly: true;
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
}

export interface TerritorialGeocodingReviewResponse {
  contractVersion: typeof TERRITORIAL_GEOCODING_CONTRACT;
  tenantId: string;
  jobId: string;
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

export interface TerritorialGeocodingReviewRequest {
  tenantSlug: string;
  jobId: string;
  decision: TerritorialReviewDecision;
  reasonCode: string;
  idempotencyKey: string;
}

export interface TerritorialGeocodingSyncResponse {
  contractVersion: typeof TERRITORIAL_GEOCODING_SYNC_CONTRACT;
  tenantId: string;
  summary: {
    discovered: number;
    created: number;
    existing: number;
    stale: number;
    refreshed: number;
    hidden: number;
  };
  execution: {
    providerCallPerformed: false;
    coordinateWritePerformed: false;
  };
  idempotentReplay: boolean;
}

export interface TerritorialGeocodingSyncRequest {
  tenantSlug: string;
  idempotencyKey: string;
}
