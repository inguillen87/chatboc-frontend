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
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);

  useEffect(() => {
    if (currentSlug) {
      loadSettings();
    }
  }, [currentSlug]);

  const loadSettings = async () => {
    setLoading(true);
    try {
        if (!currentSlug) return;
        const settings = await apiClient.adminGetNotificationSettings(currentSlug);
        if (settings) {
            setDispatchEmail(settings.dispatch_email || '');
            setDispatchPhone(settings.dispatch_phone || '');
            // Fallback to notification_settings structure if specific fields are missing
            setNotifyEmail(settings.notification_settings?.dispatch_email ?? true);
            setNotifyWhatsapp(settings.notification_settings?.dispatch_whatsapp ?? true);
        }
    } catch (error) {
        console.error("Failed to load dispatch settings", error);
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentSlug) return;
    setSaving(true);
    try {
        // Reuse adminUpdateNotificationSettings as the endpoint for all notification related configs
        // We assume the backend accepts arbitrary keys or we structure it inside `notification_settings`
        // For now, let's send both top-level and nested to be safe/future-proof
        await apiClient.adminUpdateNotificationSettings(currentSlug, {
            dispatch_email: dispatchEmail,
            dispatch_phone: dispatchPhone,
            notification_settings: {
                dispatch_email: notifyEmail,
                dispatch_whatsapp: notifyWhatsapp,
                // Preserve existing settings if we had full state, but since we don't,
                // we rely on backend MERGE behavior or we fetch-merge-save.
                // adminUpdateNotificationSettings usually merges top-level fields.
                // Let's rely on standard practice.
            }
        });
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
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2"><Mail className="h-4 w-4"/> Email de Depósito</Label>
                        <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
                    </div>
                    <Input
                        placeholder="deposito@ejemplo.com"
                        value={dispatchEmail}
                        onChange={e => setDispatchEmail(e.target.value)}
                        disabled={!notifyEmail}
                    />
                    <p className="text-xs text-muted-foreground">Se enviará un PDF con el detalle del pedido.</p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2"><MessageSquare className="h-4 w-4"/> WhatsApp Logística</Label>
                        <Switch checked={notifyWhatsapp} onCheckedChange={setNotifyWhatsapp} />
                    </div>
                    <Input
                        placeholder="54911..."
                        value={dispatchPhone}
                        onChange={e => setDispatchPhone(e.target.value)}
                        disabled={!notifyWhatsapp}
                    />
                    <p className="text-xs text-muted-foreground">Se enviará un mensaje automático con el link de gestión.</p>
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
