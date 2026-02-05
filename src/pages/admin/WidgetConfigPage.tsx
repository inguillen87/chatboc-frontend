import React, { useState, useEffect } from 'react';
import ChatCustomizer from '@/components/admin/widget/ChatCustomizer';
import { useTenant } from '@/context/TenantContext';
import { apiFetch } from '@/utils/api';
import { toast } from 'sonner';

const WidgetConfigPage = () => {
  const { currentSlug } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [liveConfig, setLiveConfig] = useState<any>(null);
  const [draftConfig, setDraftConfig] = useState<any>(null);

  useEffect(() => {
    if (!currentSlug) return;
    loadConfig();
  }, [currentSlug]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<any>(`/api/admin/tenants/${currentSlug}/widget-config`);
      setLiveConfig(response.live || {});
      setDraftConfig(response.draft || response.live || {});
    } catch (error: any) {
      console.error("Error loading config", error);
      toast.error("No se pudo cargar la configuración.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async (config: any) => {
    setSaving(true);
    try {
      const response = await apiFetch<any>(`/api/admin/tenants/${currentSlug}/widget-config`, {
        method: 'PUT',
        body: { config }
      });
      setDraftConfig(response.draft);
      toast.success("Borrador guardado correctamente.");
    } catch (error: any) {
      console.error("Error saving draft", error);
      toast.error("Error al guardar el borrador.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const response = await apiFetch<any>(`/api/admin/tenants/${currentSlug}/widget-config/publish`, {
        method: 'POST'
      });
      setLiveConfig(response.live);
      // Draft becomes same as live usually, or stays as is?
      // Typically publishing promotes draft to live. Draft stays as is (which is equal to live now).
      toast.success("¡Widget publicado exitosamente!");
    } catch (error: any) {
      console.error("Error publishing", error);
      toast.error("Error al publicar.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("¿Estás seguro? Esto descartará tus cambios no guardados y volverá a la versión publicada.")) {
      setDraftConfig({ ...liveConfig });
      toast.info("Configuración restablecida a la versión publicada.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 h-full flex flex-col">
      <div className="flex-none mb-4">
        <h1 className="text-3xl font-bold">Configuración del Widget</h1>
        <p className="text-muted-foreground">Personaliza el aspecto y comportamiento de tu asistente virtual.</p>
      </div>

      <div className="flex-1 min-h-0">
        <ChatCustomizer
          tenantSlug={currentSlug || 'demo'}
          initialDraft={draftConfig}
          initialLive={liveConfig}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          onReset={handleReset}
          isSaving={saving}
        />
      </div>
    </div>
  );
};

export default WidgetConfigPage;
