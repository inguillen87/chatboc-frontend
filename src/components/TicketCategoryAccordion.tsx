// TicketCategoryAccordion.tsx

import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Ticket } from "@/types/tickets"; // Ajustá este import si tu tipo está en otro lado
import TicketCard from "./TicketCard"; // O el componente que uses para mostrar cada ticket

interface Props {
  categoria: string;
  tickets: Ticket[];
  selectedTicketId?: number | null;
  onSelect: (ticket: Ticket) => void;
  icono?: React.ReactNode;
  color?: string;
  defaultOpen?: boolean;
}

const TicketCategoryAccordion: React.FC<Props> = ({
  categoria,
  tickets,
  selectedTicketId,
  onSelect,
  icono,
  color = "bg-muted/40",
  defaultOpen = true,
}) => {
  const hasTickets = tickets.length > 0;

  return (
    <Accordion type="single" collapsible defaultValue={defaultOpen ? categoria : undefined} className="w-full">
      <AccordionItem value={categoria}>
        <AccordionTrigger className={`px-4 py-2 text-left text-sm font-semibold border-b ${color}`}>
          <div className="flex items-center gap-2">
            {icono}
            <span>{categoria} ({tickets.length})</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-2 p-2">
          {hasTickets ? (
            tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedTicketId === ticket.id}
                onSelect={() => onSelect(ticket)}
              />
            ))
          ) : (
            <p className="text-muted-foreground text-xs">No hay tickets en esta categoría.</p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default TicketCategoryAccordion;
