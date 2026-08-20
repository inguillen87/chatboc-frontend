import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  MapPin,
  MessageSquare,
  Paperclip,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { usePortalContent } from '@/hooks/usePortalContent';
import { apiClient, type PortalClaim } from '@/api/client';
import { getWidgetClaimDetail, type WidgetCommerceRequest } from '@/api/widgetCommerce';
import {
  mergeWidgetClaimDetail,
  normalizeWidgetClaimDetail,
  type WidgetPortalAttachment,
  type WidgetPortalClaim,
} from '@/utils/widgetPortal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getTenantPublicNavigation } from '@/api/tenant';
import type { TenantPublicNavigationItem } from '@/types/tenant';
import { buildTenantPath, resolveTenantPublicNavigationTarget } from '@/utils/tenantPaths';
import { getOrCreateAnonId } from '@/utils/anonId';
import getOrCreateChatSessionId from '@/utils/chatSessionId';

const TrackingMap = React.lazy(() => import('@/components/ui/TrackingMap'));

const STATUS_MAP: Record<string, string> = {
  open: 'Abierto',
  pending: 'Pendiente',
  closed: 'Cerrado',
  resolved: 'Resuelto',
  in_progress: 'En proceso',
  nuevo: 'Nuevo',
  abierto: 'Abierto',
  pendiente: 'Pendiente',
  cerrado: 'Cerrado',
  resuelto: 'Resuelto',
  en_proceso: 'En proceso',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'default',
  pending: 'secondary',
  closed: 'outline',
  resolved: 'outline',
  in_progress: 'default',
};

const formatDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "d 'de' MMMM yyyy", { locale: es });
};

const normalizePublicClaimCode = (value?: unknown) => {
  const code = String(value ?? '').trim();
  if (!code) return null;
  return code.replace(/^(M|S)-/i, '');
};

const buildPublicClaimPath = (code?: unknown, pin?: unknown) => {
  const normalizedCode = normalizePublicClaimCode(code);
  if (!normalizedCode) return null;
  const params = new URLSearchParams();
  const normalizedPin = String(pin ?? '').trim();
  if (normalizedPin) params.set('pin', normalizedPin);
  const fragment = params.toString();
  return `/tracking/claim/${encodeURIComponent(normalizedCode)}${fragment ? `#${fragment}` : ''}`;
};

const normalizeClaimTrackingLink = (
  endpoint?: string | null,
  fallbackCode?: unknown,
  fallbackPin?: unknown,
) => {
  const fallback = buildPublicClaimPath(fallbackCode, fallbackPin);
  const raw = String(endpoint ?? '').trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://www.chatboc.ar');
    const path = url.pathname;
    if (path.startsWith('/tracking/claim/')) {
      const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
      const pin = fragment.get('pin') || url.searchParams.get('pin') || fallbackPin;
      const code = decodeURIComponent(path.split('/').filter(Boolean).pop() || '') || fallbackCode;
      return buildPublicClaimPath(code, pin) ?? fallback;
    }
    if (path === '/api/public/tracking/experience') {
      const kind = url.searchParams.get('kind');
      const code = url.searchParams.get('code') || fallbackCode;
      const pin = url.searchParams.get('pin') || fallbackPin;
      if (!kind || kind === 'claim') return buildPublicClaimPath(code, pin) ?? fallback;
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const withClaimSupportHash = (path?: string | null) => {
  if (!path) return null;
  return path.includes('#') ? `${path}&focus=mesa-ayuda` : `${path}#mesa-ayuda`;
};

const ClaimAttachment = ({ attachment }: { attachment: WidgetPortalAttachment }) => {
  const [failed, setFailed] = useState(false);
  if (!attachment.url) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
        <Paperclip className="mb-2 h-4 w-4" />
        {attachment.label || attachment.id}
      </div>
    );
  }

  const isImage = !failed && (
    attachment.kind?.toLowerCase().includes('image') ||
    attachment.mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif)$/i.test(attachment.url)
  );
  const source = String(attachment.source || '').toLowerCase();
  const sourceLabel = source === 'whatsapp_flow'
    ? 'Enviado por WhatsApp'
    : source === 'public_tracking'
      ? 'Portal ciudadano'
      : source === 'claim_attachment'
        ? 'Carga inicial'
        : null;
  const sizeLabel = attachment.size
    ? attachment.size < 1024 * 1024
      ? `${Math.round(attachment.size / 1024)} KB`
      : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`
    : null;
  const metadata = [sourceLabel, sizeLabel].filter(Boolean).join(' · ');

  if (isImage) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-lg border bg-muted/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Abrir ${attachment.label || 'imagen adjunta'}`}
      >
        <img
          src={attachment.previewUrl || attachment.url}
          alt={attachment.label || 'Adjunto'}
          className="h-36 w-full object-cover"
          onError={() => setFailed(true)}
        />
        <span className="block px-3 py-2">
          <span className="block truncate text-sm font-medium text-foreground">{attachment.label || 'Imagen adjunta'}</span>
          {metadata ? <span className="mt-0.5 block text-xs text-muted-foreground">{metadata}</span> : null}
          {attachment.securityLabel ? (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> {attachment.securityLabel}
            </span>
          ) : null}
        </span>
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-24 items-center gap-3 rounded-lg border bg-muted/20 p-3 text-sm hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Abrir ${attachment.label || 'archivo adjunto'}`}
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background text-primary">
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{attachment.label || attachment.url}</span>
        {metadata ? <span className="mt-0.5 block text-xs text-muted-foreground">{metadata}</span> : null}
        {attachment.securityLabel ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> {attachment.securityLabel}
          </span>
        ) : null}
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
    </a>
  );
};

const PublicClaimCard = ({
  claim,
  detailRequest,
}: {
  claim: WidgetPortalClaim;
  detailRequest: WidgetCommerceRequest | null;
}) => {
  const [detailClaim, setDetailClaim] = useState<WidgetPortalClaim | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!claim.detailEndpoint || !detailRequest?.tenantSlug) {
      setDetailClaim(null);
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    getWidgetClaimDetail(claim.detailEndpoint, detailRequest)
      .then((payload) => {
        const normalized = normalizeWidgetClaimDetail(payload);
        if (active) setDetailClaim(normalized);
      })
      .catch(() => {
        if (active) setDetailClaim(null);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    claim.detailEndpoint,
    detailRequest?.anonId,
    detailRequest?.chatSessionId,
    detailRequest?.tenantSlug,
    detailRequest?.widgetSessionToken,
    detailRequest?.widgetToken,
  ]);

  const renderClaim = useMemo(
    () => mergeWidgetClaimDetail(claim, detailClaim),
    [claim, detailClaim],
  );
  const title = renderClaim.title || renderClaim.category || (renderClaim.nroTicket ? `#${renderClaim.nroTicket}` : null);
  const status = renderClaim.statusLabel || renderClaim.status;
  const hasLocation = Number.isFinite(renderClaim.lat) && Number.isFinite(renderClaim.lng);
  const createdAt = formatDate(renderClaim.createdAt);
  const renderClaimRecord = renderClaim as WidgetPortalClaim & Record<string, unknown>;
  const claimPin = renderClaim.pin || renderClaimRecord.pin || renderClaimRecord.consulta_pin || renderClaimRecord.consultaPin;
  const claimCode = renderClaim.nroTicket || renderClaim.id;
  const trackingLink = normalizeClaimTrackingLink(
    renderClaim.detailEndpoint,
    claimCode,
    claimPin,
  );
  const commentLink = withClaimSupportHash(
    normalizeClaimTrackingLink(renderClaim.commentEndpoint, claimCode, claimPin) || trackingLink,
  );
  const photoLink = withClaimSupportHash(
    normalizeClaimTrackingLink(renderClaim.photoEndpoint, claimCode, claimPin) || trackingLink,
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="border-b bg-muted/20 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {renderClaim.nroTicket ? <span className="font-bold text-lg">#{renderClaim.nroTicket}</span> : null}
                {status ? <Badge variant="outline" className="capitalize">{status}</Badge> : null}
                {renderClaim.channel === 'whatsapp' ? <Badge variant="secondary">WhatsApp</Badge> : null}
              </div>
              {title ? <h3 className="text-lg font-semibold">{title}</h3> : null}
              {createdAt ? <p className="text-sm text-muted-foreground">{createdAt}</p> : null}
              {renderClaim.address ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {renderClaim.address}
                </p>
              ) : null}
            </div>
            {trackingLink ? (
              <Button variant="ghost" size="sm" asChild>
                <a href={trackingLink} target="_blank" rel="noreferrer" className="flex items-center gap-1">
                Ver seguimiento <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-5 p-4">
          {hasLocation ? (
            <div className="h-64 overflow-hidden rounded-xl border">
              <React.Suspense fallback={<div className="flex h-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">Cargando mapa...</div>}>
                <TrackingMap
                  customerLocation={{
                    lat: renderClaim.lat!,
                    lng: renderClaim.lng!,
                    name: renderClaim.address || title || renderClaim.nroTicket,
                  }}
                  showDriverMarker={false}
                  status={renderClaim.status || 'claim'}
                />
              </React.Suspense>
            </div>
          ) : null}

          {detailLoading ? (
            <p className="text-xs text-muted-foreground">Actualizando seguimiento...</p>
          ) : null}

          {renderClaim.attachments.length > 0 ? (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ImageIcon className="h-4 w-4" />
                Evidencia
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {renderClaim.attachments.map((attachment) => (
                  <ClaimAttachment key={attachment.id || attachment.url} attachment={attachment} />
                ))}
              </div>
            </div>
          ) : null}

          {renderClaim.timeline.length > 0 ? (
            <div>
              <h4 className="mb-3 text-sm font-semibold">Seguimiento</h4>
              <ol className="space-y-3 border-l pl-4">
                {renderClaim.timeline.map((event) => (
                  <li key={event.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{event.label}</span>
                      {event.status ? <Badge variant="outline" className="text-[11px]">{event.status}</Badge> : null}
                    </div>
                    {event.description && event.description !== event.label ? (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    ) : null}
                    {event.at ? <p className="text-xs text-muted-foreground">{formatDate(event.at) || event.at}</p> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {(commentLink || photoLink) ? (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {commentLink ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={commentLink}>Agregar comentario</a>
                </Button>
              ) : null}
              {photoLink ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={photoLink}>Agregar foto</a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

const AuthenticatedClaimCard = ({ claim }: { claim: PortalClaim }) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="border-b bg-muted/20 p-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">#{claim.id}</span>
              <Badge variant={STATUS_VARIANTS[claim.status] || 'default'}>
                {STATUS_MAP[claim.status] || claim.status}
              </Badge>
            </div>
            {formatDate(claim.date) ? (
              <p className="mt-1 text-sm text-muted-foreground">{formatDate(claim.date)}</p>
            ) : null}
          </div>
        </div>
        <div className="p-4">
          <h3 className="text-lg font-medium">{claim.title}</h3>
          {claim.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{claim.description}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

const UserClaimsPage = () => {
  const { currentSlug, widgetToken } = useTenant();
  const { user } = useUser();
  const navigate = useNavigate();
  const { commerceSession, publicClaims, isLoading: portalLoading } = usePortalContent();
  const [claims, setClaims] = useState<PortalClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [publicNavigationItems, setPublicNavigationItems] = useState<TenantPublicNavigationItem[]>([]);

  useEffect(() => {
    let active = true;
    if (!currentSlug || !user || publicClaims.length > 0) {
      setClaims([]);
      setClaimsLoading(false);
      return;
    }

    setClaimsLoading(true);
    apiClient
      .listClaims(currentSlug)
      .then((data) => {
        if (active) setClaims(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error('Error loading claims:', error);
        if (active) setClaims([]);
      })
      .finally(() => {
        if (active) setClaimsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentSlug, publicClaims.length, user]);

  useEffect(() => {
    let active = true;
    setPublicNavigationItems([]);

    if (user || !currentSlug || publicClaims.length > 0) {
      return () => {
        active = false;
      };
    }

    getTenantPublicNavigation(currentSlug)
      .then((contract) => {
        if (active) setPublicNavigationItems(contract.items);
      })
      .catch(() => {
        if (active) setPublicNavigationItems([]);
      });

    return () => {
      active = false;
    };
  }, [currentSlug, publicClaims.length, user]);

  const loading = portalLoading || claimsLoading;
  const hasPublicClaims = publicClaims.length > 0;
  const hasAuthenticatedClaims = claims.length > 0;
  const authenticatedClaimStartPath = user && currentSlug ? buildTenantPath('/reclamos/nuevo', currentSlug) : null;
  const guestNewClaimItem = useMemo(
    () => publicNavigationItems.find((item) => item.id.toLowerCase() === 'new_claim') ?? null,
    [publicNavigationItems],
  );
  const guestClaimStartPath = useMemo(() => {
    if (
      user ||
      !currentSlug ||
      !guestNewClaimItem ||
      guestNewClaimItem.enabled === false ||
      guestNewClaimItem.visible === false
    ) {
      return null;
    }

    return resolveTenantPublicNavigationTarget(
      guestNewClaimItem,
      `/t/${encodeURIComponent(currentSlug)}`,
    );
  }, [currentSlug, guestNewClaimItem, user]);
  const emptyClaimStartPath = authenticatedClaimStartPath || guestClaimStartPath;
  const linkTrackingPath = buildTenantPath('/portal/cuenta', currentSlug);
  const detailRequest = useMemo<WidgetCommerceRequest | null>(() => {
    if (!currentSlug) return null;
    return {
      tenantSlug: currentSlug,
      widgetToken,
      chatSessionId: getOrCreateChatSessionId(),
      anonId: getOrCreateAnonId(),
      widgetSessionToken: commerceSession?.session?.widget_session_token || null,
    };
  }, [commerceSession?.session?.widget_session_token, currentSlug, widgetToken]);
  const emptyTitle = useMemo(
    () => (user ? 'No tenes reclamos registrados aun.' : 'Todavia no hay reclamos vinculados a esta sesion.'),
    [user],
  );

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mis reclamos y solicitudes</h1>
        {authenticatedClaimStartPath ? (
          <Button onClick={() => navigate(authenticatedClaimStartPath)}>
            <PlusCircle aria-hidden="true" className="mr-2 h-4 w-4" /> Nuevo reclamo
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-lg bg-muted/20" />
          ))}
        </div>
      ) : !hasPublicClaims && !hasAuthenticatedClaims ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center text-muted-foreground">
          <MessageSquare aria-hidden="true" className="mb-4 h-12 w-12 opacity-20" />
          <p>{emptyTitle}</p>
          <div className="mt-4 flex w-full max-w-sm flex-col gap-2 sm:w-auto sm:flex-row">
            {!user ? (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to={linkTrackingPath}>
                  <Link2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  Vincular seguimiento
                </Link>
              </Button>
            ) : null}
            {emptyClaimStartPath ? (
              <Button asChild className="w-full sm:w-auto">
                <Link to={emptyClaimStartPath}>
                  <PlusCircle aria-hidden="true" className="mr-2 h-4 w-4" />
                  Nuevo reclamo
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {hasPublicClaims
            ? publicClaims.map((claim) => <PublicClaimCard key={claim.id} claim={claim} detailRequest={detailRequest} />)
            : claims.map((claim) => <AuthenticatedClaimCard key={claim.id} claim={claim} />)}
        </div>
      )}
    </div>
  );
};

export default UserClaimsPage;
