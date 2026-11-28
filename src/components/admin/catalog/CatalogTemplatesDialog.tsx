import React, { useEffect, useState } from 'react';
import { Download, LayoutTemplate, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ApiError, apiFetch } from '@/utils/api';

type CatalogTemplate = { key: string; title: string; summary: string; items: number };

const base = (slug: string) => `/api/admin/tenants/${encodeURIComponent(slug)}/marketplace`;

const downloadJson = (name: string, value: unknown) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Ready-made catalogs (for example «Beneficios ciudadanos») and the WhatsApp
 * «Tienda» form built from the published catalog.
 */
export default function CatalogTemplatesDialog({ tenantSlug, onApplied }: { tenantSlug: string; onApplied?: () => void }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<CatalogTemplate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || templates || !tenantSlug) return;
    apiFetch<{ templates: CatalogTemplate[] }>(`${base(tenantSlug)}/templates`)
      .then((body) => setTemplates(body.templates ?? []))
      .catch(() => setTemplates([]));
  }, [open, templates, tenantSlug]);

  const apply = async (template: CatalogTemplate) => {
    setBusy(template.key);
    try {
      const result = await apiFetch<{ created: number; updated: number }>(
        `${base(tenantSlug)}/templates/${encodeURIComponent(template.key)}/apply`,
        { method: 'POST' },
      );
      toast.success(
        result.created
          ? `Listo: sumamos ${result.created} ítems de «${template.title}».`
          : `Listo: actualizamos ${result.updated} ítems de «${template.title}».`,
      );
      onApplied?.();
    } catch {
      toast.error('No pudimos cargar la plantilla. Probá de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  const downloadFlow = async () => {
    setBusy('flow');
    try {
      const body = await apiFetch<{ name: string; flow_json: unknown }>(`${base(tenantSlug)}/whatsapp-flow`);
      downloadJson(`${tenantSlug}-tienda-whatsapp.json`, body.flow_json);
      toast.success('Descargamos el formulario. Pegalo en un Flow nuevo de WhatsApp Manager.');
    } catch (error) {
      const reason = error instanceof ApiError ? (error.body as { error?: string } | null)?.error : undefined;
      toast.error(reason === 'catalog_without_offers'
        ? 'Primero publicá al menos un producto, canje o donación.'
        : 'No pudimos armar el formulario. Probá de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!tenantSlug}>
          <LayoutTemplate className="mr-2 h-4 w-4" /> Plantillas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Plantillas de catálogo</DialogTitle>
          <DialogDescription>Cargá un catálogo listo y editalo después. Tus productos no se tocan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {templates === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay plantillas disponibles.</p>
          ) : (
            templates.map((template) => (
              <div key={template.key} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{template.title}</p>
                  <p className="text-sm text-muted-foreground">{template.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{template.items} ítems</p>
                </div>
                <Button size="sm" onClick={() => void apply(template)} disabled={busy !== null}>
                  {busy === template.key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cargar'}
                </Button>
              </div>
            ))
          )}
          <div className="flex items-start justify-between gap-3 rounded-lg border border-dashed p-3">
            <div>
              <p className="font-medium">Tienda por WhatsApp</p>
              <p className="text-sm text-muted-foreground">
                Formulario para comprar, canjear puntos, anotarse o donar sin salir del chat.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void downloadFlow()} disabled={busy !== null}>
              {busy === 'flow' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
