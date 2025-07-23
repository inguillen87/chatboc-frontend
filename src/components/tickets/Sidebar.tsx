import React from 'react';

const Sidebar: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">Bandeja de Entrada</h1>
      </div>
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Filtros y lista de tickets aquí.</p>
      </div>
    </div>
  );
};

export default Sidebar;
