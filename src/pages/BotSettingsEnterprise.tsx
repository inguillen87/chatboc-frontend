import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/context/TenantContext';
import { ApiError } from '@/utils/api';
import { enterpriseService, type BotSettingsPayload } from '@/services/enterpriseService';
import { getEnterpriseErrorMessage } from '@/utils/enterpriseErrors';
import { hasBotSettingsErrors, sanitizeBotSettingsPayload, validateBotSettings } from '@/utils/botSettings';

const BotSettingsEnterprise = () => {
  const { tenant, currentSlug } = useTenant();
  const navigate = useNavigate();
  const tenantId = tenant?.id ? Number(tenant.id) : 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<BotSettingsPayload>({
    tenant_id: 0,
    name: '',
    tone: '',
    system_prompt: '',
    fallback_behavior: 'auto_reply',
    branding: {
      logo_url: '',
      primary_color: '',
      secondary_color: '',
    },
  });

  useEffect(() => {
    const load = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await enterpriseService.getBotSettings(tenantId, currentSlug || undefined);
        setForm({
          tenant_id: tenantId,
          name: data?.settings?.name || '',
          tone: data?.settings?.tone || '',
          system_prompt: data?.settings?.system_prompt || '',
          fallback_behavior: data?.settings?.fallback_behavior || 'auto_reply',
          branding: {
            logo_url: data?.settings?.branding?.logo_url || '',
            primary_color: data?.settings?.branding?.primary_color || '',
            secondary_color: data?.settings?.branding?.secondary_color || '',
          },
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          navigate('/permission-denied');
          return;
        }
        const status = err instanceof ApiError ? err.status : undefined;
        setError(getEnterpriseErrorMessage(status, 'load_bot_settings'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantId, currentSlug, navigate]);

  const validation = useMemo(() => validateBotSettings(form), [form]);
  const isValid = useMemo(() => !hasBotSettingsErrors(validation), [validation]);

  const handleSave = async () => {
    if (!tenantId || !isValid) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await enterpriseService.updateBotSettings(
        sanitizeBotSettingsPayload(form, tenantId),
        currentSlug || undefined,
      );
      setSuccess('Configuración guardada.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        navigate('/permission-denied');
        return;
      }
      const status = err instanceof ApiError ? err.status : undefined;
      setError(getEnterpriseErrorMessage(status, 'save_bot_settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  if (!tenantId) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuración del bot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Necesitás seleccionar un tenant para editar la configuración.</p>
            <Button variant="outline" onClick={() => navigate('/analytics')}>Ir a analytics</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuración del bot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Input
              value={form.name || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre bot"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{validation.name || 'Nombre visible del asistente.'}</span>
              <span>{(form.name || '').length}/120</span>
            </div>
          </div>
          <div className="space-y-1">
            <Input
              value={form.tone || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
              placeholder="Tono"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{validation.tone || 'Ejemplo: profesional, cercano, directo.'}</span>
              <span>{(form.tone || '').length}/120</span>
            </div>
          </div>
          <div className="space-y-1">
            <Textarea
              value={form.system_prompt || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, system_prompt: e.target.value }))}
              placeholder="System prompt"
              rows={6}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{validation.system_prompt || 'Instrucciones internas del bot para este tenant.'}</span>
              <span>{(form.system_prompt || '').length}/4000</span>
            </div>
          </div>
          <Select
            value={form.fallback_behavior || 'auto_reply'}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, fallback_behavior: value as BotSettingsPayload['fallback_behavior'] }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="derivar_humano">derivar_humano</SelectItem>
              <SelectItem value="auto_reply">auto_reply</SelectItem>
              <SelectItem value="silent">silent</SelectItem>
            </SelectContent>
          </Select>
          {validation.fallback_behavior ? <p className="text-xs text-destructive">{validation.fallback_behavior}</p> : null}
          <div className="space-y-1">
            <Input
              value={form.branding?.logo_url || ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, branding: { ...prev.branding, logo_url: e.target.value } }))
              }
              placeholder="Logo URL"
            />
            {validation.logo_url ? <p className="text-xs text-destructive">{validation.logo_url}</p> : null}
          </div>
          <div className="space-y-1">
            <Input
              value={form.branding?.primary_color || ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, branding: { ...prev.branding, primary_color: e.target.value } }))
              }
              placeholder="Color primario"
            />
            {validation.primary_color ? <p className="text-xs text-destructive">{validation.primary_color}</p> : null}
          </div>
          <div className="space-y-1">
            <Input
              value={form.branding?.secondary_color || ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, branding: { ...prev.branding, secondary_color: e.target.value } }))
              }
              placeholder="Color secundario"
            />
            {validation.secondary_color ? <p className="text-xs text-destructive">{validation.secondary_color}</p> : null}
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {success ? <p className="text-green-600 text-sm">{success}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={!isValid || saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  branding: {
                    ...prev.branding,
                    primary_color: '',
                    secondary_color: '',
                  },
                }))
              }
              disabled={saving}
            >
              Limpiar colores
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BotSettingsEnterprise;
