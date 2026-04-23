import React from 'react';
import { PolicyDecision } from '@/schemas/api';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

interface PolicyBannerProps {
  decision?: PolicyDecision;
  isStreaming?: boolean;
}

export const PolicyBanner: React.FC<PolicyBannerProps> = ({ decision, isStreaming }) => {
  if (!decision) return null;

  if (decision.decision === 'allowed') {
    // Only show "allowed" subtly if explicitly needed, usually we hide it to not pollute UI.
    return null;
  }

  if (decision.decision === 'blocked') {
    return (
      <div className="flex items-start gap-2 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex flex-col">
          <span className="font-semibold">Respuesta bloqueada por política</span>
          <span className="text-red-700/90">{decision.reason || 'El contenido infringe las directrices de uso.'}</span>
        </div>
      </div>
    );
  }

  if (decision.decision === 'redacted') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 mb-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md w-max">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Parte del contenido fue redactado por privacidad (PII).</span>
      </div>
    );
  }

  if (decision.decision === 'flagged') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 mb-2 text-xs font-medium text-orange-800 bg-orange-50 border border-orange-200 rounded-md w-max">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Requiere validación humana.</span>
      </div>
    );
  }

  return null;
};
