import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
import { ApiError } from '@/utils/api';
import { Order } from '@/types/unified';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRightLeft, Loader2, Package, Truck, CheckCircle, XCircle, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/currency';
import { getCommercialStageLabel, getCommercialStageTone, getCommercialToneClassName, normalizeChannelLabel } from '@/utils/orderCommercial';
import { AssistedRequestPanel } from '@/components/orders/AssistedRequestPanel';
import { OrderLifecycleSummary } from '@/components/orders/OrderLifecycleSummary';
import { useAdminOrderSession } from '@/features/orders/useAdminOrderSession';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';

type BlockingReasonView = {
  code?: string | null;
  id?: string | null;
  label?: string | null;
  message?: string | null;
  description?: string | null;
  source_name?: string | null;
  line_id?: string | null;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-800', icon: Package },
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Package },
  confirmed: { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
  paid: { label: 'Pagado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const blockingReasonsFrom = (order: Order | null): BlockingReasonView[] => {
  if (!order) return [];
  const request = isRecord(order.assisted_request) ? (order.assisted_request as Record<string, any>) : {};
  const card = isRecord(order.crm_review_card) ? (order.crm_review_card as Record<string, any>) : {};
  const draft = isRecord(request.crm_order_draft)
    ? request.crm_order_draft
    : isRecord(request.crm_handoff?.draft_order)
      ? request.crm_handoff.draft_order
      : {};
  const confirmation = isRecord(draft.customer_confirmation) ? draft.customer_confirmation : {};
  const candidates = [
    card.blocking_reasons,
    request.blocking_reasons,
    confirmation.blocking_reasons,
    card.operator_actions?.find?.((action: any) => action?.id === 'confirm_order_draft')?.blocking_reasons,
  ];
  for (const value of candidates) {
    if (Array.isArray(value) && value.length) return value.filter(isRecord) as BlockingReasonView[];
  }
  return [];
};

const hasAssistedContract = (order: Order | null): boolean => Boolean(order?.assisted_request || order?.crm_review_card);

const assistedCanConfirm = (order: Order | null): boolean => {
  if (!order || !hasAssistedContract(order)) return true;
  const request = isRecord(order.assisted_request) ? (order.assisted_request as Record<string, any>) : {};
  const card = isRecord(order.crm_review_card) ? (order.crm_review_card as Record<string, any>) : {};
  const summary = isRecord(request.match_summary) ? request.match_summary : {};
  const draft = isRecord(request.crm_order_draft)
    ? request.crm_order_draft
    : isRecord(request.crm_handoff?.draft_order)
      ? request.crm_handoff.draft_order
      : {};
  const draftSummary = isRecord(draft.summary) ? draft.summary : {};
  const state = String(card.operational_state || card.status || request.crm_state || request.status || '').toLowerCase();
  const unmatched = Number(summary.unmatched ?? draftSummary.unmatched ?? 0);
  return (
    blockingReasonsFrom(order).length === 0 &&
    unmatched === 0 &&
    !card.needs_operator_review &&
    !request.operator_pack?.needs_human_review &&
    ['ready_for_order_creation', 'ready_for_confirmation', 'ready_to_reply'].includes(state)
  );
};

const assistedConfirmLabel = (order: Order | null): string => {
  if (!order?.assisted_request && !order?.crm_review_card) return 'Confirmar Pedido';
  const action = Array.isArray(order.crm_review_card?.operator_actions)
    ? order.crm_review_card?.operator_actions?.find((item: any) => item?.id === 'confirm_order_draft')
    : null;
  return String(action?.label || 'Crear pedido operativo');
};

const blockerLabel = (reason: BlockingReasonView): string =>
  String(
    reason.label ||
      reason.message ||
      reason.description ||
      reason.code ||
      reason.id ||
      'Pendiente de revisión',
  );

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentSlug } = useTenant();
  if (!currentSlug || !id) return <p role="alert" className="p-8">No se pudo identificar la organización y el pedido.</p>;
  return <AdminOrderDetailSession key={JSON.stringify([currentSlug, id])} tenantSlug={currentSlug} id={id} />;
}

function AdminOrderDetailSession({ tenantSlug, id }: { tenantSlug: string; id: string }) {
  const navigate = useNavigate();
  const { order, loading, busy, error, requiresRefresh, dispatchInfo, refresh, mutate } = useAdminOrderSession(tenantSlug, id);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [statusBlockers, setStatusBlockers] = useState<BlockingReasonView[]>([]);
  const [resolvingCatalogCandidateKey, setResolvingCatalogCandidateKey] = useState<string | null>(null);
  const actionLock = useRef(false);
  const writesBlocked = busy || requiresRefresh;
  const refreshOrder = () => { if (actionLock.current) return; setPendingStatus(null); setStatusBlockers([]); void refresh(); };
  const handleStatusChange = (status: string) => { if (!writesBlocked) setPendingStatus(status); };
  const confirmStatusChange = async () => {
    if (!pendingStatus || writesBlocked || actionLock.current) return;
    actionLock.current = true;
    const target = pendingStatus;
    setUpdatingStatus(target); setStatusBlockers([]);
    try {
      const updated = await mutate({ status: target });
      if (updated) toast.success('Estado confirmado por el servidor');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409 && failure.body?.error === 'assisted_order_needs_review') {
        setStatusBlockers(Array.isArray(failure.body.blocking_reasons) ? failure.body.blocking_reasons.filter(isRecord) : []);
        toast.error('Faltan resolver datos antes de confirmar.');
      } else { toast.error('No se pudo confirmar el cambio. Revisá el estado antes de reintentar.'); }
    } finally { actionLock.current = false; setUpdatingStatus(null); setPendingStatus(null); }
  };
  const handleResolveCatalogCandidate = async (payload: { lineId?: string | null; sourceName: string; catalogItemId: string | number; candidateName: string }) => {
    if (writesBlocked || actionLock.current) return;
    actionLock.current = true;
    setResolvingCatalogCandidateKey(`${payload.lineId || payload.sourceName}:${payload.catalogItemId}`); setStatusBlockers([]);
    try {
      const updated = await mutate({ catalog_resolutions: [{ line_id: payload.lineId, source_name: payload.sourceName, catalog_item_id: payload.catalogItemId }] });
      if (updated) toast.success('Pedido actualizado. Revisá la asociación en el borrador.');
    } catch { toast.error('No se pudo confirmar la asociación. Actualizá el pedido antes de reintentar.'); }
    finally { actionLock.current = false; setResolvingCatalogCandidateKey(null); }
  };

  if (loading) {
      return <div role="status" className="flex min-h-64 items-center justify-center gap-3"><Loader2 aria-hidden="true" className="h-8 w-8 motion-safe:animate-spin text-primary"/>Verificando pedido…</div>;
  }

  if (!order) {
      return <div className="p-8 space-y-4 text-center"><p role="alert">{error || 'Pedido no encontrado.'}</p><Button variant="outline" onClick={refreshOrder}>Actualizar pedido</Button><Button variant="link" onClick={() => navigate(-1)}>Volver</Button></div>;
  }

  return (
    <div className="order-workspace container mx-auto p-4 md:p-8 space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <h1 className="text-2xl font-bold">Pedido #{order.id}</h1>
          <Badge className={STATUS_MAP[order.status]?.color || 'bg-gray-100'}>
              {STATUS_MAP[order.status]?.label || order.status}
          </Badge>
          {getCommercialStageLabel((order as any).commercial_stage || (order as any).commercial_state?.stage) ? (
            <Badge variant="outline" className={getCommercialToneClassName(getCommercialStageTone((order as any).commercial_stage || (order as any).commercial_state?.stage))}>
              {getCommercialStageLabel((order as any).commercial_stage || (order as any).commercial_state?.stage)}
            </Badge>
          ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Organización: {tenantSlug} · Referencia: {id}</p>
        <Button variant="outline" onClick={refreshOrder} disabled={busy}>Actualizar pedido</Button>
      </div>
      {error && <div role="alert" className="order-workspace-notice">{error}</div>}
      <OrderLifecycleSummary order={order} />
      <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
              <AssistedRequestPanel
                order={order}
                onResolveCatalogCandidate={writesBlocked ? undefined : handleResolveCatalogCandidate}
                resolvingCatalogCandidateKey={resolvingCatalogCandidateKey}
              />

              <Card>
                  <CardHeader>
                      <CardTitle>Detalle de Productos</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-4">
                          {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                                  <div>
                                      <p className="font-medium">{item.name}</p>
                                      <p className="text-sm text-muted-foreground">{item.quantity} x {formatCurrency(item.price)}</p>
                                  </div>
                                  <p className="font-bold">{formatCurrency(item.price * item.quantity)}</p>
                              </div>
                          ))}
                          <div className="flex justify-between pt-4 text-lg font-bold">
                              <span>Total</span>
                              <span>{formatCurrency(order.total)}</span>
                          </div>
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Historial y Notas</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                          {order.created_at && Number.isFinite(Date.parse(order.created_at)) ? `Creado el ${new Date(order.created_at).toLocaleString('es-AR')}` : 'Fecha de creación no informada'}
                      </p>
                      <div className="bg-muted/30 p-3 rounded text-sm">
                          {(order as any).notes || "Sin notas adicionales."}
                      </div>
                  </CardContent>
              </Card>
          </div>

          <div className="space-y-6">
              <Card>
                  <CardHeader>
                      <CardTitle>Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{(order as any).customer_profile?.name || (order as any).contact_name || (order as any).customerName || 'Cliente Final'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{(order as any).customer_profile?.email || (order as any).contact_email || (order as any).customerEmail || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{(order as any).customer_profile?.phone || (order as any).contact_phone || (order as any).customerPhone || '-'}</span>
                      </div>
                      {((order as any).customer_profile?.contact_key || (order as any).customer_profile?.channel_group) ? (
                        <div className="flex flex-wrap gap-2">
                          {(order as any).customer_profile?.contact_key ? <Badge variant="outline">{(order as any).customer_profile.contact_key}</Badge> : null}
                          {(order as any).customer_profile?.channel_group ? <Badge variant="outline">{normalizeChannelLabel((order as any).customer_profile.channel_group)}</Badge> : null}
                        </div>
                      ) : null}
                  </CardContent>
              </Card>

              {((order as any).commercial_state || (order as any).market_order_id || (order as any).source_model) ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Contexto comercial</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {getCommercialStageLabel((order as any).commercial_stage || (order as any).commercial_state?.stage) ? (
                      <Badge variant="outline" className={getCommercialToneClassName(getCommercialStageTone((order as any).commercial_stage || (order as any).commercial_state?.stage))}>
                        {getCommercialStageLabel((order as any).commercial_stage || (order as any).commercial_state?.stage)}
                      </Badge>
                    ) : null}
                    <p>Canal: {normalizeChannelLabel((order as any).commercial_state?.channel || order.channel || null)}</p>
                    {(order as any).market_order_id ? <p>Market order: #{(order as any).market_order_id}</p> : null}
                    {(order as any).source_model ? <p>Modelo fuente: {(order as any).source_model}</p> : null}
                    {(order as any).commercial_state?.supports_handoff ? (
                      <p className="flex items-center gap-2 text-emerald-700"><ArrowRightLeft className="h-4 w-4" /> Handoff omnicanal disponible</p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                  <CardHeader>
                      <CardTitle>Acciones</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                      {['nuevo', 'pending'].includes(order.status) && (
                          <Button
                            className="w-full"
                            onClick={() => handleStatusChange('confirmed')}
                            disabled={!assistedCanConfirm(order) || writesBlocked}
                          >
                            {updatingStatus === 'confirmed' ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {assistedCanConfirm(order) ? assistedConfirmLabel(order) : 'Resolver pendientes para confirmar'}
                          </Button>
                      )}
                      {order.status === 'confirmed' && (
                          <Button className="w-full" onClick={() => handleStatusChange('shipped')} disabled={writesBlocked}>
                            {updatingStatus === 'shipped' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Marcar Enviado
                          </Button>
                      )}
                      {order.status === 'shipped' && (
                          <Button className="w-full" onClick={() => handleStatusChange('delivered')} disabled={writesBlocked}>
                            {updatingStatus === 'delivered' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Marcar Entregado
                          </Button>
                      )}
                      {['nuevo', 'pending', 'confirmed', 'paid', 'shipped'].includes(order.status) && (
                          <Button
                            variant="outline"
                            className="w-full text-destructive hover:text-destructive"
                            onClick={() => handleStatusChange('cancelled')}
                            disabled={writesBlocked}
                          >
                            {updatingStatus === 'cancelled' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Cancelar Pedido
                          </Button>
                      )}
                      {[...statusBlockers, ...blockingReasonsFrom(order)].length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          <p className="font-semibold">Antes de confirmar</p>
                          <ul className="mt-2 space-y-1">
                            {[...statusBlockers, ...blockingReasonsFrom(order)].slice(0, 4).map((reason, index) => (
                              <li key={`${reason.code || reason.id || index}-${reason.line_id || reason.source_name || index}`}>
                                {blockerLabel(reason)}
                                {reason.source_name ? `: ${reason.source_name}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                  </CardContent>
              </Card>

              {/* Dispatch Info Block */}
              {(dispatchInfo.email || dispatchInfo.phone) && (
                  <Card className="bg-blue-50 border-blue-200">
                      <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-blue-900 flex items-center gap-2">
                              <Truck className="h-4 w-4"/> Datos de Despacho
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-blue-800 space-y-1">
                          {dispatchInfo.email && <p>Email: {dispatchInfo.email}</p>}
                          {dispatchInfo.phone && <p>Tel: {dispatchInfo.phone}</p>}
                          <p className="text-xs text-blue-600 mt-2 italic">
                              Contactos configurados. Esta pantalla no acredita el envío ni la recepción de notificaciones.
                          </p>
                      </CardContent>
                  </Card>
              )}
          </div>
      </div>
      <AlertDialog open={Boolean(pendingStatus)} onOpenChange={(open) => { if (!open && !busy && !actionLock.current) setPendingStatus(null); }}>
        <AlertDialogContent className="order-workspace-confirm">
          <AlertDialogHeader><AlertDialogTitle>Revisar cambio de estado</AlertDialogTitle>
            <AlertDialogDescription className="order-workspace-confirm-description">Organización {tenantSlug}, pedido {id}. Estado actual: {STATUS_MAP[order.status]?.label || order.status}. Nuevo estado: {pendingStatus ? STATUS_MAP[pendingStatus]?.label || pendingStatus : ''}.</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm">{pendingStatus === 'cancelled' ? 'Cancelar este pedido no confirma una devolución del pago.' : pendingStatus === 'delivered' ? 'Marcá entregado sólo si la entrega ocurrió. Esto no confirma ni cobra el pago.' : 'El cambio modifica el estado operativo. Esta confirmación no acredita un pago ni la entrega de notificaciones.'}</p>
          <AlertDialogFooter><Button variant="outline" onClick={() => setPendingStatus(null)} disabled={busy}>Volver sin cambiar</Button><Button onClick={() => void confirmStatusChange()} disabled={writesBlocked}>{busy ? 'Confirmando…' : 'Confirmar cambio de estado'}</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
