import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Paperclip,
  PlusCircle,
} from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { usePortalContent } from '@/hooks/usePortalContent';
import { apiClient } from '@/api/client';
import { getWidgetClaimDetail, type WidgetCommerceRequest } from '@/api/widgetCommerce';
import { Ticket } from '@/types/unified';
import {
  mergeWidgetClaimDetail,
  normalizeWidgetClaimDetail,
  type WidgetPortalAttachment,
  type WidgetPortalClaim,
} from '@/utils/widgetPortal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buildTenantPath } from '@/utils/tenantPaths';
import { getOrCreateAnonId } from '@/utils/anonId';
import getOrCreateChatSessionId from '@/utils/chatSessionId';

const TrackingMap = React.lazy(() => import('@/components/ui/TrackingMap'));

const STATUS_MAP: Record<string, string> = {
  open: 'Abierto',
  pending: 'Pendiente',
  closed: 'Cerrado',
  resolved: 'Resuelto',
  in_progress: 'En proceso',
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
  const query = params.toString();
  return `/tracking/claim/${encodeURIComponent(normalizedCode)}${query ? `?${query}` : ''}`;
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
      return `${path}${url.search}`;
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

  if (failed) {
    return null;
  }

  const isImage = attachment.kind?.toLowerCase().includes('image') || /\.(png|jpe?g|webp|gif)$/i.test(attachment.url);
  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border bg-muted/20">
        <img
          src={attachment.url}
          alt={attachment.label || 'Adjunto'}
          className="h-36 w-full object-cover"
          onError={() => setFailed(true)}
        />
        {attachment.label ? <span className="block px-3 py-2 text-xs text-muted-foreground">{attachment.label}</span> : null}
      </a>
    );
  }

  return (
    <a href={attachment.url} target="_blank" rel="noreferrer" className="rounded-lg border bg-muted/20 p-3 text-sm text-primary hover:underline">
      <Paperclip className="mb-2 h-4 w-4" />
      {attachment.label || attachment.url}
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
  const trackingLink = normalizeClaimTrackingLink(
    renderClaim.detailEndpoint,
    renderClaim.nroTicket || renderClaim.id,
    renderClaimRecord.pin || renderClaimRecord.consulta_pin || renderClaimRecord.consultaPin,
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

          {(renderClaim.commentEndpoint || renderClaim.photoEndpoint) ? (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {renderClaim.commentEndpoint ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={renderClaim.commentEndpoint} target="_blank" rel="noreferrer">Agregar comentario</a>
                </Button>
              ) : null}
              {renderClaim.photoEndpoint ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={renderClaim.photoEndpoint} target="_blank" rel="noreferrer">Agregar foto</a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

const LegacyTicketCard = ({ ticket }: { ticket: Ticket; currentSlug: string | null }) => {
  const ticketRecord = ticket as Ticket & Record<string, unknown>;
  const ticketCodeValue = ticketRecord.nro_ticket || ticketRecord.ticket_number || ticketRecord.codigo || ticket.id;
  const ticketCode = String(ticketCodeValue || ticket.id);
  const trackingPath =
    buildPublicClaimPath(ticketCode, ticketRecord.consulta_pin || ticketRecord.pin) ||
    `/ticket/${encodeURIComponent(ticketCode)}`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg">#{ticketCode || ticket.id}</span>
              <Badge variant={STATUS_VARIANTS[ticket.status] || 'default'} className="capitalize">
                {STATUS_MAP[ticket.status] || ticket.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(ticket.created_at)}</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a href={trackingPath} className="flex items-center gap-1">
              Ver seguimiento <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
        <div className="p-4">
          <h3 className="mb-2 text-lg font-medium">{ticket.subject}</h3>
          {ticket.messages?.length > 0 ? (
            <div className="line-clamp-2 rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
              {ticket.messages[ticket.messages.length - 1].content}
            </div>
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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [legacyLoading, setLegacyLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!currentSlug || !user || publicClaims.length > 0) {
      setTickets([]);
      setLegacyLoading(false);
      return;
    }

    setLegacyLoading(true);
    apiClient
      .listTickets(currentSlug)
      .then((data) => {
        if (active) setTickets(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error('Error loading tickets:', error);
        if (active) setTickets([]);
      })
      .finally(() => {
        if (active) setLegacyLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentSlug, publicClaims.length, user]);

  const loading = portalLoading || legacyLoading;
  const hasPublicClaims = publicClaims.length > 0;
  const hasLegacyTickets = tickets.length > 0;
  const claimStartPath = user && currentSlug ? buildTenantPath('/reclamos/nuevo', currentSlug) : null;
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
        {claimStartPath ? (
          <Button onClick={() => navigate(claimStartPath)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo reclamo
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-lg bg-muted/20" />
          ))}
        </div>
      ) : !hasPublicClaims && !hasLegacyTickets ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center text-muted-foreground">
          <MessageSquare className="mb-4 h-12 w-12 opacity-20" />
          <p>{emptyTitle}</p>
          {claimStartPath ? (
            <Button variant="link" className="mt-2" onClick={() => navigate(claimStartPath)}>
              Iniciar un nuevo reclamo
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {hasPublicClaims
            ? publicClaims.map((claim) => <PublicClaimCard key={claim.id} claim={claim} detailRequest={detailRequest} />)
            : tickets.map((ticket) => <LegacyTicketCard key={ticket.id} ticket={ticket} currentSlug={currentSlug} />)}
        </div>
      )}
    </div>
  );
};

export default UserClaimsPage;
