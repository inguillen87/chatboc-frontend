import React, { useEffect, useState, useCallback, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ChevronLeft, ChevronUp, ChevronDown, LogOut, Inbox, X, Ticket as TicketIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/fecha';
import { useDateSettings } from '@/hooks/useDateSettings';
import { LOCALE_OPTIONS } from '@/utils/localeOptions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getPedidos, Pedido } from '@/services/pedidosService';

type CategorizedPedidos = { [estado: string]: Pedido[] };

// ... (resto de componentes y constantes sin cambios)

const PEDIDO_ESTADOS_INFO: Record<string, { label: string; style: string }> = {
    pendiente_confirmacion: { label: 'Pend. Confirmación', style: 'bg-orange-500/20 text-orange-600 border-orange-400' },
    pendiente: { label: 'Pendiente Pago', style: 'bg-yellow-500/20 text-yellow-600 border-yellow-400' },
    en_proceso: { label: 'En Proceso', style: 'bg-blue-500/20 text-blue-600 border-blue-400' },
    enviado: { label: 'Enviado', style: 'bg-purple-500/20 text-purple-600 border-purple-400' },
    entregado: { label: 'Entregado', style: 'bg-green-500/20 text-green-600 border-green-400' },
    satisfecho: { label: 'Satisfecho', style: 'bg-emerald-500/20 text-emerald-600 border-emerald-400' },
    cancelado: { label: 'Cancelado', style: 'bg-red-500/20 text-red-600 border-red-400' },
};

const ESTADOS_ORDEN_PRIORIDAD = ['pendiente_confirmacion', 'pendiente', 'en_proceso', 'enviado', 'entregado', 'satisfecho', 'cancelado'];

const SkeletonCard = () => (
    <Card className="bg-card shadow-lg rounded-xl border border-border">
      <CardHeader className="pb-4">
        <Skeleton className="h-7 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-1/2 mt-2 rounded-md" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-5/6 rounded-md" />
        <Skeleton className="h-10 w-full mt-4 rounded-md" />
      </CardContent>
    </Card>
  );

const PedidoCard: FC<{ pedido: Pedido; onSelect: (p: Pedido) => void; selected: boolean; timezone: string; locale: string }> = ({ pedido, onSelect, selected, timezone, locale }) => {
    return (
      <div
        onClick={() => onSelect(pedido)}
        className={cn(
          'bg-background p-3 rounded-lg border cursor-pointer transition-all shadow-sm',
          'hover:border-primary hover:shadow-lg hover:-translate-y-1',
          selected ? 'border-primary ring-2 ring-primary/50 -translate-y-1' : 'border-border'
        )}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-semibold text-primary text-sm">#{pedido.nro_pedido}</span>
          <Badge className={cn('text-xs border', PEDIDO_ESTADOS_INFO[pedido.estado]?.style)}>
            {PEDIDO_ESTADOS_INFO[pedido.estado]?.label || pedido.estado}
          </Badge>
        </div>
        <p className="font-medium text-foreground truncate" title={pedido.asunto}>{pedido.asunto}</p>
        <p className="text-xs text-muted-foreground truncate">
          {formatDate(pedido.fecha_creacion, timezone, locale)}
        </p>
      </div>
    );
  };

const PedidoDetail: FC<{ pedido: Pedido; onClose: () => void; timezone: string; locale: string }> = ({ pedido, onClose, timezone, locale }) => {
    return (
      <div className="bg-card rounded-lg p-4 border border-border shadow-md mt-2">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-foreground">Detalle #{pedido.nro_pedido}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar detalle">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="text-sm space-y-1 mb-4">
          <p><strong>Cliente:</strong> {pedido.nombre_cliente || 'N/A'}</p>
          <p><strong>Email:</strong> {pedido.email_cliente || 'N/A'}</p>
          <p><strong>Teléfono:</strong> {pedido.telefono_cliente || 'N/A'}</p>
          <p><strong>Fecha:</strong> {formatDate(pedido.fecha_creacion, timezone, locale)}</p>
          <p><strong>Rubro:</strong> <span className="capitalize">{pedido.rubro}</span></p>
        </div>
        {pedido.detalles && pedido.detalles.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold mb-1">Items</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {pedido.detalles.map((item, idx) => (
                <li key={idx}>
                  {item.cantidad} {item.unidad} de {item.nombre}
                </li>
              ))}
            </ul>
          </div>
        )}
        {pedido.monto_total !== null && (
          <p className="font-bold text-right">Total: ${pedido.monto_total.toFixed(2)}</p>
        )}
      </div>
    );
  };

const PedidoCategoryAccordion: FC<{
    estado: string;
    pedidos: Pedido[];
    isOpen: boolean;
    onToggle: () => void;
    onSelect: (p: Pedido) => void;
    selectedPedidoId: number | null;
    timezone: string;
    locale: string;
  }> = ({ estado, pedidos, isOpen, onToggle, onSelect, selectedPedidoId, timezone, locale }) => (
    <motion.div layout className="bg-card border border-border rounded-xl shadow-md overflow-hidden" initial={{ borderRadius: 12 }}>
      <motion.header
        layout
        initial={false}
        onClick={onToggle}
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-lg capitalize">{PEDIDO_ESTADOS_INFO[estado]?.label || estado}</h2>
          <Badge variant="secondary">{pedidos.length}</Badge>
        </div>
        {isOpen ? <ChevronUp className="text-muted-foreground" /> : <ChevronDown className="text-muted-foreground" />}
      </motion.header>
      <AnimatePresence>
        {isOpen && (
          <motion.section
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{ open: { opacity: 1, height: 'auto' }, collapsed: { opacity: 0, height: 0 } }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-2 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-border">
              {pedidos.map((pedido) => (
                <React.Fragment key={pedido.id}>
                  <PedidoCard
                    pedido={pedido}
                    onSelect={onSelect}
                    selected={selectedPedidoId === pedido.id}
                    timezone={timezone}
                    locale={locale}
                  />
                  <AnimatePresence>
                    {selectedPedidoId === pedido.id && (
                      <motion.div
                        key={`detail-${pedido.id}`}
                        initial="collapsed"
                        animate="open"
                        exit="collapsed"
                        variants={{ open: { opacity: 1, height: 'auto' }, collapsed: { opacity: 0, height: 0 } }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="col-span-full"
                      >
                        <PedidoDetail
                          pedido={pedido}
                          onClose={() => onSelect(pedido)}
                          timezone={timezone}
                          locale={locale}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );

const PageHeader: FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const navigate = useNavigate();
    const { locale, updateSettings } = useDateSettings();
    return (
      <div className="w-full max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/perfil')} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5 mr-2" /> Volver al Perfil
        </Button>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-primary leading-tight text-center flex-1 hidden sm:block">
          Panel de Pedidos
        </h1>
        <Button
          variant="ghost"
          onClick={() => navigate('/tickets')}
          className="hidden sm:inline-flex text-muted-foreground hover:text-foreground mr-4"
          aria-label="Ver Tickets"
        >
          <TicketIcon className="w-5 h-5 mr-1" /> Tickets
        </Button>
        <div className="max-w-xs mr-4">
          <Select
            value={locale}
            onValueChange={(val) => {
              const opt = LOCALE_OPTIONS.find((o) => o.locale === val);
              if (opt) updateSettings(opt.timezone, opt.locale);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Idioma" />
            </SelectTrigger>
            <SelectContent>
              {LOCALE_OPTIONS.map((opt) => (
                <SelectItem key={opt.locale} value={opt.locale}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          className="h-10 px-5 text-sm border-destructive text-destructive hover:bg-destructive/10"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4 mr-2" /> Salir
        </Button>
      </div>
    );
  };

export default function PedidosPage() {
  const navigate = useNavigate();
  const { timezone, locale } = useDateSettings();
  const [categorizedPedidos, setCategorizedPedidos] = useState<CategorizedPedidos>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [selectedPedidoId, setSelectedPedidoId] = useState<number | null>(null);

  const handleLogout = () => {
    safeLocalStorage.clear();
    navigate('/login');
  };

  const fetchPedidos = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getPedidos();
      const data = response.pedidos || [];

      if (Array.isArray(data)) {
        const categorized = data.reduce<CategorizedPedidos>((acc, p) => {
          const estado = p.estado || 'sin_estado';
          acc[estado] = acc[estado] ? [...acc[estado], p] : [p];
          return acc;
        }, {});
        setCategorizedPedidos(categorized);
        setOpenCategories(new Set(Object.keys(categorized).filter((e) => !['satisfecho', 'cancelado'].includes(e))));
      } else {
        console.error('Error: La respuesta de la API de pedidos no es un array', data);
        setError('La respuesta de la API no tiene el formato esperado.');
        setCategorizedPedidos({});
      }
    } catch (err) {
      console.error('Error fetching pedidos:', err);
      setError(getErrorMessage(err, 'Error al cargar los pedidos.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = safeLocalStorage.getItem('authToken');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchPedidos();
  }, [fetchPedidos, navigate]);

  const sortedCategories = Object.entries(categorizedPedidos).sort(([a], [b]) => {
    const indexA = ESTADOS_ORDEN_PRIORIDAD.indexOf(a);
    const indexB = ESTADOS_ORDEN_PRIORIDAD.indexOf(b);
    return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
  });

  const toggleCategory = (estado: string) => {
    setOpenCategories((prev) => {
      const newSet = new Set(prev);
      newSet.has(estado) ? newSet.delete(estado) : newSet.add(estado);
      return newSet;
    });
  };

  const handleSelectPedido = (pedido: Pedido) => {
    setSelectedPedidoId((id) => (id === pedido.id ? null : pedido.id));
  };

  // ... (código de renderizado sin cambios)
}
