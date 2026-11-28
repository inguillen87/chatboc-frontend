import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Clock, Eye, Link2, Loader2, PackageCheck, PlugZap, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/utils/api';

export type MarketplaceKey = 'mercadolibre' | 'tiendanube' | 'shopify';

type LastImport = { created: number; updated: number; skipped: number; found: number; at: string };

export type MarketplaceProviderStatus = {
  key: MarketplaceKey;
  label: string;
  configured: boolean;
  connected: boolean;
  needs_reconnect: boolean;
  needs_shop: boolean;
  account: string | null;
  last_sync_at: string | null;
  last_import: LastImport | null;
  capabilities: string[];
};

type MarketplaceStatus = {
  providers: MarketplaceProviderStatus[];
  upcoming: { key: string; label: string }[];
};

type PreviewRow = { sku: string; nombre: string; precio: string; stock: number | null; imagen_url: string | null; accion: 'crear' | 'actualizar' };

type ImportResult = { found: number; created: number; updated: number; skipped: number; limited: boolean; preview: PreviewRow[] };

const CAPABILITY_LABELS: Record<string, string> = {
  catalogo: 'Catálogo', precios: 'Precios', stock: 'Stock', fotos: 'Fotos',
};

const ERRORS: Record<string, string> = {
  provider_not_configured: 'Esta conexión todavía no está habilitada en Chatboc.',
  shopify_shop_invalid: 'Revisá la dirección: tiene que ser del tipo mitienda.myshopify.com.',
  integration_reconnect_required: 'La tienda pidió volver a autorizar. Conectala de nuevo.',
  integration_not_connected: 'Primero conectá la tienda.',
  provider_unreachable: 'La tienda no respondió. Probá de nuevo en unos minutos.',
  provider_error: 'La tienda devolvió un error. Probá de nuevo en unos minutos.',
};

const errorText = (error: unknown) => {
  const reason = error instanceof ApiError ? (error.body as { error?: string } | null)?.error : undefined;
  return (reason && ERRORS[reason]) || 'No pudimos completar la acción. Probá de nuevo.';
};

const base = (slug: string) => `/api/admin/tenants/${encodeURIComponent(slug)}/integrations/marketplaces`;

export function useMarketplaceStatus(tenantSlug: string | null | undefined) {
  const [status, setStatus] = useState<MarketplaceStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      const response = await apiFetch<Partial<MarketplaceStatus> | null>(base(tenantSlug), { tenantSlug });
      if (!response || !Array.isArray(response.providers)) throw new Error('marketplace_status_shape');
      setStatus({ providers: response.providers, upcoming: Array.isArray(response.upcoming) ? response.upcoming : [] });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [tenantSlug]);
  useEffect(() => { void reload(); }, [reload]);
  return { status, failed, reload };
}

type Props = {
  tenantSlug: string;
  provider: MarketplaceKey;
  status: MarketplaceStatus | null;
  failed?: boolean;
  onChanged: () => void;
  /** Lets tests stand in for the full-page redirect to the store. */
  navigate?: (url: string) => void;
};

export default function MarketplaceConnectionPanel({ tenantSlug, provider, status, failed, onChanged, navigate }: Props) {
  const row = status?.providers.find(item => item.key === provider) ?? null;
  const [shop, setShop] = useState('');
  const [busy, setBusy] = useState<'connect' | 'preview' | 'import' | 'disconnect' | null>(null);
  const [result, setResult] = useState<(ImportResult & { dry: boolean }) | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  if (failed) {
    return <p role="alert" className="text-sm text-muted-foreground">No pudimos leer el estado de esta conexión. Recargá la página para reintentar.</p>;
  }
  if (!row) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando conexión…</div>;
  }

  const connect = async () => {
    setBusy('connect');
    try {
      const body = row.needs_shop ? { shop } : {};
      const response = await apiFetch<{ authorize_url: string }>(`${base(tenantSlug)}/${provider}/connect`, { method: 'POST', body, tenantSlug });
      (navigate ?? ((url: string) => window.location.assign(url)))(response.authorize_url);
    } catch (error) {
      toast.error(errorText(error));
      setBusy(null);
    }
  };

  const runImport = async (dry: boolean) => {
    setBusy(dry ? 'preview' : 'import');
    try {
      const response = await apiFetch<ImportResult>(`${base(tenantSlug)}/${provider}/import`, { method: 'POST', body: { dry_run: dry }, tenantSlug });
      setResult({ ...response, dry });
      if (!dry) {
        toast.success(`Listo: ${response.created} productos nuevos y ${response.updated} actualizados.`);
        onChanged();
      }
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      await apiFetch(`${base(tenantSlug)}/${provider}/disconnect`, { method: 'POST', tenantSlug });
      toast.success(`Desconectamos ${row.label}. Tus productos siguen en el catálogo.`);
      setConfirmDisconnect(false);
      setResult(null);
      onChanged();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(null);
    }
  };

  const capabilities = (
    <ul className="flex flex-wrap gap-2" aria-label={`Qué trae ${row.label}`}>
      {row.capabilities.map(cap => (
        <li key={cap} className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground">{CAPABILITY_LABELS[cap] ?? cap}</li>
      ))}
    </ul>
  );

  if (!row.configured) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg border border-dashed border-border p-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">La conexión con {row.label} se habilita desde Chatboc</p>
            <p className="text-muted-foreground">Cuando esté activa vas a poder traer tus productos con un clic. Mientras tanto, podés subir tu catálogo desde una planilla.</p>
          </div>
        </div>
        {capabilities}
      </div>
    );
  }

  if (!row.connected) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          {row.needs_reconnect
            ? `${row.label} pidió volver a autorizar la conexión. Tus productos siguen publicados.`
            : `Conectá tu cuenta de ${row.label} y traé tus productos con precio, stock y fotos. Te vamos a llevar a ${row.label} para que autorices el acceso.`}
        </p>
        {capabilities}
        {row.needs_shop && (
          <div className="space-y-2">
            <Label htmlFor={`shop-${provider}`}>Dirección de tu tienda</Label>
            <Input id={`shop-${provider}`} value={shop} onChange={event => setShop(event.target.value)}
                   placeholder="mitienda.myshopify.com" autoComplete="off" spellCheck={false} />
          </div>
        )}
        <Button onClick={connect} disabled={busy === 'connect' || (row.needs_shop && !shop.trim())} className="w-full">
          {busy === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="mr-2 h-4 w-4" aria-hidden />}
          {row.needs_reconnect ? `Volver a conectar ${row.label}` : `Conectar con ${row.label}`}
        </Button>
        <p className="text-xs text-muted-foreground">Solo pedimos permiso para leer productos y stock. Podés desconectarla cuando quieras.</p>
      </div>
    );
  }

  const last = row.last_import;
  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">{row.account ? `Conectado a ${row.account}` : `${row.label} conectado`}</p>
          <p>
            {row.last_sync_at
              ? `Última importación ${formatDistanceToNow(new Date(row.last_sync_at), { addSuffix: true, locale: es })}${last ? `: ${last.created} nuevos y ${last.updated} actualizados.` : '.'}`
              : 'Todavía no importaste productos. Mirá primero qué se va a traer.'}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="outline" onClick={() => runImport(true)} disabled={!!busy}>
          {busy === 'preview' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Eye className="mr-2 h-4 w-4" aria-hidden />}
          Ver qué se importa
        </Button>
        <Button onClick={() => runImport(false)} disabled={!!busy}>
          {busy === 'import' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden />}
          Importar ahora
        </Button>
      </div>

      {result && (
        <section aria-live="polite" className="space-y-3 rounded-lg border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <PackageCheck className="h-4 w-4" aria-hidden />
            {result.dry
              ? `Encontramos ${result.found} productos: ${result.created} nuevos y ${result.updated} para actualizar.`
              : `Importamos ${result.created + result.updated} de ${result.found} productos.`}
          </p>
          {result.limited && <p className="text-xs text-muted-foreground">Traemos hasta 500 productos por vez. Volvé a importar para seguir.</p>}
          {result.dry && result.preview.length > 0 && (
            <ul className="divide-y divide-border">
              {result.preview.map(item => (
                <li key={item.sku} className="flex items-center gap-3 py-2">
                  {item.imagen_url
                    ? <img src={item.imagen_url} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" loading="lazy" />
                    : <span className="h-10 w-10 shrink-0 rounded-md bg-muted" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{item.nombre}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.precio ? `$ ${Number(item.precio).toLocaleString('es-AR')}` : 'Sin precio'}
                      {item.stock !== null ? `, stock ${item.stock}` : ''}
                    </span>
                  </span>
                  <span className={item.accion === 'crear'
                    ? 'rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-900/40 dark:text-sky-100'
                    : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground'}>
                    {item.accion === 'crear' ? 'Nuevo' : 'Actualiza'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="border-t border-border pt-4">
        {confirmDisconnect ? (
          <div className="space-y-3" role="group" aria-label="Confirmar desconexión">
            <p className="text-sm text-foreground">¿Desconectar {row.label}? Los productos ya importados siguen en tu catálogo, pero no se van a actualizar más.</p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={disconnect} disabled={busy === 'disconnect'}>
                {busy === 'disconnect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Unplug className="mr-2 h-4 w-4" aria-hidden />}
                Desconectar
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmDisconnect(true)}>
            <Unplug className="mr-2 h-4 w-4" aria-hidden /> Desconectar {row.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export function UpcomingMarketplaces({ status }: { status: MarketplaceStatus | null }) {
  if (!status?.upcoming.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <PlugZap className="h-4 w-4" aria-hidden />
      <span>Próximamente:</span>
      {status.upcoming.map(item => (
        <span key={item.key} className="rounded-full border border-dashed border-border px-3 py-1 text-xs">{item.label}</span>
      ))}
    </div>
  );
}
