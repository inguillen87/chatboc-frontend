import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Wand2, Sparkles, Loader2 } from "lucide-react";
import { apiFetch } from '@/utils/api';
import { toast } from "@/components/ui/use-toast";
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
import type { GestionResponseTemplate } from '@/types'; // Importar el tipo consolidado

const GestionPlantillasPage: React.FC = () => {
  const [plantillas, setPlantillas] = useState<GestionResponseTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPlantilla, setCurrentPlantilla] = useState<Partial<GestionResponseTemplate> | null>(null);
  const [promptIA, setPromptIA] = useState("");
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [plantillaAEliminar, setPlantillaAEliminar] = useState<GestionResponseTemplate | null>(null);

  const fetchPlantillas = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch<{ plantillas: GestionResponseTemplate[] }>('/api/ai/templates');
      setPlantillas(response.plantillas || []);
    } catch (error) {
      console.error("Error al cargar plantillas:", error);
      toast({ title: "Error", description: "No se pudieron cargar las plantillas.", variant: "destructive" });
      setPlantillas([]); // Asegurar que quede vacío en caso de error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlantillas();
  }, [fetchPlantillas]);

  const abrirFormularioNueva = () => {
    setCurrentPlantilla({ name: '', text: '', keywords: [], is_active: true });
    setIsFormOpen(true);
  };

  const abrirFormularioEditar = (plantilla: GestionResponseTemplate) => {
    setCurrentPlantilla(plantilla);
    setIsFormOpen(true);
  };

  const handleGuardarPlantilla = async () => {
    if (!currentPlantilla || !currentPlantilla.name || !currentPlantilla.text) {
      toast({ title: "Error", description: "Nombre y texto son requeridos.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const method = currentPlantilla.id ? 'PUT' : 'POST';
      const endpoint = currentPlantilla.id ? `/api/ai/templates/${currentPlantilla.id}` : '/api/ai/templates';

      // El backend espera keywords como array de strings
      const keywordsArray = typeof currentPlantilla.keywords === 'string'
        ? currentPlantilla.keywords.split(',').map(k => k.trim()).filter(k => k)
        : currentPlantilla.keywords || [];

      const payload = {
        name: currentPlantilla.name,
        text: currentPlantilla.text,
        keywords: keywordsArray,
        is_active: currentPlantilla.is_active,
      };

      await apiFetch(endpoint, { method, body: payload });

      toast({ title: "Éxito", description: `Plantilla ${currentPlantilla.id ? 'actualizada' : 'creada'} correctamente.` });
      fetchPlantillas(); // Recargar la lista
      setIsFormOpen(false);
      setCurrentPlantilla(null);
    } catch (error) {
      console.error("Error al guardar plantilla:", error);
      toast({ title: "Error", description: "No se pudo guardar la plantilla.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const abrirDialogoEliminar = (plantilla: GestionResponseTemplate) => {
    setPlantillaAEliminar(plantilla);
    // El AlertDialog se abrirá mediante su Trigger y el estado plantillaAEliminar
  };

  const confirmarEliminacionPlantilla = async () => {
    if (!plantillaAEliminar || !plantillaAEliminar.id) return;

    setIsLoading(true);
    try {
      await apiFetch(`/api/ai/templates/${plantillaAEliminar.id}`, { method: 'DELETE' });
      toast({ title: "Éxito", description: "Plantilla eliminada correctamente." });
      fetchPlantillas();
      setPlantillaAEliminar(null); // Cerrar el diálogo implícitamente al limpiar el estado
    } catch (error) {
      console.error("Error al eliminar plantilla:", error);
      toast({ title: "Error", description: "No se pudo eliminar la plantilla.", variant: "destructive" });
      setPlantillaAEliminar(null); // Asegurarse de cerrar el diálogo también en caso de error
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerarTextoConIA = async () => {
    if (!promptIA) {
        toast({ title: "Info", description: "Por favor, escribe una descripción para la IA.", variant: "default" });
        return;
    }
    setIsGeneratingText(true);
    try {
      const response = await apiFetch<{ generated_text: string }>('/api/ai/generate-template-text', {
        method: 'POST',
        body: { prompt: promptIA },
      });
      if (response.generated_text && currentPlantilla) {
        setCurrentPlantilla(prev => ({ ...prev, text: response.generated_text }));
        toast({ title: "Texto generado", description: "El texto de la plantilla ha sido actualizado con la sugerencia de la IA." });
      } else {
        throw new Error("Respuesta inesperada del servidor para generar texto.");
      }
      setPromptIA(""); // Limpiar prompt después de usarlo
    } catch (error) {
      console.error("Error al generar texto con IA:", error);
      toast({ title: "Error IA", description: "No se pudo generar el texto con IA.", variant: "destructive" });
    } finally {
      setIsGeneratingText(false);
    }
  };

  const handleMejorarTextoConIA = async () => {
    if (!currentPlantilla?.text) {
        toast({ title: "Info", description: "No hay texto para mejorar.", variant: "default" });
        return;
    }
    setIsGeneratingText(true);
    try {
      const response = await apiFetch<{ improved_text: string }>('/api/ai/improve-template-text', {
        method: 'POST',
        body: { text_to_improve: currentPlantilla.text },
      });
      if (response.improved_text && currentPlantilla) {
        setCurrentPlantilla(prev => ({ ...prev, text: response.improved_text }));
        toast({ title: "Texto mejorado", description: "El texto de la plantilla ha sido actualizado por la IA." });
      } else {
        throw new Error("Respuesta inesperada del servidor para mejorar texto.");
      }
    } catch (error) {
      console.error("Error al mejorar texto con IA:", error);
      toast({ title: "Error IA", description: "No se pudo mejorar el texto con IA.", variant: "destructive" });
    } finally {
      setIsGeneratingText(false);
    }
  };


  // Datos Mock por ahora para la lista
  useEffect(() => {
    setPlantillas([
      { id: '1', name: 'Saludo Mock', text: 'Hola {nombre_usuario}, gracias por contactar...', keywords: ['saludo'], is_active: true },
      { id: '2', name: 'Cierre Mock', text: 'Ticket cerrado. Saludos!', keywords: ['cierre', 'resuelto'], is_active: true },
    ]);
  }, []);

  return (
    <AlertDialog> {/* Envolver el contenido principal o al menos la parte que usa Triggers y Content */}
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Gestión de Plantillas de Respuesta</h1>
        <Button onClick={abrirFormularioNueva}>
          <PlusCircle className="mr-2 h-5 w-5" /> Crear Nueva Plantilla
        </Button>
      </div>

      {/* Lista de Plantillas */}
      {isLoading && <p>Cargando plantillas...</p>}
      {!isLoading && plantillas.length === 0 && <p>No hay plantillas creadas.</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plantillas.map(p => (
          <div key={p.id} className="bg-card border dark:border-slate-700 rounded-lg p-4 shadow hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-foreground mb-1">{p.name}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2" title={p.text}>{p.text}</p>
            <div className="text-xs text-muted-foreground mb-3">
              <strong>Keywords:</strong> {p.keywords?.join(', ') || 'N/A'} <br />
              <strong>Activa:</strong> {p.is_active ? 'Sí' : 'No'}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => abrirFormularioEditar(p)}>
                <Edit className="mr-1 h-4 w-4" /> Editar
              </Button>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" onClick={() => abrirDialogoEliminar(p)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Eliminar
                </Button>
              </AlertDialogTrigger>
            </div>
          </div>
        ))}
      </div>

      {/* AlertDialog para Confirmar Eliminación */}
      {plantillaAEliminar && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la plantilla llamada "{plantillaAEliminar.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPlantillaAEliminar(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminacionPlantilla}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sí, eliminar plantilla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}

      {/* Formulario Modal para Crear/Editar Plantilla */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{currentPlantilla?.id ? 'Editar' : 'Crear Nueva'} Plantilla</DialogTitle>
          </DialogHeader>

          {currentPlantilla && (
            <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-2">
              <div>
                <label htmlFor="plantilla-name" className="block text-sm font-medium text-muted-foreground mb-1">Nombre</label>
                <Input
                  id="plantilla-name"
                  value={currentPlantilla.name || ''}
                  onChange={(e) => setCurrentPlantilla(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Saludo Bienvenida"
                />
              </div>

              <div className="space-y-2">
                 <label htmlFor="plantilla-prompt-ia" className="block text-sm font-medium text-muted-foreground">Asistente IA: Describe tu plantilla</label>
                <div className="flex gap-2 items-start">
                    <Textarea
                        id="plantilla-prompt-ia"
                        value={promptIA}
                        onChange={(e) => setPromptIA(e.target.value)}
                        placeholder="Ej: Una plantilla amigable para agradecer al usuario por reportar un bug y solicitarle más detalles como su navegador y pasos para reproducir el error."
                        rows={3}
                        className="flex-grow"
                    />
                    <Button onClick={handleGenerarTextoConIA} disabled={isGeneratingText} variant="outline" className="shrink-0">
                        {isGeneratingText ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-primary" />}
                        Generar
                    </Button>
                </div>
              </div>

              <div>
                <label htmlFor="plantilla-text" className="block text-sm font-medium text-muted-foreground mb-1">Texto de la Plantilla</label>
                <Textarea
                  id="plantilla-text"
                  value={currentPlantilla.text || ''}
                  onChange={(e) => setCurrentPlantilla(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Escribe el contenido de la plantilla aquí. Usa {nombre_usuario}, {asunto_ticket}, {nro_ticket} como placeholders."
                  rows={8}
                  className="min-h-[150px]"
                />
                 <Button onClick={handleMejorarTextoConIA} disabled={isGeneratingText || !currentPlantilla.text} variant="link" size="sm" className="mt-1 px-0 text-primary">
                    {isGeneratingText ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}
                    Mejorar texto con IA
                </Button>
              </div>

              <div>
                <label htmlFor="plantilla-keywords" className="block text-sm font-medium text-muted-foreground mb-1">Keywords (separadas por coma)</label>
                <Input
                  id="plantilla-keywords"
                  value={currentPlantilla.keywords?.join(', ') || ''}
                  onChange={(e) => setCurrentPlantilla(prev => ({ ...prev, keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k) }))}
                  placeholder="Ej: saludo, bienvenida, acceso"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="plantilla-active"
                  checked={currentPlantilla.is_active}
                  onCheckedChange={(checked) => setCurrentPlantilla(prev => ({ ...prev, is_active: Boolean(checked) }))}
                />
                <label htmlFor="plantilla-active" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Activa
                </label>
              </div>
            </div>
          )}
          <DialogFooter className="mt-auto pt-4 border-t">
            <DialogClose asChild>
                <Button variant="outline" onClick={() => setCurrentPlantilla(null)}>Cancelar</Button>
            </DialogClose>
            <Button onClick={handleGuardarPlantilla} disabled={isLoading}>Guardar Plantilla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </AlertDialog>
  );
};

export default GestionPlantillasPage;
