import React from "react";
import TicketsPanelLayout from "@/components/tickets/TicketsPanelLayout";
import useRequireRole from "@/hooks/useRequireRole";
import type { Role } from "@/utils/roles";

export default function TicketsPanel() {
  useRequireRole(['admin', 'empleado'] as Role[]);

  return <TicketsPanelLayout />;
}
