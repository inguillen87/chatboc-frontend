import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw } from 'lucide-react';
import { Tenant } from '@/types/superAdmin';
import { WhatsappExternalNumberPayload, WhatsappNumberInventoryItem, WhatsappNumberRequestPayload, WhatsappNumberStatus } from '@/types/whatsapp';

interface WhatsappInventoryPanelProps {
  numbers: WhatsappNumberInventoryItem[];
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onReserve: (id: string | number) => void;
  onRelease: (id: string | number) => void;
  onAssign: (id: string | number, tenantSlug: string) => void;
  onVerify: (id: string | number, payload: WhatsappExternalNumberPayload) => void;
  onRequestNumber: (payload: WhatsappNumberRequestPayload) => void;
  onRegisterExternal: (payload: WhatsappExternalNumberPayload) => void;
}

const STATUS_LABELS: Record<WhatsappNumberStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  available: { label: 'Disponible', variant: 'secondary' },
  reserved: { label: 'Reservado', variant: 'outline' },
  assigned: { label: 'Asignado', variant: 'default' },
  verified: { label: 'Verificado', variant: 'secondary' },
};

const buildZoneLabel = (entry: WhatsappNumberInventoryItem) => {
  const parts = [entry.city, entry.state, entry.prefix].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Zona sin definir';
};

export const WhatsappInventoryPanel = ({
  numbers,
  tenants,
  loading,
  error,
  onRefresh,
  onReserve,
  onRelease,
  onAssign,
  onVerify,
  onRequestNumber,
  onRegisterExternal,
}: WhatsappInventoryPanelProps) => {
  const [assignTargets, setAssignTargets] = useState<Record<string, string>>({});
  const [requestForm, setRequestForm] = useState<WhatsappNumberRequestPayload>({ prefix: '', city: '', state: '' });
  const [verificationForm, setVerificationForm] = useState<WhatsappExternalNumberPayload>({
    phone_number: '',
    sender_id: '',
    token: '',
  });
  const [verifyTargetId, setVerifyTargetId] = useState<string>('');

  const tenantOptions = useMemo(() => tenants.filter((tenant) => tenant.status === 'active' || tenant.is_active), [tenants]);

  const handleAssign = (id: string | number) => {
    const key = String(id);
    const target = assignTargets[key];
    if (target) {
      onAssign(id, target);
    }
  };

  const handleVerify = () => {
    if (!verifyTargetId) return;
    onVerify(verifyTargetId, verificationForm);
  };

  return (
    <Card className="border-muted/60 shadow-sm">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>WhatsApp</CardTitle>
          <CardDescription>Inventario y asignación de números para tenants.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Recargar
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Cargando inventario...
                    </TableCell>
                  </TableRow>
                ) : numbers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No hay números cargados en el inventario.
                    </TableCell>
                  </TableRow>
                ) : (
                  numbers.map((number) => {
                    const status = STATUS_LABELS[number.status];
                    const assignKey = String(number.id);

                    return (
                      <TableRow key={assignKey}>
                        <TableCell className="font-mono">{number.phone_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{buildZoneLabel(number)}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {number.tenant_name || number.tenant_slug || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {number.status === 'available' && (
                              <Button size="sm" variant="outline" onClick={() => onReserve(number.id)}>
                                Reservar
                              </Button>
                            )}
                            {(number.status === 'reserved' || number.status === 'available') && (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={assignTargets[assignKey] || ''}
                                  onValueChange={(value) => setAssignTargets((prev) => ({ ...prev, [assignKey]: value }))}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Elegir tenant" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {tenantOptions.map((tenant) => (
                                      <SelectItem key={tenant.slug} value={tenant.slug}>
                                        {tenant.nombre}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button size="sm" onClick={() => handleAssign(number.id)} disabled={!assignTargets[assignKey]}>
                                  Asignar
                                </Button>
                              </div>
                            )}
                            {(number.status === 'assigned' || number.status === 'reserved' || number.status === 'verified') && (
                              <Button size="sm" variant="ghost" onClick={() => onRelease(number.id)}>
                                Liberar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Separator />

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Solicitar nuevo número</h3>
              <p className="text-xs text-muted-foreground">Crea nuevos números en Twilio para sumar stock al inventario.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Prefijo</Label>
                <Input
                  value={requestForm.prefix || ''}
                  onChange={(event) => setRequestForm((prev) => ({ ...prev, prefix: event.target.value }))}
                  placeholder="Ej: +54 261"
                />
              </div>
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input
                  value={requestForm.city || ''}
                  onChange={(event) => setRequestForm((prev) => ({ ...prev, city: event.target.value }))}
                  placeholder="Ciudad"
                />
              </div>
              <div className="space-y-2">
                <Label>Provincia / Estado</Label>
                <Input
                  value={requestForm.state || ''}
                  onChange={(event) => setRequestForm((prev) => ({ ...prev, state: event.target.value }))}
                  placeholder="Estado"
                />
              </div>
            </div>
            <Button
              onClick={() => onRequestNumber(requestForm)}
              disabled={!requestForm.prefix && !requestForm.city && !requestForm.state}
            >
              Solicitar número
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Registrar número verificado en Meta</h3>
              <p className="text-xs text-muted-foreground">Carga el número ya validado y su credencial para habilitarlo.</p>
            </div>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  value={verificationForm.phone_number}
                  onChange={(event) => setVerificationForm((prev) => ({ ...prev, phone_number: event.target.value }))}
                  placeholder="Ej: +54 9 261 123 456"
                />
              </div>
              <div className="space-y-2">
                <Label>Sender ID</Label>
                <Input
                  value={verificationForm.sender_id}
                  onChange={(event) => setVerificationForm((prev) => ({ ...prev, sender_id: event.target.value }))}
                  placeholder="Sender ID"
                />
              </div>
              <div className="space-y-2">
                <Label>Token</Label>
                <Input
                  value={verificationForm.token}
                  onChange={(event) => setVerificationForm((prev) => ({ ...prev, token: event.target.value }))}
                  placeholder="Token de Meta"
                />
              </div>
              <div className="space-y-2">
                <Label>Aplicar verificación a</Label>
                <Select value={verifyTargetId} onValueChange={setVerifyTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar número" />
                  </SelectTrigger>
                  <SelectContent>
                    {numbers.map((number) => (
                      <SelectItem key={String(number.id)} value={String(number.id)}>
                        {number.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => onRegisterExternal(verificationForm)}
                disabled={!verificationForm.phone_number || !verificationForm.sender_id || !verificationForm.token}
              >
                Registrar externo
              </Button>
              <Button
                onClick={handleVerify}
                disabled={!verifyTargetId || !verificationForm.sender_id || !verificationForm.token}
              >
                Validar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
