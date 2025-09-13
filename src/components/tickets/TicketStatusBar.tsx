import React from 'react';
import { Check, MapPin, Wrench, CheckCircle2 } from 'lucide-react';

interface TicketStatusBarProps {
  status?: string | null;
  flow?: string[];
}

const DEFAULT_FLOW = [
  'nuevo',
  'en_proceso',
  'en_camino',
  'completado',
  'llegado',
  'resuelto',
];
const ICONS: Record<string, React.ReactNode> = {
  nuevo: <MapPin className="w-3 h-3" />, // ticket creado
  en_proceso: <Wrench className="w-3 h-3" />, // cuadrilla trabajando
  en_camino: <MapPin className="w-3 h-3" />, // cuadrilla en camino
  completado: <CheckCircle2 className="w-3 h-3" />, // finalizado internamente
  llegado: <CheckCircle2 className="w-3 h-3" />, // llegada a destino
  resuelto: <CheckCircle2 className="w-3 h-3" />, // finalizado para el ciudadano
};
const normalize = (s?: string | null) =>
  s ? s.toLowerCase().replace(/\s+/g, '_') : '';

const formatLabel = (s: string) =>
  s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const TicketStatusBar: React.FC<TicketStatusBarProps> = ({ status, flow = [] }) => {
  const [routeStatus, setRouteStatus] = React.useState<string | null>(null);

  // listen to custom route status events dispatched by TicketMap
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setRouteStatus(detail);
    };
    window.addEventListener('route-status', handler);
    return () => window.removeEventListener('route-status', handler);
  }, []);

  const current = normalize(routeStatus || status);
  const steps = React.useMemo(() => {
    const set = new Set(DEFAULT_FLOW);
    flow.map(normalize).forEach((s) => set.add(s));
    if (current) set.add(current);
    return Array.from(set).sort((a, b) => {
      const ia = DEFAULT_FLOW.indexOf(a);
      const ib = DEFAULT_FLOW.indexOf(b);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [flow, current]);
  const currentIndex = steps.indexOf(current);

  return (
    <div className="flex items-center gap-3 my-4">
      {steps.map((step, idx) => {
        const completed = idx <= currentIndex;
        const icon = ICONS[step] || <Check className="w-3 h-3" />;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div
                className={
                  `w-7 h-7 rounded-full border flex items-center justify-center text-xs transition-colors ` +
                  (completed
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-muted border-muted-foreground text-muted-foreground')
                }
              >
                {icon}
              </div>
              <span
                className={`mt-2 text-xs text-center font-medium capitalize ${completed ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {formatLabel(step)}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${idx < currentIndex ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default TicketStatusBar;
