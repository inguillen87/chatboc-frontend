import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const PIIWarningBanner: React.FC = () => {
  return (
    <div className="flex items-start gap-2 p-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
      <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex flex-col">
        <span className="font-semibold">Aviso de Privacidad</span>
        <span className="text-amber-700/90 leading-relaxed">
          Al crear este reporte a partir de una foto, asegúrese de que no contenga información personal sensible de terceros (ej. rostros claros de personas no involucradas o documentación privada).
        </span>
      </div>
    </div>
  );
};
