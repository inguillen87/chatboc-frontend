export interface V2Ticket {
  id: string;
  title: string;
  status: string;
  priority?: string;
  sla_state?: string;
  channel?: string;
  category?: string;
  assignee_name?: string | null;
  updated_at?: string | null;
}
