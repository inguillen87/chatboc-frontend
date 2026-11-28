import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, Pause, Play, Wallet } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/utils/api';

type LinkTemplate = {
  key: string;
  title: string;
  concept: string;
  hint: string;
  free_amount: boolean;
};

type PaymentLink = {
  code: string;
  url: string;
  concept: string;
  amount: string | null;
  free_amount: boolean;
  active: boolean;
  paid_count: number;
  collected: string;
};

type Listing = { payment_ready: boolean; templates: LinkTemplate[]; links: PaymentLink[] };

const base = (slug: string) => `/api/admin/tenants/${encodeURIComponent(slug)}/payment-links`;

const ERRORS: Record<string, string> = {
  payment_link_amount_invalid: 'Poné un monto válido, por ejemplo 5000.',
  payment_link_template_invalid: 'Elegí qué tipo de cobro es.',
};

/** Charges shared as a link: a deposit, a fee, a ticket, a donation… paid with Mercado Pago. */
export default function PaymentLinksDialog({ tenantSlug }: { tenantSlug: string }) {
  const [open, setOpen] = useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const [template, setTemplate] = useState<LinkTemplate | null>(null);
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<Listing>(base(tenantSlug))
      .then(setListing)
      .catch(() => setListing({ payment_ready: false, templates: [], links: [] }));
  }, [tenantSlug]);

  useEffect(() => {
    if (open && tenantSlug) load();
  }, [open, tenantSlug, load]);

  const choose = (next: LinkTemplate) => {
    setTemplate(next);
    setConcept(next.concept);
    setAmount('');
  };

  const copy = async (link: PaymentLink) => {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success('Link copiado. Pegalo en WhatsApp o donde quieras.');
    } catch {
      toast.message(link.url);
    }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!template) return;
    setBusy('create');
    try {
      const link = await apiFetch<PaymentLink>(base(tenantSlug), {
        method: 'POST',
        body: template.free_amount
          ? { template: template.key, concept, min_amount: amount || undefined }
          : { template: template.key, concept, amount },
      });
      setTemplate(null);
      load();
      await copy(link);
    } catch (error) {
      const reason = error instanceof ApiError ? (error.body as { error?: string } | null)?.error : undefined;
      toast.error((reason && ERRORS[reason]) || 'No pudimos crear el cobro. Probá de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (link: PaymentLink) => {
    setBusy(link.code);
    try {
      await apiFetch(`${base(tenantSlug)}/${encodeURIComponent(link.code)}`, {
        method: 'PATCH',
        body: { active: !link.active },
      });
      load();
    } catch {
      toast.error('No pudimos cambiar el cobro. Probá de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!tenantSlug}>
          <Wallet className="mr-2 h-4 w-4" /> Cobros
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cobros por link</DialogTitle>
          <DialogDescription>
            Creá un cobro y compartí el link por WhatsApp, en un QR o en tu web. Se paga con Mercado Pago y la persona
            recibe su comprobante.
          </DialogDescription>
        </DialogHeader>

        {listing === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        ) : (
          <div className="space-y-5">
            {!listing.payment_ready ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                Para cobrar, conectá Mercado Pago en la configuración de pagos. Podés crear los links ahora: se activan
                solos cuando Mercado Pago esté listo.
              </p>
            ) : null}

            {template ? (
              <form onSubmit={create} className="space-y-3 rounded-lg border p-3">
                <p className="font-medium">{template.title}</p>
                <div className="space-y-1">
                  <Label htmlFor="payment-link-concept">Concepto</Label>
                  <Input
                    id="payment-link-concept"
                    value={concept}
                    maxLength={120}
                    onChange={(event) => setConcept(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment-link-amount">
                    {template.free_amount ? 'Monto mínimo (opcional)' : 'Monto en pesos'}
                  </Label>
                  <Input
                    id="payment-link-amount"
                    inputMode="decimal"
                    placeholder={template.free_amount ? 'Sin mínimo' : '5000'}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required={!template.free_amount}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setTemplate(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={busy !== null}>
                    {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear y copiar link'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {listing.templates.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => choose(item)}
                    className="rounded-lg border p-3 text-left hover:bg-muted focus-visible:outline focus-visible:outline-2"
                  >
                    <span className="block font-medium">{item.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.hint}</span>
                  </button>
                ))}
              </div>
            )}

            {listing.links.length ? (
              <ul className="space-y-2" aria-label="Tus cobros">
                {listing.links.map((link) => (
                  <li key={link.code} className={`rounded-lg border p-3 ${link.active ? '' : 'opacity-60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{link.concept}</p>
                        <p className="text-sm text-muted-foreground">
                          {link.free_amount ? 'Monto libre' : link.amount}
                          {link.active ? '' : ' · pausado'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {link.paid_count === 1 ? '1 pago' : `${link.paid_count} pagos`} · {link.collected} recaudado
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" aria-label={`Copiar link de ${link.concept}`} onClick={() => void copy(link)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={link.active ? `Pausar ${link.concept}` : `Reactivar ${link.concept}`}
                          onClick={() => void toggle(link)}
                          disabled={busy !== null}
                        >
                          {link.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
