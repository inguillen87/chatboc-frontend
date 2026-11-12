import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type ReceiptHeader = { enabled: boolean; image_url: string } | null;

export const isReceiptHeader = (value: unknown): value is ReceiptHeader => {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 2 && Object.hasOwn(item, 'enabled') && Object.hasOwn(item, 'image_url') &&
    typeof item.enabled === 'boolean' && typeof item.image_url === 'string';
};

export const receiptHeaderUrlValid = (value: string): boolean => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    // URL() normalizes dot segments. Validate the supplied path first so a
    // rejected server value cannot be fetched by the preview while editing.
    const suppliedPath = decodeURIComponent(/^https:\/\/[^/?#]+([^?#]*)/i.exec(value)?.[1] || '');
    return value.length <= 2048 && !/[\s\\]/.test(value) && url.protocol === 'https:' &&
      !/[\s\\\x00-\x1f]/.test(suppliedPath) && !suppliedPath.split('/').some(part => part === '.' || part === '..') &&
      !url.username && !url.password && !url.search && !url.hash && (!url.port || url.port === '443') &&
      /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) && !host.endsWith('.local') && !host.endsWith('.internal') &&
      !host.endsWith('.localhost') && !host.endsWith('.invalid') && !/^\d+(?:\.\d+){3}$/.test(host) &&
      /\.(png|jpe?g|webp)$/i.test(url.pathname);
  } catch { return false; }
};

export default function ReceiptCampaignHeader({ value, onChange }: {
  value: ReceiptHeader; onChange: (next: ReceiptHeader) => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const mode = value === null ? 'inherit' : value.enabled ? 'image' : 'disabled';
  const url = value?.image_url || '';
  return <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-4" aria-labelledby="receipt-header-title">
    <h4 id="receipt-header-title" className="font-semibold">Cabecera de comprobantes de WhatsApp</h4>
    <p className="text-sm leading-6 text-muted-foreground">Mostrá una campaña, una novedad o la marca de esta organización encima del comprobante. La imagen no cambia el logo institucional ni publica datos del reclamo.</p>
    <div className="space-y-2">
      <Label htmlFor="receipt-header-mode">Imagen en los comprobantes</Label>
      <select id="receipt-header-mode" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" value={mode}
        onChange={event => onChange(event.target.value === 'inherit' ? null : { enabled: event.target.value === 'image', image_url: event.target.value === 'disabled' ? '' : url })}>
        <option value="inherit">Usar campaña configurada o logo de la organización</option>
        <option value="image">Usar una imagen propia</option>
        <option value="disabled">Sin imagen</option>
      </select>
    </div>
    {mode === 'image' ? <div className="space-y-2">
      <Label htmlFor="receipt-header-url">URL pública de la imagen</Label>
      <Input id="receipt-header-url" type="url" inputMode="url" maxLength={2048} value={url} placeholder="https://…/campana.png"
        aria-describedby="receipt-header-url-help" onChange={event => onChange({ enabled: true, image_url: event.target.value })} />
      <p id="receipt-header-url-help" className="text-xs leading-5 text-muted-foreground">PNG, JPG o WebP mediante HTTPS, sin claves, parámetros ni datos privados. Usá una imagen autorizada de tu organización.</p>
      {receiptHeaderUrlValid(url) && failedUrl !== url ? <img src={url} alt="Vista previa de la cabecera del comprobante" referrerPolicy="no-referrer"
        className="max-h-52 w-full rounded-lg border border-border bg-background object-contain" onError={() => setFailedUrl(url)} /> : null}
      {failedUrl === url && url ? <p role="status" className="text-sm text-muted-foreground">No pudimos cargar la vista previa. Revisá que la imagen sea pública.</p> : null}
    </div> : null}
    <p className="text-xs leading-5 text-muted-foreground">WhatsApp permite imágenes durante una conversación vigente. Fuera de esa ventana se conserva la plantilla aprobada. La vista previa no confirma la entrega del proveedor.</p>
  </section>;
}
