import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, LogIn } from 'lucide-react';

export interface GuestContactValues {
  nombre: string;
  email: string;
  telefono: string;
}

interface GuestContactDialogProps {
  open: boolean;
  defaultValues?: Partial<GuestContactValues>;
  reason: 'checkout' | 'points';
  onLogin?: () => void;
  onClose: () => void;
  onSubmit: (values: GuestContactValues) => void;
}

const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim());
const isValidPhone = (value: string) => value.replace(/\D/g, '').length >= 6;

export const GuestContactDialog: React.FC<GuestContactDialogProps> = ({
  open,
  defaultValues,
  reason,
  onLogin,
  onClose,
  onSubmit,
}) => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [errors, setErrors] = useState<string | null>(null);

  useEffect(() => {
    setNombre(defaultValues?.nombre ?? '');
    setEmail(defaultValues?.email ?? '');
    setTelefono(defaultValues?.telefono ?? '');
    setErrors(null);
  }, [defaultValues, open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!nombre.trim()) {
      setErrors('Ingresa tu nombre para poder contactarte.');
      return;
    }
    if (!isValidEmail(email)) {
      setErrors('Necesitamos un email válido para enviarte el comprobante.');
      return;
    }
    if (!isValidPhone(telefono)) {
      setErrors('Ingresa un teléfono o WhatsApp para coordinar la entrega.');
      return;
    }
    setErrors(null);
    onSubmit({ nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() });
  };

  const headline =
    reason === 'points'
      ? 'Inicia sesión o deja tus datos para canjear'
      : 'Deja tus datos para finalizar tu compra';

  const helperCopy =
    reason === 'points'
      ? 'Si no inicias sesión, podremos registrar tu pedido pero no aplicaremos puntos a tu cuenta hasta que te identifiques.'
      : 'Usaremos estos datos para confirmar tu pedido y enviarte el comprobante.';

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{headline}</DialogTitle>
          <DialogDescription>{helperCopy}</DialogDescription>
        </DialogHeader>

        {reason === 'points' && (
          <Alert className="bg-amber-50 text-amber-900 border-amber-200 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <AlertDescription>
              Al iniciar sesión vinculamos automáticamente tus puntos y beneficios. Si prefieres continuar como invitado, deja
              tus datos de contacto.
            </AlertDescription>
          </Alert>
        )}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="guest-name">Nombre y apellido</Label>
            <Input
              id="guest-name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Tu nombre completo"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="guest-email">Email</Label>
              <Input
                id="guest-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tucorreo@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-phone">Teléfono</Label>
              <Input
                id="guest-phone"
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
                placeholder="Teléfono o WhatsApp"
              />
            </div>
          </div>

          {errors && <p className="text-sm text-destructive">{errors}</p>}

          <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>Guardamos estos datos solo para contactarte por el pedido.</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              {onLogin && (
                <Button type="button" variant="outline" onClick={onLogin} className="gap-2">
                  <LogIn className="h-4 w-4" /> Iniciar sesión
                </Button>
              )}
              <Button type="submit">Guardar y continuar</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GuestContactDialog;
