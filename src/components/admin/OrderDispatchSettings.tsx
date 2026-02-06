import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Truck, Mail, MessageSquare, Save } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

const OrderDispatchSettings = () => {
  const { currentSlug } = useTenant();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings
  const [dispatchEmail, setDispatchEmail] = useState('');
  const [dispatchPhone, setDispatchPhone] = useState('');
  const [sendBuyerEmail, setSendBuyerEmail] = useState(true);
  const [sendDispatchEmail, setSendDispatchEmail] = useState(true);
  const [sendDispatchWhatsapp, setSendDispatchWhatsapp] = useState(true);

  useEffect(() => {
    if (currentSlug) {
      loadSettings();
    }
  }, [currentSlug]);

  const loadSettings = async () => {
    setLoading(true);
    try {
        if (!currentSlug) return;
        // Using getFulfillmentConfig as per new plan
        const settings = await apiClient.getFulfillmentConfig(currentSlug);
        if (settings && settings.tenant) {
            setDispatchEmail(settings.tenant.dispatch_email || '');
            setDispatchPhone(settings.tenant.dispatch_phone || '');
            setSendBuyerEmail(settings.tenant.send_buyer_email ?? true);
            setSendDispatchEmail(settings.tenant.send_dispatch_email ?? true);
            setSendDispatchWhatsapp(settings.tenant.send_dispatch_whatsapp ?? true);
        }
    } catch (error) {
        console.error("Failed to load dispatch settings", error);
        // Fallback: don't break UI, just leave defaults or empty
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentSlug) return;
    setSaving(true);
    try {
        // Updated payload structure for the new endpoint
        const payload = {
            dispatch_email: dispatchEmail,
            dispatch_phone: dispatchPhone,
            send_buyer_email: sendBuyerEmail,
            send_dispatch_email: sendDispatchEmail,
            send_dispatch_whatsapp: sendDispatchWhatsapp
        };
        await apiClient.updateFulfillmentConfig(currentSlug, payload);
        toast.success("Configuración de despacho guardada.");
    } catch (error) {
        console.error("Save failed", error);
        toast.error("No se pudo guardar la configuración.");
    } finally {
        setSaving(false);
    }
  };

  if (loading) {
      return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/></div>;
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5"/> Despacho de Pedidos</CardTitle>
            <CardDescription>
                Configura a quién notificar cuando se confirma una compra para preparar el envío.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">Notificar al Comprador</Label>
                        <p className="text-xs text-muted-foreground">Enviar email de confirmación automático al cliente.</p>
                    </div>
                    <Switch checked={sendBuyerEmail} onCheckedChange={setSendBuyerEmail} />
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2"><Mail className="h-4 w-4"/> Email de Depósito</Label>
                        <Switch checked={sendDispatchEmail} onCheckedChange={setSendDispatchEmail} />
                    </div>
                    <Input
                        placeholder="deposito@ejemplo.com"
                        value={dispatchEmail}
                        onChange={e => setDispatchEmail(e.target.value)}
                        disabled={!sendDispatchEmail}
                    />
                    <p className="text-xs text-muted-foreground">Se enviará un PDF con el detalle del pedido para preparar.</p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2"><MessageSquare className="h-4 w-4"/> WhatsApp Logística</Label>
                        <Switch checked={sendDispatchWhatsapp} onCheckedChange={setSendDispatchWhatsapp} />
                    </div>
                    <Input
                        placeholder="54911..., 54911..."
                        value={dispatchPhone}
                        onChange={e => setDispatchPhone(e.target.value)}
                        disabled={!sendDispatchWhatsapp}
                    />
                    <p className="text-xs text-muted-foreground">Se enviará un aviso inmediato al equipo de preparación. Separa múltiples números con comas.</p>
                </div>
            </div>
        </CardContent>
        <CardFooter className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                Guardar Configuración
            </Button>
        </CardFooter>
    </Card>
  );
};

export default OrderDispatchSettings;
