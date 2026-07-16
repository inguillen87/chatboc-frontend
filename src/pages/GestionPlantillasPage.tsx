import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Edit,
  Loader2,
  MessageCircle,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";

import WhatsappOperationsHub from "@/components/admin/WhatsappOperationsHub";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useUser } from "@/hooks/useUser";
import { useTenantStore } from "@/stores/tenantStore";
import type { GestionResponseTemplate } from "@/types";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { hasRequiredRole } from "@/utils/roles";
import { buildTenantPath } from "@/utils/tenantPaths";

type TemplateDraft = Partial<GestionResponseTemplate> & {
  keywords?: string[] | string;
};

const templateText = (template: TemplateDraft | GestionResponseTemplate | null | undefined) =>
  typeof template?.text === "string" ? template.text : "";

const normalizeKeywords = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const EmptyLegacyTemplates = ({ onCreate }: { onCreate: () => void }) => (
  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
    <MessageCircle className="mx-auto h-8 w-8 text-primary" />
    <h3 className="mt-3 text-lg font-black tracking-tight">Sin plantillas rapidas cargadas</h3>
    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
      Crea respuestas operativas para agentes humanos, fallbacks de IA y mensajes internos. Las plantillas oficiales
      de WhatsApp se gestionan arriba desde el cockpit Twilio/Meta.
    </p>
    <Button type="button" className="mt-4 rounded-[8px]" onClick={onCreate}>
      <PlusCircle className="mr-2 h-4 w-4" />
      Crear plantilla
    </Button>
  </div>
);

const GestionPlantillasPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const storeTenantSlug = useTenantStore((state) => state.slug);
  const tenantSlug = searchParams.get("tenant_slug") || searchParams.get("tenant") || storeTenantSlug || null;

  const [plantillas, setPlantillas] = useState<GestionResponseTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPlantilla, setCurrentPlantilla] = useState<TemplateDraft | null>(null);
  const [promptIA, setPromptIA] = useState("");
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [plantillaAEliminar, setPlantillaAEliminar] = useState<GestionResponseTemplate | null>(null);
  const whatsappOnboardingHref = `${buildTenantPath("/integracion", tenantSlug)}?channel=whatsapp&action=twilio-content`;
  const canManageWhatsappFlows = hasRequiredRole(user?.rol, ["tenant_admin", "superadmin"]);

  const fetchPlantillas = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiFetch<{ plantillas: GestionResponseTemplate[] }>("/api/ai/templates", {
        tenantSlug: tenantSlug || undefined,
      });
      setPlantillas(Array.isArray(response.plantillas) ? response.plantillas : []);
    } catch (error) {
      const message = getErrorMessage(error, "No se pudieron cargar las plantillas rapidas.");
      setLoadError(message);
      setPlantillas([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    fetchPlantillas();
  }, [fetchPlantillas]);

  const activeCount = useMemo(
    () => plantillas.filter((template) => template.is_active !== false).length,
    [plantillas],
  );

  const abrirFormularioNueva = () => {
    setCurrentPlantilla({ name: "", text: "", keywords: [], is_active: true });
    setPromptIA("");
    setIsFormOpen(true);
  };

  const abrirFormularioEditar = (plantilla: GestionResponseTemplate) => {
    setCurrentPlantilla({ ...plantilla, keywords: normalizeKeywords(plantilla.keywords) });
    setPromptIA("");
    setIsFormOpen(true);
  };

  const handleGuardarPlantilla = async () => {
    const name = String(currentPlantilla?.name || "").trim();
    const text = templateText(currentPlantilla).trim();
    if (!currentPlantilla || !name || !text) {
      toast({
        title: "Faltan datos",
        description: "Nombre y texto son requeridos.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const method = currentPlantilla.id ? "PUT" : "POST";
      const endpoint = currentPlantilla.id ? `/api/ai/templates/${currentPlantilla.id}` : "/api/ai/templates";
      await apiFetch(endpoint, {
        method,
        tenantSlug: tenantSlug || undefined,
        body: {
          name,
          text,
          keywords: normalizeKeywords(currentPlantilla.keywords),
          is_active: currentPlantilla.is_active !== false,
        },
      });

      toast({
        title: currentPlantilla.id ? "Plantilla actualizada" : "Plantilla creada",
        description: "La respuesta rapida quedo disponible para el equipo.",
      });
      setIsFormOpen(false);
      setCurrentPlantilla(null);
      await fetchPlantillas();
    } catch (error) {
      toast({
        title: "No se pudo guardar",
        description: getErrorMessage(error, "Revisa la conexion o permisos del tenant."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmarEliminacionPlantilla = async () => {
    if (!plantillaAEliminar?.id) return;
    setIsLoading(true);
    try {
      await apiFetch(`/api/ai/templates/${plantillaAEliminar.id}`, {
        method: "DELETE",
        tenantSlug: tenantSlug || undefined,
      });
      toast({ title: "Plantilla eliminada", description: "Se retiro del set de respuestas rapidas." });
      setPlantillaAEliminar(null);
      await fetchPlantillas();
    } catch (error) {
      toast({
        title: "No se pudo eliminar",
        description: getErrorMessage(error, "Intenta nuevamente."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerarTextoConIA = async () => {
    if (!promptIA.trim()) {
      toast({ title: "Describe la plantilla", description: "Indica el caso de uso, tono y canal." });
      return;
    }
    setIsGeneratingText(true);
    try {
      const response = await apiFetch<{ generated_text: string }>("/api/ai/generate-template-text", {
        method: "POST",
        tenantSlug: tenantSlug || undefined,
        body: { prompt: promptIA },
      });
      if (!response.generated_text) throw new Error("Respuesta sin texto generado.");
      setCurrentPlantilla((prev) => ({ ...prev, text: response.generated_text }));
      setPromptIA("");
      toast({ title: "Texto generado", description: "La IA preparo una version editable." });
    } catch (error) {
      toast({
        title: "Error IA",
        description: getErrorMessage(error, "No se pudo generar el texto."),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingText(false);
    }
  };

  const handleMejorarTextoConIA = async () => {
    const text = templateText(currentPlantilla).trim();
    if (!text) {
      toast({ title: "Sin texto", description: "Primero escribe una respuesta base." });
      return;
    }
    setIsGeneratingText(true);
    try {
      const response = await apiFetch<{ improved_text: string }>("/api/ai/improve-template-text", {
        method: "POST",
        tenantSlug: tenantSlug || undefined,
        body: { text_to_improve: text },
      });
      if (!response.improved_text) throw new Error("Respuesta sin texto mejorado.");
      setCurrentPlantilla((prev) => ({ ...prev, text: response.improved_text }));
      toast({ title: "Texto mejorado", description: "La respuesta quedo mas clara y profesional." });
    } catch (error) {
      toast({
        title: "Error IA",
        description: getErrorMessage(error, "No se pudo mejorar el texto."),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingText(false);
    }
  };

  return (
    <AlertDialog>
      <main className="min-h-screen bg-background px-4 py-6 text-foreground md:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    Twilio Content API + Meta approval + QA
                  </span>
                  {tenantSlug ? (
                    <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                      tenant: {tenantSlug}
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">
                  Plantillas y WhatsApp Operations
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                  Controla las plantillas oficiales, webviews, QA de reclamos/pedidos/encuestas y respuestas rapidas
                  desde una sola pantalla operativa. Esto evita flujos sueltos y deja el onboarding mas claro para
                  gobiernos, colegios y pymes.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button type="button" className="rounded-[8px]" onClick={abrirFormularioNueva}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Crear respuesta rapida
                  </Button>
                  <Button type="button" variant="outline" className="rounded-[8px]" onClick={fetchPlantillas}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Actualizar
                  </Button>
                  {canManageWhatsappFlows ? (
                    <Button asChild type="button" variant="ghost" className="rounded-[8px]">
                      <Link to={whatsappOnboardingHref}>Onboarding WhatsApp</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="border-t border-border/70 bg-muted/20 p-6 lg:border-l lg:border-t-0">
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rapidas</p>
                    <p className="mt-2 text-3xl font-black">{plantillas.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Respuestas internas y fallback de agentes.</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Activas</p>
                    <p className="mt-2 text-3xl font-black">{activeCount}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Disponibles para el equipo.</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Oficiales</p>
                    <p className="mt-2 text-3xl font-black">Meta</p>
                    <p className="mt-1 text-xs text-muted-foreground">Aprobacion y readiness en el hub.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <WhatsappOperationsHub tenantSlug={tenantSlug} canManageFlows={canManageWhatsappFlows} />

          <Card className="border-border/70">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Respuestas rapidas del equipo
                </CardTitle>
                <CardDescription>
                  Textos editables para operadores, fallback del bot y mensajes de CRM. No reemplazan las plantillas
                  oficiales aprobadas por Meta.
                </CardDescription>
              </div>
              <Button type="button" className="rounded-[8px]" onClick={abrirFormularioNueva}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nueva
              </Button>
            </CardHeader>
            <CardContent>
              {loadError ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <span>{loadError}</span>
                  </div>
                </div>
              ) : null}

              {isLoading && !plantillas.length ? (
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Cargando plantillas...
                </div>
              ) : null}

              {!isLoading && !plantillas.length ? (
                <EmptyLegacyTemplates onCreate={abrirFormularioNueva} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {plantillas.map((template) => {
                    const keywords = normalizeKeywords(template.keywords);
                    return (
                      <article
                        key={template.id}
                        className="flex min-h-[220px] flex-col rounded-2xl border border-border/70 bg-background p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-black tracking-tight">{template.name}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {template.is_active === false ? "Inactiva" : "Activa"}
                            </p>
                          </div>
                          <span
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] ${
                              template.is_active === false ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-600"
                            }`}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </span>
                        </div>
                        <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground">{template.text}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {keywords.length ? (
                            keywords.slice(0, 5).map((keyword) => (
                              <span key={keyword} className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                                {keyword}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                              sin keywords
                            </span>
                          )}
                        </div>
                        <div className="mt-auto flex gap-2 pt-5">
                          <Button type="button" variant="outline" size="sm" className="rounded-[8px]" onClick={() => abrirFormularioEditar(template)}>
                            <Edit className="mr-1 h-4 w-4" />
                            Editar
                          </Button>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" size="sm" className="rounded-[8px]" onClick={() => setPlantillaAEliminar(template)}>
                              <Trash2 className="mr-1 h-4 w-4" />
                              Eliminar
                            </Button>
                          </AlertDialogTrigger>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {plantillaAEliminar ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar plantilla</AlertDialogTitle>
              <AlertDialogDescription>
                Esta accion elimina "{plantillaAEliminar.name}" del set de respuestas rapidas. Las plantillas oficiales
                de Twilio/Meta no se modifican desde esta accion.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPlantillaAEliminar(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmarEliminacionPlantilla}
                disabled={isLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{currentPlantilla?.id ? "Editar respuesta rapida" : "Crear respuesta rapida"}</DialogTitle>
            </DialogHeader>

            {currentPlantilla ? (
              <div className="flex-grow space-y-4 overflow-y-auto pr-2 py-2">
                <div>
                  <label htmlFor="plantilla-name" className="mb-1 block text-sm font-semibold text-foreground">
                    Nombre
                  </label>
                  <Input
                    id="plantilla-name"
                    value={currentPlantilla.name || ""}
                    onChange={(event) => setCurrentPlantilla((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Ej: Reclamo recibido"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="plantilla-prompt-ia" className="block text-sm font-semibold text-foreground">
                    Asistente IA
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Textarea
                      id="plantilla-prompt-ia"
                      value={promptIA}
                      onChange={(event) => setPromptIA(event.target.value)}
                      placeholder="Ej: Mensaje breve para confirmar reclamo municipal, pedir seguimiento y mantener tono institucional."
                      rows={3}
                      className="flex-grow"
                    />
                    <Button type="button" onClick={handleGenerarTextoConIA} disabled={isGeneratingText} variant="outline" className="rounded-[8px]">
                      {isGeneratingText ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Generar
                    </Button>
                  </div>
                </div>

                <div>
                  <label htmlFor="plantilla-text" className="mb-1 block text-sm font-semibold text-foreground">
                    Texto
                  </label>
                  <Textarea
                    id="plantilla-text"
                    value={currentPlantilla.text || ""}
                    onChange={(event) => setCurrentPlantilla((prev) => ({ ...prev, text: event.target.value }))}
                    placeholder="Usa variables como {nombre_usuario}, {nro_ticket}, {asunto_ticket}."
                    rows={8}
                    className="min-h-[160px]"
                  />
                  <Button
                    type="button"
                    onClick={handleMejorarTextoConIA}
                    disabled={isGeneratingText || !templateText(currentPlantilla)}
                    variant="link"
                    size="sm"
                    className="mt-1 px-0 text-primary"
                  >
                    {isGeneratingText ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}
                    Mejorar texto con IA
                  </Button>
                </div>

                <div>
                  <label htmlFor="plantilla-keywords" className="mb-1 block text-sm font-semibold text-foreground">
                    Keywords
                  </label>
                  <Input
                    id="plantilla-keywords"
                    value={normalizeKeywords(currentPlantilla.keywords).join(", ")}
                    onChange={(event) => setCurrentPlantilla((prev) => ({ ...prev, keywords: normalizeKeywords(event.target.value) }))}
                    placeholder="reclamo, recibido, seguimiento"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="plantilla-active"
                    checked={currentPlantilla.is_active !== false}
                    onCheckedChange={(checked) => setCurrentPlantilla((prev) => ({ ...prev, is_active: Boolean(checked) }))}
                  />
                  <label htmlFor="plantilla-active" className="text-sm font-semibold">
                    Activa para operadores
                  </label>
                </div>
              </div>
            ) : null}

            <DialogFooter className="mt-auto border-t pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => setCurrentPlantilla(null)}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="button" onClick={handleGuardarPlantilla} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </AlertDialog>
  );
};

export default GestionPlantillasPage;
