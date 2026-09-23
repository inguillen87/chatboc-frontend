import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicOrder } from '@/api/market';
import type { PublicOrderTrackingResponse } from '@/types/tracking';
import { Package, Copy, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrderLifecycleSummary } from '@/components/orders/OrderLifecycleSummary';
import { formatCurrency } from '@/utils/currency';
import { toast } from 'sonner';
import { hexToHsl, getContrastColorHsl } from '@/utils/color';
import { parsePublicOrder, publicOrderPoint, publicOrderBranding, publicOrderPrivacy, publicOrderText as text } from '@/features/orders/publicOrderView';
const TrackingMap = React.lazy(() => import('@/components/ui/TrackingMap'));
const amount = (value: unknown, currency?: string) => typeof value === 'number' && Number.isFinite(value) ? formatCurrency(value, currency || 'ARS') : 'Importe no informado';

export default function OrderTrackingPage() {
  const { nro_pedido } = useParams<{ nro_pedido: string }>();
  if (!nro_pedido) return <p role="alert" className="p-8">Falta la referencia del pedido.</p>;
  return <PublicOrderSession key={nro_pedido} code={nro_pedido} />;
}
function PublicOrderSession({ code }: { code: string }) {
  const [order, setOrder] = useState<PublicOrderTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);
  const copying = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setOrder(null); setLogoFailed(false);
    void fetchPublicOrder(code).then((raw) => {
      if (!active) return;
      setOrder(parsePublicOrder(raw, code));
    }).catch(() => { if (active) setError('No pudimos verificar este pedido. Revisá la referencia o volvé a consultar.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code, revision]);
  if (loading) return <div role="status" className="flex min-h-64 items-center justify-center gap-3"><Package aria-hidden="true" />Consultando pedido…</div>;
  if (!order) return <div className="mx-auto max-w-xl space-y-4 p-6"><p role="alert">{error}</p><Button onClick={() => setRevision((v) => v + 1)}>Reintentar consulta</Button></div>;
  const branding = publicOrderBranding(order), privacy = publicOrderPrivacy(order);
  const businessName = text(order.pyme_nombre) || 'Comercio';
  // The explicit redaction policy wins over accidental contact/address/coordinate values.
  const deliverySummary = privacy.address ? text(order.delivery_summary) || 'Dirección protegida' : text(order.delivery_summary) || text(order.direccion) || 'Dirección no informada';
  const delivery = privacy.coordinates ? null : publicOrderPoint(order.delivery_location, deliverySummary) || publicOrderPoint(order.customer_location, deliverySummary) || publicOrderPoint(order, deliverySummary);
  const store = privacy.coordinates ? null : publicOrderPoint(order.store_location, businessName);
  const driver = privacy.coordinates ? null : publicOrderPoint(order.driver_location, 'Ubicación informada del reparto');
  const style: React.CSSProperties = {
    ...(branding.primary ? { '--primary': hexToHsl(branding.primary), '--primary-foreground': getContrastColorHsl(branding.primary) } : {}),
    ...(branding.secondary ? { '--secondary': hexToHsl(branding.secondary) } : {}),
  } as React.CSSProperties;
  const openSupport = () => {
    if (!order.tenant_slug) return;
    window.postMessage({ type: 'OPEN_CHAT_WITH_CONTEXT', tenantSlug: order.tenant_slug, tipoChat: 'pyme',
      context: { orderId: order.id ?? order.tracking_id ?? order.nro_pedido, orderNumber: order.nro_pedido, action: 'consultar_pedido' } }, window.location.origin);
  };
  const copy = async () => {
    if (copying.current) return;
    copying.current = true;
    try { await navigator.clipboard.writeText(code); toast.success('Número de pedido copiado'); }
    catch { toast.error('No se pudo copiar. Seleccioná el número del pedido para copiarlo.'); }
    finally { copying.current = false; }
  };
  return <div className="order-workspace min-h-screen bg-background text-foreground" style={style}>
    <header className="border-b bg-card"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">{branding.logo && !logoFailed ? <img src={branding.logo} alt={`Logo de ${businessName}`} className="h-10 max-w-28 object-contain" onError={() => setLogoFailed(true)} /> : <Package aria-hidden="true" className="h-8 w-8 text-primary" />}<span className="font-semibold">{businessName}</span></div>
      <Button variant="outline" onClick={() => setRevision((v) => v + 1)}><RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />Actualizar estado</Button>
    </div></header>
    <main className="mx-auto max-w-4xl space-y-6 p-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Seguimiento de compra</p><h1 className="text-2xl font-bold">Pedido #{code}</h1></div><Button variant="outline" onClick={() => void copy()}><Copy aria-hidden="true" className="mr-2 h-4 w-4" />Copiar referencia</Button></div>
      <OrderLifecycleSummary order={order} />
      <p className="text-xs text-muted-foreground">La vista muestra la última respuesta recibida. Usá Actualizar estado para consultar cambios; no es una señal de GPS en vivo.</p>
      <div className="grid gap-6 md:grid-cols-3"><div className="space-y-6 md:col-span-2">
        <Card><CardHeader><CardTitle>Tu compra</CardTitle></CardHeader><CardContent>
          {order.detalles.length ? <ul className="divide-y">{order.detalles.map((item, index) => <li key={index} className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div className="min-w-0"><p className="font-medium">{text(item.nombre_producto) || 'Artículo sin nombre informado'}</p><p className="text-sm text-muted-foreground">{typeof item.cantidad === 'number' && Number.isFinite(item.cantidad) ? `${item.cantidad} unidades` : 'Cantidad no informada'} · {amount(item.precio_unitario_original, item.moneda)}</p>{item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}</div>
            <strong>{amount(item.subtotal_con_descuento, item.moneda)}</strong>
          </li>)}</ul> : <p className="text-sm text-muted-foreground">No hay artículos publicados en esta respuesta.</p>}
          <div className="mt-4 flex flex-wrap justify-between gap-3 border-t pt-4"><span>Total informado</span><strong className="text-xl">{amount(order.monto_total)}</strong></div>
        </CardContent></Card>
      </div><div className="space-y-6">
        <Card><CardHeader><CardTitle>Datos de entrega</CardTitle></CardHeader><CardContent className="space-y-4">
          {(delivery || store || driver) && <div className="h-52 overflow-hidden rounded-lg"><React.Suspense fallback={<p>Cargando mapa…</p>}><TrackingMap status={order.estado} customerLocation={delivery} storeLocation={store} driverLocation={driver || undefined} showDriverMarker={Boolean(driver)} /></React.Suspense></div>}
          <div><p className="text-xs text-muted-foreground">Dirección</p><p>{deliverySummary}</p></div>
          <div><p className="text-xs text-muted-foreground">Destinatario</p><p>{privacy.name ? 'Nombre protegido' : text(order.nombre_cliente) || 'Nombre no informado'}</p><p className="text-sm text-muted-foreground">{privacy.phone ? 'Contacto protegido' : text(order.telefono_cliente) || 'Contacto protegido'}</p></div>
          {privacy.redacted && <p className="text-xs leading-relaxed text-muted-foreground"><ShieldCheck aria-hidden="true" className="mb-1 h-4 w-4" />Por seguridad, el detalle exacto queda disponible solo en el portal o por soporte autenticado.</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Soporte del comercio</CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">El chat se abre con la referencia de este pedido. No se envía un mensaje automáticamente.</p>
          {order.tenant_slug ? <Button className="w-full" onClick={openSupport}><MessageCircle aria-hidden="true" className="mr-2 h-4 w-4" />Abrir chat de soporte</Button> : <p className="text-sm">Canal de soporte no informado.</p>}
        </CardContent></Card>
      </div></div>
    </main>
  </div>;
}
