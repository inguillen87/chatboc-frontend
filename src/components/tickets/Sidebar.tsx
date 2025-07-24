import React from 'react';
import { Button } from '@/components/ui/button';
import { exportToPdf } from '@/services/exportService';

const Sidebar: React.FC = () => {
  const handleExport = () => {
    const data = [
      { id: 1, name: 'John Doe', email: 'john.doe@example.com' },
      { id: 2, name: 'Jane Doe', email: 'jane.doe@example.com' },
    ];
    const columns = [
      { header: 'ID', accessor: 'id' },
      { header: 'Name', accessor: 'name' },
      { header: 'Email', accessor: 'email' },
    ];
    exportToPdf(data, columns, 'tickets');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">Bandeja de Entrada</h1>
      </div>
      <div className="p-4">
        <Button onClick={handleExport}>Exportar a PDF</Button>
        <p className="text-sm text-muted-foreground mt-4">Filtros y lista de tickets aquí.</p>
      </div>
    </div>
  );
};

export default Sidebar;
