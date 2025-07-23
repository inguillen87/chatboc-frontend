import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, RefreshCw, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TicketsPanelHeaderProps {
  onNewTicket: () => void;
  onRefresh: () => void;
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const TicketsPanelHeader: React.FC<TicketsPanelHeaderProps> = ({
  onNewTicket,
  onRefresh,
  categories,
  activeCategory,
  onCategoryChange,
}) => {
  return (
    <header className="p-3 border-b bg-background flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bandeja de Entrada</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                Acciones
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Marcar como leídos</DropdownMenuItem>
              <DropdownMenuItem>Exportar selección</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Configuración</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={onNewTicket}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Nuevo Ticket
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Button
          variant={activeCategory === 'todos' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onCategoryChange('todos')}
        >
          Todos
        </Button>
        {categories.map(category => (
          <Button
            key={category}
            variant={activeCategory === category ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </Button>
        ))}
      </div>
    </header>
  );
};

export default TicketsPanelHeader;
