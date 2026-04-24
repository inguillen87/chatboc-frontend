import React from 'react';
import { Loader2, CheckCircle2, Cog } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToolExecutionChipProps {
  toolName: string;
  status: 'running' | 'completed' | 'error';
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  search_catalog: "Consultando catálogo",
  check_ticket_status: "Buscando reclamo",
  create_ticket: "Generando reporte",
  fetch_municipal_kb: "Revisando normativa",
  escalate_to_agent: "Contactando agente",
};

export const ToolExecutionChip: React.FC<ToolExecutionChipProps> = ({ toolName, status }) => {
  const displayName = TOOL_DISPLAY_NAMES[toolName] || `Ejecutando: ${toolName}`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full mb-2 border
          ${status === 'running' ? 'bg-blue-50 text-blue-700 border-blue-100' : ''}
          ${status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' : ''}
          ${status === 'error' ? 'bg-red-50 text-red-700 border-red-100' : ''}
        `}
      >
        {status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
        {status === 'error' && <Cog className="w-3.5 h-3.5 text-red-500" />}

        <span>{displayName}</span>
      </motion.div>
    </AnimatePresence>
  );
};
