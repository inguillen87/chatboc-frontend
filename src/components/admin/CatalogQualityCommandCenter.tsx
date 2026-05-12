import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ImageOff,
  Package,
  Pencil,
  RefreshCw,
  Save,
} from "lucide-react";

import {
  getCatalogQualityV2,
  patchCatalogItemV2,
  type CatalogItemPatchPayload,
  type CatalogQualityQueueItem,
  type CatalogQualityV2,
} from "@/api/v2/saas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/utils/api";

type AnyRecord = Record<string, unknown>;

const asRecord = (value: unknown): AnyRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};

const asString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const first = (record: AnyRecord | undefined, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const formatNumber = (value: unknown) => {
  const numeric = asNumber(value);
  return numeric === null ? "--" : numeric.toLocaleString("es-AR");
};

const formatPercent = (value: unknown) => {
  const numeric = asNumber(value);
  return numeric === null ? "--" : `${Math.round(numeric)}%`;
};

const labelize = (value: string) => value.replace(/_/g, " ");

const parseLines = (value: string) =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const galleryToText = (value: unknown) => {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean).join("\n");
  return asString(value);
};

const Metric = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) => (
  <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
    <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-4 w-4" />
    </div>
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
  </div>
);

const Pill = ({
  children,
  tone = "outline",
}: {
  children: React.ReactNode;
  tone?: "outline" | "secondary";
}) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
      tone === "secondary" ? "border-transparent bg-secondary text-secondary-foreground" : "border-border bg-background"
    }`}
  >
    {children}
  </span>
);

interface CatalogQualityCommandCenterProps {
  tenantSlug?: string | null;
  marketplace?: AnyRecord;
}

export default function CatalogQualityCommandCenter({
  tenantSlug,
  marketplace,
}: CatalogQualityCommandCenterProps) {
  const [quality, setQuality] = useState<CatalogQualityV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeQueue, setActiveQueue] = useState("");
  const [selectedItem, setSelectedItem] = useState<CatalogQualityQueueItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    imagen_url: "",
    gallery_urls: "",
    precio: "",
    cantidad: "",
    descripcion_corta: "",
    promocion_info: "",
    external_url: "",
    checkout_type: "",
  });

  const loadQuality = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCatalogQualityV2(tenantSlug);
      setQuality(response);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cargar la calidad del catalogo."));
      setQuality(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuality();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const summary = quality?.summary ?? asRecord(first(marketplace, ["summary", "image_summary", "media_summary"]));
  const queueTabs = useMemo(() => {
    const contractTabs = Array.isArray(quality?.frontend_contract.queue_tabs)
      ? quality?.frontend_contract.queue_tabs.map(asString).filter(Boolean)
      : [];
    const queueKeys = Object.keys(quality?.queues ?? {});
    return contractTabs.length ? contractTabs : queueKeys;
  }, [quality]);

  useEffect(() => {
    if (!activeQueue && queueTabs.length) setActiveQueue(queueTabs[0]);
  }, [activeQueue, queueTabs]);

  useEffect(() => {
    if (!selectedItem) return;
    const raw = selectedItem.raw;
    setSaveMessage(null);
    setForm({
      imagen_url: selectedItem.image_url || "",
      gallery_urls: galleryToText(first(raw, ["gallery_urls", "imagenes", "images", "image_urls"])),
      precio: asString(first(raw, ["precio", "price"])),
      cantidad: asString(first(raw, ["cantidad", "stock", "available_stock"])),
      descripcion_corta: asString(first(raw, ["descripcion_corta", "short_description", "description"])),
      promocion_info: asString(first(raw, ["promocion_info", "promotion", "promo"])),
      external_url: asString(first(raw, ["external_url", "url", "link"])),
      checkout_type: asString(first(raw, ["checkout_type"])),
    });
  }, [selectedItem]);

  const activeItems = quality?.queues[activeQueue] ?? [];
  const imports = quality?.imports;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItem || !tenantSlug) {
      setSaveMessage("Falta tenant_slug o producto para aplicar el cambio.");
      return;
    }
    const payload: CatalogItemPatchPayload = {
      imagen_url: form.imagen_url.trim() || undefined,
      gallery_urls: parseLines(form.gallery_urls),
      precio: form.precio.trim() || undefined,
      cantidad: form.cantidad.trim() || undefined,
      descripcion_corta: form.descripcion_corta.trim() || undefined,
      promocion_info: form.promocion_info.trim() || undefined,
      external_url: form.external_url.trim() || undefined,
      checkout_type: form.checkout_type.trim() || undefined,
    };
    if (!payload.gallery_urls?.length) delete payload.gallery_urls;
    setSaving(true);
    setSaveMessage(null);
    try {
      await patchCatalogItemV2(tenantSlug, selectedItem.item_id ?? selectedItem.id, payload);
      setSaveMessage("Cambio aplicado. Refrescando cola...");
      await loadQuality();
    } catch (err) {
      setSaveMessage(getErrorMessage(err, "No se pudo actualizar el producto."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Catalog quality</CardTitle>
          <CardDescription>
            Cabina de calidad desde `catalog.quality.v1`, con colas y edicion inline por contrato.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={loadQuality} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Ready" value={formatPercent(first(summary, ["ready_rate"]))} icon={CheckCircle2} />
          <Metric label="Productos" value={formatNumber(first(summary, ["products", "total"]))} icon={Package} />
          <Metric label="Sin imagen" value={formatNumber(first(summary, ["missing_images", "products_without_image"]))} icon={ImageOff} />
          <Metric label="Bulk" value={asString(first(summary, ["bulk_import_status"])) || "v2"} icon={Database} />
        </div>

        <div className="flex flex-wrap gap-2">
          {queueTabs.map((queue) => {
            const selected = activeQueue === queue;
            const count = quality?.queues[queue]?.length ?? 0;
            return (
              <button
                key={queue}
                type="button"
                onClick={() => {
                  setActiveQueue(queue);
                  setSelectedItem(null);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border/70 hover:bg-muted"
                }`}
              >
                {labelize(queue)} - {count}
              </button>
            );
          })}
          {!queueTabs.length && !loading ? (
            <Pill>Sin colas publicadas</Pill>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-border/60">
            <div className="grid grid-cols-[76px_minmax(0,1fr)_110px_90px] gap-3 border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Imagen</span>
              <span>Producto</span>
              <span>Precio</span>
              <span>Accion</span>
            </div>
            <div className="divide-y">
              {activeItems.map((item) => (
                <div
                  key={`${activeQueue}_${item.id}`}
                  className="grid grid-cols-[76px_minmax(0,1fr)_110px_90px] items-center gap-3 px-4 py-3 text-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                      {item.sku ? <span>{item.sku}</span> : null}
                      {item.category ? <span>{item.category}</span> : null}
                      {item.status ? <span>{item.status}</span> : null}
                    </div>
                  </div>
                  <span className="text-muted-foreground">{asString(item.price) || "--"}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedItem(item)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              ))}
              {!activeItems.length ? (
                <div className="px-4 py-8 text-sm text-muted-foreground">
                  {loading ? "Cargando cola..." : "No hay productos en esta cola."}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 p-4">
            <h3 className="font-semibold">Edicion inline</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {"Usa PATCH /api/admin/tenants/{tenant}/catalog/items/{item}."}
            </p>
            {selectedItem ? (
              <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
                <Input
                  value={form.imagen_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, imagen_url: event.target.value }))}
                  placeholder="imagen_url"
                />
                <Textarea
                  value={form.gallery_urls}
                  onChange={(event) => setForm((prev) => ({ ...prev, gallery_urls: event.target.value }))}
                  placeholder="gallery_urls, una por linea"
                  className="min-h-[92px]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={form.precio}
                    onChange={(event) => setForm((prev) => ({ ...prev, precio: event.target.value }))}
                    placeholder="precio"
                  />
                  <Input
                    value={form.cantidad}
                    onChange={(event) => setForm((prev) => ({ ...prev, cantidad: event.target.value }))}
                    placeholder="stock"
                  />
                </div>
                <Input
                  value={form.descripcion_corta}
                  onChange={(event) => setForm((prev) => ({ ...prev, descripcion_corta: event.target.value }))}
                  placeholder="descripcion_corta"
                />
                <Input
                  value={form.promocion_info}
                  onChange={(event) => setForm((prev) => ({ ...prev, promocion_info: event.target.value }))}
                  placeholder="promocion_info"
                />
                <Input
                  value={form.external_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, external_url: event.target.value }))}
                  placeholder="external_url"
                />
                <Input
                  value={form.checkout_type}
                  onChange={(event) => setForm((prev) => ({ ...prev, checkout_type: event.target.value }))}
                  placeholder="checkout_type"
                />
                <Button type="submit" className="w-full" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                {saveMessage ? <p className="text-xs text-muted-foreground">{saveMessage}</p> : null}
              </form>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Selecciona un producto de la cola para editarlo.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/60 p-4">
            <div className="font-semibold">Import wizard</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {"Legacy: /api/admin/catalogo/importar - Nuevo: /api/admin/catalog/import."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(imports?.accepted_file_types ?? []).map((item) => (
                <Pill key={item}>
                  {item}
                </Pill>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 p-4">
            <div className="font-semibold">Columnas de imagen</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(imports?.image_columns ?? []).map((item) => (
                <Pill key={item} tone="secondary">
                  {item}
                </Pill>
              ))}
              {!imports?.image_columns?.length ? (
                <span className="text-sm text-muted-foreground">El backend no publico columnas detectables todavia.</span>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
