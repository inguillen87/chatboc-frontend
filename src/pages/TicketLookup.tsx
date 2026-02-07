import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  getTicketByNumber,
  getTicketTimeline,
} from '@/services/ticketService';
import { Ticket, Message, TicketHistoryEvent } from '@/types/tickets';
import { getErrorMessage, ApiError } from '@/utils/api';
import {
  CheckCircle2,
  Clock,
  MapPin,
  XCircle,
  Copy,
  MessageCircle,
  ChevronRight,
  Search,
  FileText,
  AlertCircle,
  Camera,
  Calendar,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from '@/components/ui/textarea';
import TrackingMap from '@/components/ui/TrackingMap';
import Confetti from '@/components/ui/Confetti';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Configuration for Ticket Statuses
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; step: number; description: string }> = {
  pendiente: {
    label: 'Recibido',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Clock,
    step: 1,
    description: 'Tu reclamo ha sido recibido y está pendiente de asignación.'
  },
  abierto: {
    label: 'Recibido',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Clock,
    step: 1,
    description: 'Tu reclamo ha sido registrado en el sistema.'
  },
  en_proceso: {
    label: 'En Proceso',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: AlertCircle,
    step: 2,
    description: 'Estamos trabajando en la solución de tu reclamo.'
  },
  asignado: {
    label: 'En Proceso',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: User,
    step: 2,
    description: 'Un agente ha sido asignado a tu caso.'
  },
  resuelto: {
    label: 'Resuelto',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
    step: 3,
    description: 'El reclamo ha sido solucionado exitosamente.'
  },
  cerrado: {
    label: 'Cerrado',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: CheckCircle2,
    step: 3,
    description: 'El caso ha sido cerrado.'
  },
  cancelado: {
    label: 'Cancelado',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
    step: 0,
    description: 'El reclamo fue cancelado.'
  },
  rechazado: {
    label: 'Rechazado',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
    step: 0,
    description: 'El reclamo no pudo ser procesado.'
  },
};

const TICKET_STEPS = [
  { id: 'pendiente', label: 'Recibido' },
  { id: 'en_proceso', label: 'En Proceso' },
  { id: 'resuelto', label: 'Resuelto' },
];

export default function TicketLookup() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Search State
  const [inputTicketId, setInputTicketId] = useState(ticketId || '');
  const [inputPin, setInputPin] = useState(searchParams.get('pin') || '');

  // Data State
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [timelineHistory, setTimelineHistory] = useState<TicketHistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);

  const performSearch = useCallback(async (searchId?: string, searchPin?: string) => {
    const id = (searchId || '').trim();
    const pinVal = (searchPin || '').trim();

    if (!id) return;
    if (!pinVal) {
      setError('El PIN es obligatorio para consultar el reclamo');
      setTicket(null);
      return;
    }

    setLoading(true);
    setError(null);
    setTimelineHistory([]);
    setPrimaryImageUrl(null);

    try {
      // 1. Get Ticket Basic Info
      const data = await getTicketByNumber(id, pinVal);
      setTicket({ ...data, history: data.history || [] });

      // Extract image if available
      const img = data.archivo_url || data.imagen_url || (data.attachment_info?.url);
      if (img) setPrimaryImageUrl(img);

      // 2. Get Timeline
      try {
        const timeline = await getTicketTimeline(data.id, data.tipo || 'municipio', {
          public: true,
          pin: pinVal,
        });
        setTimelineHistory(timeline.history);
        setTicket((prev) => (prev ? { ...prev, history: timeline.history } : prev));
      } catch (msgErr) {
        console.warn('Error fetching timeline', msgErr);
      }

    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.status === 404) {
        setError('No se encontró el reclamo. Verificá el número.');
      } else if (apiErr?.status === 403) {
        setError('PIN incorrecto.');
      } else {
        setError(getErrorMessage(err, 'Error al consultar el reclamo'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    const paramPin = searchParams.get('pin') || '';
    if (ticketId && paramPin) {
      performSearch(ticketId, paramPin);
    }
  }, [ticketId, searchParams, performSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTicketId.trim() || !inputPin.trim()) return;

    if (inputTicketId === ticketId && inputPin === searchParams.get('pin')) {
      performSearch(inputTicketId, inputPin);
    } else {
      navigate(`/ticket/${encodeURIComponent(inputTicketId)}?pin=${encodeURIComponent(inputPin)}`);
    }
  };

  const handleOpenChat = () => {
    // Pass context to the widget via updated protocol
    const contextPayload = {
        type: 'OPEN_CHAT_WITH_CONTEXT',
        tenantSlug: ticket?.tenant_slug || 'municipio', // Fallback to 'municipio' if missing
        tipoChat: 'municipio',
        context: {
            ticketId: ticket?.id,
            ticketNumber: ticket?.nro_ticket,
            action: 'consultar_reclamo'
        }
    };
    window.postMessage(contextPayload, '*');

    // Legacy fallback
    window.postMessage({ type: 'OPEN_CHAT' }, '*');

    setIsSupportOpen(false);
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    try {
        localStorage.setItem('pending_widget_action', JSON.stringify({
            action: 'send_message',
            text: `[Consulta Reclamo #${ticket?.nro_ticket}] ${message}`
        }));
        handleOpenChat();
        toast.success("Abriendo chat de soporte...");
        setMessage('');
    } catch (e) {
        console.error("Failed to trigger chat", e);
    }
  };

  const copyToClipboard = () => {
    if (ticket) {
        navigator.clipboard.writeText(ticket.nro_ticket);
        toast.success("Número de reclamo copiado");
    }
  };

  // Derived State for UI
  const currentStatusKey = (ticket?.estado || 'pendiente').toLowerCase().replace(/\s+/g, '_');
  const statusInfo = STATUS_CONFIG[currentStatusKey] || STATUS_CONFIG.pendiente;
  const currentStep = statusInfo.step;
  const isResolved = currentStatusKey === 'resuelto' || currentStatusKey === 'cerrado';
  const hasLocation = ticket && (
      (typeof ticket.latitud === 'number' && typeof ticket.longitud === 'number') ||
      (ticket.direccion)
  );

  // Polling for updates
  useEffect(() => {
    if (!ticket || isResolved) return;
    const interval = setInterval(() => {
      // Silent update
      const id = inputTicketId || ticketId || '';
      const pin = inputPin || searchParams.get('pin') || '';
      if (id && pin) {
          getTicketByNumber(id, pin).then(data => {
               // Only update if status changed or history length changed to avoid jitter
               setTicket(prev => {
                   if (!prev) return data;
                   if (prev.estado !== data.estado || (prev.history?.length !== data.history?.length)) {
                       return { ...data, history: data.history || [] };
                   }
                   return prev;
               });
               // We could also update timeline here but let's keep it simple
          }).catch(console.warn);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [ticket, isResolved, inputTicketId, ticketId, inputPin, searchParams]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans selection:bg-primary/10 relative">
      {isResolved && <Confetti />}

      {/* Header / Navbar */}
      <div className="bg-white border-b sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm shadow-blue-200">
                    M
                </div>
                <span className="font-semibold text-gray-900 truncate">Atención Ciudadana</span>
            </div>
            {ticket && (
                <Button variant="ghost" size="icon" onClick={() => setIsSupportOpen(true)} className="text-blue-600 hover:bg-blue-50">
                    <MessageCircle className="h-5 w-5" />
                </Button>
            )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-3xl px-4 py-8 space-y-8"
      >
        {/* Search Bar (Always visible but styled differently if ticket exists) */}
        {!ticket && (
            <div className="max-w-md mx-auto text-center space-y-6 py-10">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Estado de Reclamo</h1>
                    <p className="text-gray-500">Ingresá el número de gestión y tu PIN de seguridad.</p>
                </div>
                <Card className="border-0 shadow-xl ring-1 ring-black/5">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSearchSubmit} className="space-y-4">
                            <div className="space-y-2 text-left">
                                <label className="text-sm font-medium text-gray-700">Número de Reclamo</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Ej: REC-12345"
                                        className="pl-9"
                                        value={inputTicketId}
                                        onChange={(e) => setInputTicketId(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 text-left">
                                <label className="text-sm font-medium text-gray-700">PIN de Seguridad</label>
                                <Input
                                    placeholder="••••"
                                    type="password"
                                    className="text-center tracking-widest"
                                    value={inputPin}
                                    onChange={(e) => setInputPin(e.target.value)}
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={loading || !inputTicketId || !inputPin}
                            >
                                {loading ? 'Buscando...' : 'Consultar Estado'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                {error && (
                     <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm font-medium flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <XCircle className="h-4 w-4" />
                        {error}
                     </div>
                )}
            </div>
        )}

        {ticket && (
            <>
                {/* Status Card */}
                <Card className="border-0 shadow-lg ring-1 ring-black/5 overflow-hidden">
                    <div className={`h-1.5 w-full ${statusInfo.color.replace('text-', 'bg-').split(' ')[0]}`} />
                    <CardContent className="pt-6 pb-8 px-6 text-center">
                        <div className={`mb-6 inline-flex p-3 rounded-full shadow-sm ring-1 ring-inset ${statusInfo.color.replace('text-', 'bg-').replace('border-', 'ring-').split(' ')[0]} ${statusInfo.color.split(' ')[0].replace('bg-', 'bg-opacity-20 ')}`}>
                            <statusInfo.icon className={`h-8 w-8 ${statusInfo.color.split(' ')[1]}`} />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">{statusInfo.label}</h1>
                        <p className="text-gray-500 max-w-sm mx-auto leading-relaxed">{statusInfo.description}</p>

                        {/* Visual Timeline */}
                        {currentStatusKey !== 'cancelado' && currentStatusKey !== 'rechazado' && (
                        <div className="mt-10 px-2 relative max-w-lg mx-auto">
                            {/* Progress Bar Background */}
                            <div className="absolute top-[15px] left-6 right-6 h-1 bg-gray-100 rounded-full -z-10" />

                            {/* Active Progress */}
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(0, ((currentStep - 1) / (TICKET_STEPS.length - 1)) * 100)}%` }}
                                className="absolute top-[15px] left-6 h-1 bg-blue-600 rounded-full -z-10 transition-all duration-1000 ease-out"
                                style={{ maxWidth: 'calc(100% - 3rem)' }}
                            />

                            <div className="flex justify-between">
                            {TICKET_STEPS.map((step, index) => {
                                const isCompleted = index + 1 <= currentStep;
                                const isCurrent = index + 1 === currentStep;

                                return (
                                <div key={step.id} className="flex flex-col items-center gap-3">
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 bg-white
                                        ${isCompleted
                                            ? 'border-blue-600 text-blue-600 shadow-sm'
                                            : 'border-gray-200 text-gray-300'}
                                        ${isCurrent ? 'ring-4 ring-blue-50 scale-110' : ''}
                                    `}>
                                        {isCompleted ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                            <div className="h-2 w-2 rounded-full bg-current" />
                                        )}
                                    </div>
                                    <span className={`
                                        text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-center max-w-[60px] leading-tight
                                        ${isCompleted ? 'text-gray-900' : 'text-gray-400'}
                                    `}>
                                        {step.label}
                                    </span>
                                </div>
                                );
                            })}
                            </div>
                        </div>
                        )}
                    </CardContent>
                </Card>

                {/* Main Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Details */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="border-0 shadow-md ring-1 ring-black/5">
                            <CardHeader className="pb-4 border-b border-gray-50">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-gray-400" />
                                        Detalle del Reclamo
                                    </CardTitle>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors" onClick={copyToClipboard}>
                                        #{ticket.nro_ticket}
                                        <Copy className="h-3 w-3" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-1">Categoría</h3>
                                    <p className="text-base font-semibold text-gray-900">{ticket.categoria || 'General'}</p>
                                </div>

                                {ticket.description && (
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500 mb-2">Descripción</h3>
                                        <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed border border-gray-100">
                                            {ticket.description}
                                        </div>
                                    </div>
                                )}

                                {primaryImageUrl && (
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                                            <Camera className="h-4 w-4" />
                                            Evidencia Adjunta
                                        </h3>
                                        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100 group cursor-pointer" onClick={() => window.open(primaryImageUrl, '_blank')}>
                                            <img
                                                src={primaryImageUrl}
                                                alt="Evidencia"
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                <span className="opacity-0 group-hover:opacity-100 text-white font-medium bg-black/50 px-3 py-1 rounded-full text-sm backdrop-blur-sm transition-opacity">
                                                    Ver imagen completa
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* History Timeline */}
                        <Card className="border-0 shadow-md ring-1 ring-black/5">
                            <CardHeader className="pb-4 border-b border-gray-50">
                                <CardTitle className="text-lg">Historial de Actividad</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="space-y-6 relative pl-2">
                                    <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-gray-100" />
                                    {timelineHistory.map((event, i) => (
                                        <div key={i} className="relative flex gap-4">
                                            <div className="h-6 w-6 rounded-full bg-white border-2 border-blue-100 flex items-center justify-center relative z-10 shrink-0 mt-0.5">
                                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            </div>
                                            <div className="flex-1 pb-1">
                                                <p className="text-sm font-medium text-gray-900">{event.mensaje || event.status}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {event.fecha ? format(new Date(event.fecha), "d 'de' MMMM, HH:mm", { locale: es }) : ''}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {timelineHistory.length === 0 && (
                                        <p className="text-sm text-gray-500 italic pl-8">No hay actividad reciente registrada.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Location & Support */}
                    <div className="space-y-6">
                        <Card className="border-0 shadow-md ring-1 ring-black/5 h-fit overflow-hidden">
                            <div className="h-48 w-full bg-slate-100 relative">
                                {hasLocation ? (
                                    <TrackingMap
                                        status={currentStatusKey}
                                    />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-gray-400 bg-gray-50">
                                        <MapPin className="h-8 w-8 opacity-20" />
                                        <span className="absolute text-xs font-medium">Sin ubicación</span>
                                    </div>
                                )}
                            </div>
                            <CardHeader className="pb-4 border-b border-gray-50">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-gray-400" />
                                    Ubicación
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Dirección reportada</p>
                                    <p className="font-medium text-gray-900 break-words">{ticket.direccion || 'No especificada'}</p>
                                </div>
                                <Separator className="bg-gray-100" />
                                <div>
                                     <p className="text-sm text-gray-500 mb-1">Fecha de creación</p>
                                     <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-gray-400" />
                                        <p className="text-sm font-medium text-gray-900">
                                            {ticket.fecha_creacion ? format(new Date(ticket.fecha_creacion), "d MMM yyyy", { locale: es }) : '-'}
                                        </p>
                                     </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-md ring-1 ring-black/5 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden relative">
                            <div className="absolute -top-6 -right-6 h-24 w-24 bg-blue-500/10 rounded-full blur-2xl" />
                            <CardContent className="p-6">
                                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                    <MessageCircle className="h-5 w-5 text-blue-600" />
                                    ¿Tenés alguna duda?
                                </h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Podés contactarte con el área responsable o dejar una observación sobre tu reclamo.
                                </p>
                                <Button className="w-full shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setIsSupportOpen(true)}>
                                    Contactar Soporte
                                </Button>
                            </CardContent>
                        </Card>

                        <div className="text-center">
                            <Button variant="link" className="text-gray-400 text-xs" onClick={() => {
                                setTicket(null);
                                setInputTicketId('');
                                setInputPin('');
                                navigate('/ticket');
                            }}>
                                Consultar otro reclamo
                            </Button>
                        </div>
                    </div>
                </div>
            </>
        )}
      </motion.div>

      {/* Support Dialog */}
      <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Mesa de Ayuda</DialogTitle>
                <DialogDescription>
                    Gestión <b>#{ticket?.nro_ticket}</b>
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <Button variant="outline" className="h-auto py-4 justify-start px-4 gap-4 hover:bg-slate-50 hover:border-blue-500/30 transition-all group" onClick={handleOpenChat}>
                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                        <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                        <div className="font-semibold text-gray-900">Chat en Vivo</div>
                        <div className="text-xs text-gray-500">Habla con un operador municipal</div>
                    </div>
                    <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />
                </Button>

                <Separator className="my-2 label-separator" />

                <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Dejar un comentario / observación</label>
                    <Textarea
                        placeholder="Escribe tu consulta aquí..."
                        className="resize-none min-h-[100px]"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSendMessage} disabled={!message.trim()}>
                        Enviar Mensaje
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
