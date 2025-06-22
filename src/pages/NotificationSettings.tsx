import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

interface Settings {
  email: boolean;
  sms: boolean;
  ticket: boolean;
}

export default function NotificationSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Settings>('/notifications')
      .then((data) => setSettings(data))
      .catch(() => setSettings({ email: false, sms: false, ticket: false }));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/notifications', {
        method: 'PUT',
        body: settings,
      });
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p>Cargando...</p>;

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Notificaciones</h1>
      <div className="flex items-center justify-between">
        <span>Correo electrónico</span>
        <Switch
          checked={settings.email}
          onCheckedChange={(v) => setSettings({ ...settings, email: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <span>SMS</span>
        <Switch
          checked={settings.sms}
          onCheckedChange={(v) => setSettings({ ...settings, sms: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <span>Cambios en tickets</span>
        <Switch
          checked={settings.ticket}
          onCheckedChange={(v) => setSettings({ ...settings, ticket: v })}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Guardando...' : 'Guardar'}
      </Button>
    </div>
  );
}
