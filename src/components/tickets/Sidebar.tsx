import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileDown } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import TicketListItem from './TicketListItem';
import { useTenant } from '@/context/TenantContext';
import { useTickets } from '@/context/TicketContext';
import { apiClient } from '@/api/client';
import { exportToPdf, exportToExcel, exportAllToPdf } from '@/services/exportService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from '@/lib/utils';
import { normalizeTicketStatus } from '@/utils/ticketStatus';

interface SidebarProps {
  className?: string;
  onTicketSelected?: () => void;
}

const ITEMS_PER_PAGE = 10;

const Sidebar: React.FC<SidebarProps> = ({ className, onTicketSelected }) => {
  const { tenant } = useTenant();
  const { tickets, ticketsByCategory, selectedTicket, selectTicket } = useTickets();
  const [searchTerm, setSearchTerm] = React.useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [visibleCounts, setVisibleCounts] = React.useState<{ [key: string]: number }>({});
  const [openCategories, setOpenCategories] = React.useState<string[]>([]);
  const [backendCategories, setBackendCategories] = React.useState<string[]>([]);
  const previousOpenCategoriesRef = React.useRef<string[] | null>(null);

  React.useEffect(() => {
    const fetchCategories = async () => {
      if (tenant?.slug) {
        try {
          const cats = await apiClient.adminGetTicketCategories(tenant.slug);
          setBackendCategories(cats.map((c: any) => c.nombre));
        } catch (e) {
          console.error("Failed to load ticket categories", e);
        }
      }
    };
    fetchCategories();
  }, [tenant?.slug]);

  const selectedCategory = React.useMemo(() => {
    if (!selectedTicket) {
      return null;
    }

    const status = normalizeTicketStatus(selectedTicket.estado);

    if (status === 'resuelto') {
      return 'Resueltos';
    }

    return selectedTicket.categoria || 'General';
  }, [selectedTicket]);

  const filteredTicketsByCategory = React.useMemo(() => {
    const baseCategories = { ...ticketsByCategory };

    // Agrupar 'solicitudes de llamada' si existen en una categoría específica o inferida
    // Si el ticket tiene un tipo especial o prefijo, se podría mover aquí.
    // Por ahora, asumimos que vienen como categoría 'Solicitud de Llamada' desde el backend
    // o las agrupamos manualmente si detectamos el patrón.

    // Ensure all backend categories exist even if empty
    backendCategories.forEach(cat => {
        if (!baseCategories[cat]) {
            baseCategories[cat] = [];
        }
    });

    // Crear grupo explícito para Solicitudes si no existe, o renombrarlo si es necesario
    // Detectamos tickets que parezcan solicitudes de llamada en otras categorías
    const callRequestTerms = ['solicitud de llamada', 'solicito llamada', 'pedir llamada', 'llamarme'];
    const callRequests: any[] = [];

    // Si ya existe la categoría, usémosla como base
    if (baseCategories['Solicitudes de Llamada']) {
        callRequests.push(...baseCategories['Solicitudes de Llamada']);
        delete baseCategories['Solicitudes de Llamada']; // Lo reinsertaremos después
    }

    // Buscar en otras categorías
    Object.keys(baseCategories).forEach(cat => {
        const remainingTickets: any[] = [];
        baseCategories[cat].forEach(ticket => {
            const subject = (ticket.asunto || '').toLowerCase();
            const content = (ticket.mensaje || '').toLowerCase(); // Dependiendo de la estructura del ticket

            if (callRequestTerms.some(term => subject.includes(term) || content.includes(term))) {
                callRequests.push(ticket);
            } else {
                remainingTickets.push(ticket);
            }
        });
        baseCategories[cat] = remainingTickets;
    });

    // Si encontramos solicitudes, las agregamos como categoría prioritaria (al principio si es posible, o simplemente la agregamos)
    if (callRequests.length > 0) {
        // Podemos insertarlo al principio creando un nuevo objeto
        const newCategories = { 'Solicitudes de Llamada': callRequests, ...baseCategories };
        // Asignar de nuevo a baseCategories (que es const, así que mejor retornamos newCategories)
        // Pero baseCategories es una copia local de ticketsByCategory, así que podemos mutar o reasignar referencias.
        // Dado que filteredTicketsByCategory retorna un objeto, retornaremos el nuevo objeto aquí.
        // Sin embargo, filteredTicketsByCategory se construye iterativamente abajo con el término de búsqueda.
        // Así que aquí solo estamos manipulando la "base" antes del filtro de búsqueda.
        // Ah, filteredTicketsByCategory es el useMemo completo.
        // Modifiquemos la lógica para retornar newCategories filtrado después.

        // Re-inject into baseCategories for the search logic below to work on it
        baseCategories['Solicitudes de Llamada'] = callRequests;
    }

    if (!debouncedSearchTerm) {
      return baseCategories;
    }
    const filtered: { [key: string]: any[] } = {};
    const term = debouncedSearchTerm.toLowerCase();

    // Iterate over merged categories
    for (const category in baseCategories) {
      const tickets = baseCategories[category].filter((ticket) => {
        const fields = [
          ticket.asunto,
          ticket.display_name,
          ticket.nombre_usuario,
          ticket.nro_ticket,
          ticket.telefono,
          ticket.email,
          ticket.dni,
          ticket.informacion_personal_vecino?.nombre,
          ticket.informacion_personal_vecino?.telefono,
          ticket.informacion_personal_vecino?.email,
          ticket.informacion_personal_vecino?.dni,
          ticket.direccion,
        ];

        return fields.some((field) =>
          String(field ?? '').toLowerCase().includes(term)
        );
      });
      if (tickets.length > 0) {
        filtered[category] = tickets;
      }
    }
    return filtered;
  }, [ticketsByCategory, backendCategories, debouncedSearchTerm]);

  React.useEffect(() => {
    const newVisibleCounts: { [key: string]: number } = {};
    for (const category in filteredTicketsByCategory) {
      newVisibleCounts[category] = ITEMS_PER_PAGE;
    }
    setVisibleCounts(newVisibleCounts);
  }, [filteredTicketsByCategory]);

  React.useEffect(() => {
    setOpenCategories((prev) =>
      prev.filter((category) => Boolean(filteredTicketsByCategory[category])),
    );
  }, [filteredTicketsByCategory]);

  React.useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    if (!filteredTicketsByCategory[selectedCategory]) {
      return;
    }

    setOpenCategories((prev) =>
      prev.includes(selectedCategory) ? prev : [...prev, selectedCategory],
    );
  }, [filteredTicketsByCategory, selectedCategory]);

  React.useEffect(() => {
    if (!debouncedSearchTerm) {
      return;
    }

    if (previousOpenCategoriesRef.current === null) {
      previousOpenCategoriesRef.current = openCategories.length
        ? openCategories
        : selectedCategory
          ? [selectedCategory]
          : [];
    }

    const categories = Object.keys(filteredTicketsByCategory);

    if (categories.length === 0) {
      if (openCategories.length > 0) {
        setOpenCategories([]);
      }
      return;
    }

    const sameOrder =
      categories.length === openCategories.length &&
      categories.every((category, index) => category === openCategories[index]);

    if (sameOrder) {
      return;
    }

    setOpenCategories(categories);
  }, [debouncedSearchTerm, filteredTicketsByCategory, openCategories, selectedCategory]);

  React.useEffect(() => {
    if (debouncedSearchTerm) {
      return;
    }

    if (previousOpenCategoriesRef.current === null) {
      return;
    }

    const restored = previousOpenCategoriesRef.current;
    previousOpenCategoriesRef.current = null;

    if (restored.length > 0) {
      setOpenCategories(restored);
      return;
    }

    if (selectedCategory) {
      setOpenCategories([selectedCategory]);
    } else {
      setOpenCategories([]);
    }
  }, [debouncedSearchTerm, selectedCategory]);

  const handleLoadMore = (category: string) => {
    setVisibleCounts((prev) => ({
      ...prev,
      [category]: (prev[category] || ITEMS_PER_PAGE) + ITEMS_PER_PAGE,
    }));
  };

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 min-w-0 shrink-0 flex-col border-r border-border bg-muted/20',
        className,
      )}
    >
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            {tenant?.tipo === 'municipio' ? 'Reclamos' : 'Tickets'}
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToExcel(tickets)}>
                Exportar Todos (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAllToPdf(tickets)}>
                Exportar Todos (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPdf(selectedTicket, selectedTicket?.messages || [])} disabled={!selectedTicket}>
                Exportar Ticket Actual (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nro, asunto, nombre, DNI, teléfono..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <Accordion
          type="multiple"
          className="w-full"
          value={openCategories}
          onValueChange={setOpenCategories}
        >
          {Object.entries(filteredTicketsByCategory).map(([category, tickets]) => (
            <AccordionItem value={category} key={category}>
              <AccordionTrigger className="px-4 font-semibold">
                {category} ({tickets.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-1 space-y-2">
                  {tickets.slice(0, visibleCounts[category] || ITEMS_PER_PAGE).map((ticket) => (
                    <TicketListItem
                      key={ticket.id}
                      ticket={ticket}
                      isSelected={selectedTicket?.id === ticket.id}
                      onClick={() => {
                        selectTicket(ticket.id);
                        onTicketSelected?.();
                      }}
                    />
                  ))}
                  {(visibleCounts[category] || ITEMS_PER_PAGE) < tickets.length && (
                    <div className="p-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleLoadMore(category)}
                      >
                        Cargar más
                      </Button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </aside>
  );
};

export default Sidebar;
