import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  HardHat,
  LocateFixed,
  MapPin,
  Navigation,
  Play,
  RefreshCw,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { toast } from 'sonner';

export interface CuadrillaTask {
  id: number;
  nro_ticket: string;
  categoria: string;
  direccion: string;
  distrito: string;
  latitud: number | null;
  longitud: number | null;
  distancia_km: number | null;
  estado: string;
  descripcion: string;
  foto_url_inicial?: string;
  fecha?: string;
}

export const CuadrillaFieldModal: React.FC<{ triggerButton?: React.ReactNode }> = ({ triggerButton }) => {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<CuadrillaTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedTaskForClosure, setSelectedTaskForClosure] = useState<CuadrillaTask | null>(null);
  const [closurePhoto, setClosurePhoto] = useState('');
  const [closureComment, setClosureComment] = useState('');
  const [isSubmittingClosure, setIsSubmittingClosure] = useState(false);

  const fetchTasks = async (lat?: number, lng?: number) => {
    setLoading(true);
    try {
      let url = '/api/cuadrillas/tareas';
      if (lat !== undefined && lng !== undefined) {
        url += `?lat=${lat}&lng=${lng}`;
      }
      const data = await apiFetch<{ tareas: CuadrillaTask[]; total_tareas: number }>(url);
      setTasks(data.tareas || []);
    } catch (err: any) {
      toast.error('No se pudieron cargar las tareas de cuadrilla.');
    } finally {
      setLoading(false);
    }
  };

  const obtainGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalización no soportada por el navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        toast.success(`Ubicación GPS fijada: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        fetchTasks(coords.lat, coords.lng);
      },
      () => {
        toast.error('Permiso de GPS denegado. Cargando tareas generales.');
        fetchTasks();
      }
    );
  };

  useEffect(() => {
    if (open) {
      obtainGps();
    }
  }, [open]);

  const handleStartWork = async (ticketId: number) => {
    try {
      await apiFetch(`/api/cuadrillas/tareas/${ticketId}/iniciar`, { method: 'POST' });
      toast.success('Trabajo iniciado en vía pública.');
      if (userLocation) {
        fetchTasks(userLocation.lat, userLocation.lng);
      } else {
        fetchTasks();
      }
    } catch (e) {
      toast.error('Error al iniciar trabajo.');
    }
  };

  const handleCompleteWork = async () => {
    if (!selectedTaskForClosure) return;
    setIsSubmittingClosure(true);
    try {
      await apiFetch(`/api/cuadrillas/tareas/${selectedTaskForClosure.id}/completar`, {
        method: 'POST',
        body: JSON.stringify({
          foto_resolucion_url: closurePhoto || undefined,
          comentario: closureComment || 'Trabajo finalizado en vía pública por la cuadrilla.',
        }),
      });
      toast.success('Reclamo finalizado exitosamente y vecino notificado.');
      setSelectedTaskForClosure(null);
      setClosurePhoto('');
      setClosureComment('');
      if (userLocation) {
        fetchTasks(userLocation.lat, userLocation.lng);
      } else {
        fetchTasks();
      }
    } catch (e) {
      toast.error('Error al completar el reclamo.');
    } finally {
      setIsSubmittingClosure(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 font-extrabold gap-2"
          >
            <HardHat className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Modo Cuadrilla PWA</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl p-0 border border-border/80 bg-background/95 backdrop-blur-2xl shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold">
                <HardHat className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold tracking-tight">
                  Cuadrillas de Calle & Operarios PWA
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Tareas en terreno ordenadas por cercanía GPS y cierre con foto
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={obtainGps}
              disabled={loading}
              className="rounded-xl text-xs gap-1.5 h-8 font-semibold"
            >
              <LocateFixed className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : 'text-primary'}`} />
              {userLocation ? 'GPS Activo' : 'Obtener GPS'}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {loading && tasks.length === 0 ? (
            <div className="p-8 text-center animate-pulse space-y-2">
              <Compass className="w-8 h-8 mx-auto text-primary animate-spin text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground">Calculando distancias a reclamos...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-bold text-foreground">¡Sin tareas pendientes en calle!</p>
              <p className="text-xs">Todas las órdenes asignadas han sido completadas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, idx) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="bg-card/90 border border-border/80 rounded-2xl p-4 shadow-sm space-y-3 hover:border-primary/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black text-primary">{task.nro_ticket}</span>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {task.categoria}
                        </Badge>
                        {task.distancia_km !== null && (
                          <Badge className="bg-primary/10 text-primary border-transparent text-[10px] font-black">
                            📍 {task.distancia_km} km
                          </Badge>
                        )}
                      </div>
                      <h4 className="text-sm font-extrabold text-foreground mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {task.direccion}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{task.distrito}</p>
                    </div>

                    <Badge
                      className={
                        task.estado === 'en_proceso'
                          ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                          : 'bg-blue-500/15 text-blue-600 border-blue-500/30'
                      }
                    >
                      {task.estado === 'en_proceso' ? 'En Cuadrilla' : 'Pendiente'}
                    </Badge>
                  </div>

                  {task.descripcion && (
                    <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded-xl">
                      {task.descripcion}
                    </p>
                  )}

                  {/* Actions buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                    {task.latitud && task.longitud ? (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitud},${task.longitud}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Navegar GPS
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Sin coordenadas</span>
                    )}

                    <div className="flex items-center space-x-2">
                      {task.estado !== 'en_proceso' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartWork(task.id)}
                          className="h-8 text-xs font-bold rounded-xl gap-1"
                        >
                          <Play className="w-3 h-3 text-amber-500" />
                          Iniciar
                        </Button>
                      )}

                      <Button
                        size="sm"
                        onClick={() => setSelectedTaskForClosure(task)}
                        className="h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      >
                        <Camera className="w-3 h-3" />
                        Cerrar con Foto
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de Cierre con Foto */}
        <AnimatePresence>
          {selectedTaskForClosure && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 bg-background/95 backdrop-blur-md p-5 flex flex-col justify-between z-50 rounded-3xl"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-foreground">
                      Finalizar Trabajo: {selectedTaskForClosure.nro_ticket}
                    </h3>
                    <p className="text-xs text-muted-foreground">{selectedTaskForClosure.direccion}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedTaskForClosure(null)}
                    className="rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      📸 URL de Foto de Resolución ("Después"):
                    </label>
                    <Input
                      placeholder="https://res.cloudinary.com/.../foto_reparacion.jpg"
                      value={closurePhoto}
                      onChange={(e) => setClosurePhoto(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      📝 Comentario técnico del trabajo realizado:
                    </label>
                    <Textarea
                      placeholder="Se reparó luminaria LED 150W y se despejaron ramas circundantes."
                      value={closureComment}
                      onChange={(e) => setClosureComment(e.target.value)}
                      rows={3}
                      className="rounded-xl text-xs resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-border/60">
                <Button
                  variant="outline"
                  onClick={() => setSelectedTaskForClosure(null)}
                  disabled={isSubmittingClosure}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCompleteWork}
                  disabled={isSubmittingClosure}
                  className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmittingClosure ? 'Notificando...' : 'Confirmar Cierre y Notificar'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default CuadrillaFieldModal;
