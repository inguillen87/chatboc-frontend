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

    // Check for "Solicitudes" category match first if we want it to be sticky
    // But logic below relies on status primarily.

    const status = normalizeTicketStatus(selectedTicket.estado);

    if (status === 'resuelto') {
      return 'Resueltos';
    }

    // Special handling for call requests
    if (
        selectedTicket.categoria?.toLowerCase().includes('llamada') ||
        selectedTicket.categoria?.toLowerCase().includes('telefonica') ||
        selectedTicket.asunto?.toLowerCase().includes('solicitud de llamada')
    ) {
        return 'Solicitudes';
    }

    return selectedTicket.categoria || 'General';
  }, [selectedTicket]);

  const filteredTicketsByCategory = React.useMemo(() => {
    const baseCategories = { ...ticketsByCategory };

    // Add explicit "Solicitudes" category if not present
    if (!baseCategories['Solicitudes']) {
        baseCategories['Solicitudes'] = [];
    }

    // Move potential call requests to "Solicitudes" bucket or duplicate them there?
    // Let's create a derived view. We iterate all tickets to find call requests.
    // NOTE: ticketsByCategory only groups by main category. We need to look at ALL tickets.

    // We can iterate over all tickets in the context to populate "Solicitudes"
    const allTicketsFlat = Object.values(ticketsByCategory).flat();
    const uniqueTickets = Array.from(new Map(allTicketsFlat.map(t => [t.id, t])).values());

    const solicitudTickets = uniqueTickets.filter(t =>
        (t.categoria?.toLowerCase().includes('llamada') ||
         t.categoria?.toLowerCase().includes('telefonica') ||
         t.asunto?.toLowerCase().includes('solicitud de llamada')) &&
         normalizeTicketStatus(t.estado) !== 'resuelto'
    );

    baseCategories['Solicitudes'] = solicitudTickets;


    // Ensure all backend categories exist even if empty
    backendCategories.forEach(cat => {
        if (!baseCategories[cat]) {
            baseCategories[cat] = [];
        }
    });

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
