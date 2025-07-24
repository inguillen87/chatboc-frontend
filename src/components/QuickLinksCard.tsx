import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { BarChart2, MessageSquare, Map, Ticket, Settings, ShoppingCart, BookOpen } from 'lucide-react';
import { useUser } from '@/hooks/useUser';

const QuickLinksCard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  const isMunicipio = user?.tipo_chat === 'municipio';

  const links = [
    { to: "/tickets", label: "Tickets", icon: Ticket },
    { to: "/pedidos", label: "Pedidos", icon: ShoppingCart, roles: ['pyme'] },
    { to: isMunicipio ? "/municipal/tramites" : "/pyme/catalog", label: "Catálogo", icon: BookOpen },
    { to: "/municipal/incidents", label: "Mapa", icon: Map, roles: ['municipio', 'admin'] },
    {
      to: isMunicipio ? "/municipal/stats" : "/pyme/metrics",
      label: "Estadísticas",
      icon: BarChart2
    },
    { to: "/consultas", label: "Consultas", icon: MessageSquare },
    { to: "/perfil", label: "Configuración", icon: Settings },
  ];

  const filteredLinks = links.filter(link => {
    if (!link.roles) return true;
    if (user?.rol === 'admin') return true;
    return link.roles.includes(user?.tipo_chat || '');
  });

  return (
    <Card className="bg-card shadow-lg rounded-xl border border-border">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {filteredLinks.map(({ to, label, icon: Icon }) => (
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
