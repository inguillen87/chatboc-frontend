import React from "react";
import { Button } from "@/components/ui/button";

interface Props {
  info: {
    nombre_empresa?: string;
    logo_url?: string;
    rubro?: string;
    direccion?: string;
    telefono?: string;
    link_web?: string;
  } | null;
  onClose: () => void;
}

const EntityInfoPanel: React.FC<Props> = ({ info, onClose }) => {
  if (!info) return null;
  const { nombre_empresa, logo_url, rubro, direccion, telefono, link_web } = info;
  return (
    <div className="p-4 flex flex-col gap-4 w-full max-w-sm mx-auto animate-fade-in overflow-y-auto">
      <div className="p-4 rounded-xl bg-card border shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          {logo_url && (
            <img src={logo_url} alt="Logo" className="w-10 h-10 rounded-lg" />
          )}
          <div>
            <div className="font-bold text-lg">{nombre_empresa}</div>
            {rubro && (
              <div className="text-xs text-muted-foreground">{rubro}</div>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          {direccion && <div>📍 {direccion}</div>}
          {telefono && <div>📞 {telefono}</div>}
          {link_web && (
            <div>
              🌐{' '}
              <a
                href={link_web}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {link_web}
              </a>
            </div>
          )}
        </div>
      </div>
      <Button variant="secondary" className="w-full" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  );
};

export default EntityInfoPanel;
