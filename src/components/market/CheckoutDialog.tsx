import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface CheckoutDialogProps {
  open: boolean;
  defaultName?: string;
  defaultPhone?: string;
  onClose: () => void;
  onSubmit: (payload: { name?: string; phone: string }) => void;
  isSubmitting?: boolean;
}

export default function CheckoutDialog({
  open,
  defaultName,
  defaultPhone,
  onClose,
  onSubmit,
  isSubmitting,
}: CheckoutDialogProps) {
  const [name, setName] = useState(defaultName ?? '');
  const [phone, setPhone] = useState(defaultPhone ?? '');

  useEffect(() => {
    if (open) {
      setName(defaultName ?? '');
      setPhone(defaultPhone ?? '');
    }
  }, [defaultName, defaultPhone, open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!phone.trim()) return;
    onSubmit({ name: name.trim() || undefined, phone: phone.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Datos para confirmar el pedido</DialogTitle>
          <DialogDescription>
            Necesitamos tu teléfono para enviarte el detalle por WhatsApp o SMS.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="market-name">Nombre</Label>
            <Input
              id="market-name"
              autoComplete="name"
              placeholder="Tu nombre"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="market-phone">Teléfono *</Label>
            <Input
              id="market-phone"
              autoComplete="tel"
              inputMode="tel"
              placeholder="Ej. +54 9 11 1234-5678"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!phone.trim() || isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Continuar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
