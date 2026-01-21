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
import { WhatsappExternalNumberPayload, WhatsappNumberCreatePayload, WhatsappNumberInventoryItem, WhatsappNumberStatus } from '@/types/whatsapp';

interface WhatsappInventoryPanelProps {
  numbers: WhatsappNumberInventoryItem[];
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onReserve: (payload: { number_id: string | number; tenant_slug?: string | null }) => void;
  onRelease: (payload: { number_id: string | number }) => void;
  onAssign: (payload: { number_id: string | number; tenant_slug: string }) => void;
  onCreateNumber: (payload: WhatsappNumberCreatePayload) => void;
  onRegisterExternal: (payload: WhatsappExternalNumberPayload) => void;
}

const STATUS_LABELS: Record<WhatsappNumberStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  available: { label: 'Disponible', variant: 'secondary' },
  reserved: { label: 'Reservado', variant: 'outline' },
  assigned: { label: 'Asignado', variant: 'default' },
  verified: { label: 'Verificado', variant: 'secondary' },
  disabled: { label: 'Deshabilitado', variant: 'destructive' },
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
  onCreateNumber,
  onRegisterExternal,
}: WhatsappInventoryPanelProps) => {
  const [assignTargets, setAssignTargets] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState<WhatsappNumberCreatePayload>({
    phone_number: '',
    sender_id: '',
    status: 'available',
    tenant_slug: '',
  });
  const [verificationForm, setVerificationForm] = useState<WhatsappExternalNumberPayload>({
    number: '',
    sender_id: '',
    status: 'verified',
    tenant_slug: '',
  });

  const tenantOptions = useMemo(() => tenants.filter((tenant) => tenant.status === 'active' || tenant.is_active), [tenants]);

  const handleAssign = (id: string | number) => {
    const key = String(id);
    const target = assignTargets[key];
    if (target) {
      onAssign({ number_id: id, tenant_slug: target });
    }
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
                          {number.tenant_nombre || number.tenant_slug || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {number.status === 'available' && (
                              <Button size="sm" variant="outline" onClick={() => onReserve({ number_id: number.id, tenant_slug: number.tenant_slug })}>
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
                              <Button size="sm" variant="ghost" onClick={() => onRelease({ number_id: number.id })}>
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
              <h3 className="text-sm font-semibold text-foreground">Crear número</h3>
              <p className="text-xs text-muted-foreground">Registra un número nuevo en Twilio para el inventario.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  value={createForm.phone_number}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, phone_number: event.target.value }))}
                  placeholder="Ej: +549261555111"
                />
              </div>
              <div className="space-y-2">
                <Label>Sender ID</Label>
                <Input
                  value={createForm.sender_id}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, sender_id: event.target.value }))}
                  placeholder="whatsapp:+549261555111"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tenant (opcional)</Label>
                <Select
                  value={createForm.tenant_slug || ''}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, tenant_slug: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Asignar a tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {tenantOptions.map((tenant) => (
                      <SelectItem key={tenant.slug} value={tenant.slug}>
                        {tenant.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado inicial</Label>
                <Select
                  value={createForm.status || 'available'}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, status: value as WhatsappNumberStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponible</SelectItem>
                    <SelectItem value="reserved">Reservado</SelectItem>
                    <SelectItem value="assigned">Asignado</SelectItem>
                    <SelectItem value="verified">Verificado</SelectItem>
                    <SelectItem value="disabled">Deshabilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() =>
                onCreateNumber({
                  ...createForm,
                  tenant_slug: createForm.tenant_slug ? createForm.tenant_slug : null,
                })
              }
              disabled={!createForm.phone_number || !createForm.sender_id}
            >
              Crear número
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
                  value={verificationForm.number}
                  onChange={(event) => setVerificationForm((prev) => ({ ...prev, number: event.target.value }))}
                  placeholder="Ej: +549261555111"
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
                <Label>Tenant</Label>
                <Select
                  value={verificationForm.tenant_slug || ''}
                  onValueChange={(value) => setVerificationForm((prev) => ({ ...prev, tenant_slug: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Asignar a tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {tenantOptions.map((tenant) => (
                      <SelectItem key={tenant.slug} value={tenant.slug}>
                        {tenant.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  onRegisterExternal({
                    ...verificationForm,
                    tenant_slug: verificationForm.tenant_slug ? verificationForm.tenant_slug : null,
                  })
                }
                disabled={!verificationForm.number || !verificationForm.sender_id}
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
