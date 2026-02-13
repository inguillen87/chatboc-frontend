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
    nombre_bot: '',
    tono: '',
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
          nombre_bot: data?.nombre_bot || '',
          tono: data?.tono || '',
          system_prompt: data?.system_prompt || '',
          fallback_behavior: data?.fallback_behavior || 'auto_reply',
          branding: {
            logo_url: data?.branding?.logo_url || '',
            primary_color: data?.branding?.primary_color || '',
            secondary_color: data?.branding?.secondary_color || '',
          },
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          navigate('/permission-denied');
          return;
        }
        setError('No se pudo cargar la configuración.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantId, currentSlug, navigate]);

  const isValid = useMemo(() => {
    const allowed = ['derivar_humano', 'auto_reply', 'silent'];
    const fallback = form.fallback_behavior || 'auto_reply';
    if (!allowed.includes(fallback)) return false;
    if ((form.nombre_bot || '').length > 120) return false;
    if ((form.tono || '').length > 120) return false;
    if ((form.system_prompt || '').length > 4000) return false;
    return true;
  }, [form]);

  const handleSave = async () => {
    if (!tenantId || !isValid) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await enterpriseService.updateBotSettings(
        {
          ...form,
          tenant_id: tenantId,
        },
        currentSlug || undefined,
      );
      setSuccess('Configuración guardada.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        navigate('/permission-denied');
        return;
      }
      setError('No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuración del bot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={form.nombre_bot || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, nombre_bot: e.target.value }))}
            placeholder="Nombre bot"
          />
          <Input
            value={form.tono || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, tono: e.target.value }))}
            placeholder="Tono"
          />
          <Textarea
            value={form.system_prompt || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, system_prompt: e.target.value }))}
            placeholder="System prompt"
            rows={6}
          />
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
          <Input
            value={form.branding?.logo_url || ''}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, branding: { ...prev.branding, logo_url: e.target.value } }))
            }
            placeholder="Logo URL"
          />
          <Input
            value={form.branding?.primary_color || ''}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, branding: { ...prev.branding, primary_color: e.target.value } }))
            }
            placeholder="Color primario"
          />
          <Input
            value={form.branding?.secondary_color || ''}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, branding: { ...prev.branding, secondary_color: e.target.value } }))
            }
            placeholder="Color secundario"
          />

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {success ? <p className="text-green-600 text-sm">{success}</p> : null}

          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BotSettingsEnterprise;
