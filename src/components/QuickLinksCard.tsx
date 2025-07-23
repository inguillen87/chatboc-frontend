import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { BarChart2, MessageSquare, Map, Ticket, Settings } from 'lucide-react';

const links = [
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/mapa-incidentes", label: "Mapa", icon: Map },
  { to: "/estadisticas", label: "Estadísticas", icon: BarChart2 },
  { to: "/consultas", label: "Consultas", icon: MessageSquare },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

const QuickLinksCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card className="bg-card shadow-lg rounded-xl border border-border">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {links.map(({ to, label, icon: Icon }) => (
            <Button
              key={to}
              variant="ghost"
              className="flex-1 sm:flex-none text-muted-foreground hover:text-primary hover:bg-primary/10"
              onClick={() => navigate(to)}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickLinksCard;
