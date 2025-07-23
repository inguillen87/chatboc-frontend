import React from 'react';

const DetailsPanel: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-l">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Detalles del Usuario</h2>
      </div>
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Info del cliente, ticket, mapa y adjuntos aquí.</p>
      </div>
    </div>
  );
};

export default DetailsPanel;
