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
import { formatTicketDisplayLabel } from '@/utils/ticketStatus';
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
      toast.error('No pudimos iniciar el trabajo. Verificá tu conexión e intentá de nuevo.');
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
      toast.success('Reclamo finalizado y vecino notificado.');
      setSelectedTaskForClosure(null);
      setClosurePhoto('');
      setClosureComment('');
      if (userLocation) {
        fetchTasks(userLocation.lat, userLocation.lng);
      } else {
        fetchTasks();
      }
    } catch (e) {
      toast.error('No pudimos cerrar el reclamo. Revisá tu conexión e intentá otra vez.');
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
            className="min-h-11 rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 font-extrabold gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <HardHat className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Modo cuadrilla</span>
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
                  Cuadrillas de calle y operarios
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
              className="min-h-11 rounded-xl text-xs gap-1.5 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <LocateFixed className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : 'text-primary'}`} />
              {userLocation ? 'GPS activo' : 'Obtener GPS'}
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
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="shrink-0 text-xs font-black text-primary">{task.nro_ticket}</span>
                        <Badge variant="outline" className="max-w-full font-bold text-[10px]">
                          {formatTicketDisplayLabel(task.categoria, 'Categoría no informada')}
                        </Badge>
                        {task.distancia_km !== null && (
                          <Badge className="shrink-0 border-transparent bg-primary/10 text-[10px] font-black text-primary">
                            A {task.distancia_km} km
                          </Badge>
                        )}
                      </div>
                      <h4 className="text-sm font-extrabold text-foreground mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {formatTicketDisplayLabel(task.direccion, 'Dirección no informada')}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatTicketDisplayLabel(task.distrito, 'Distrito no informado')}
                      </p>
                    </div>

                    <Badge
                      className={`shrink-0 ${
                        task.estado === 'en_proceso'
                          ? 'border-amber-500/30 bg-amber-500/15 text-amber-600'
                          : 'border-blue-500/30 bg-blue-500/15 text-blue-600'
                      }`}
                    >
                      {task.estado === 'en_proceso' ? 'En cuadrilla' : 'Pendiente'}
                    </Badge>
                  </div>

                  {task.descripcion && (
                    <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded-xl">
                      {formatTicketDisplayLabel(task.descripcion, 'Descripción no disponible')}
                    </p>
                  )}

                  {/* Actions buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                    {task.latitud && task.longitud ? (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitud},${task.longitud}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                          className="min-h-11 text-xs font-bold rounded-xl gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <Play className="w-3 h-3 text-amber-500" />
                          Iniciar
                        </Button>
                      )}

                      <Button
                        size="sm"
                        onClick={() => setSelectedTaskForClosure(task)}
                        className="min-h-11 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Camera className="w-3 h-3" />
                        Cerrar con foto
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
                      Finalizar trabajo: {selectedTaskForClosure.nro_ticket}
                    </h3>
                    <p className="text-xs text-muted-foreground">{selectedTaskForClosure.direccion}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedTaskForClosure(null)}
                    className="h-11 w-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Cerrar carga de resolución"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      URL de la foto de resolución ("Después"):
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
                      Comentario técnico del trabajo realizado:
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
                  className="min-h-11 rounded-xl text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCompleteWork}
                  disabled={isSubmittingClosure}
                  className="min-h-11 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmittingClosure ? 'Notificando...' : 'Confirmar cierre y notificar'}
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
