import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ticket,
  Users,
  BarChart2,
  UserCog,
  MapPin,
  Package,
  TrendingUp,
  Boxes,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { normalizeRole } from "@/utils/roles";
import useEndpointAvailable from "@/hooks/useEndpointAvailable";

interface LinkItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  tipo?: "pyme" | "municipio";
}

const ITEMS: LinkItem[] = [
  { label: "Tickets", path: "/tickets", icon: Ticket, roles: ["admin", "empleado"] },
  { label: "Pedidos", path: "/pedidos", icon: Package, roles: ["admin", "empleado"], tipo: "pyme" },
  { label: "Métricas", path: "/pyme/metrics", icon: TrendingUp, roles: ["admin"], tipo: "pyme" },
  { label: "Catálogo", path: "/pyme/catalog", icon: Boxes, roles: ["admin"], tipo: "pyme" },
  { label: "Usuarios", path: "/usuarios", icon: Users, roles: ["admin", "empleado"] },
  { label: "Estadísticas", path: "/municipal/stats", icon: BarChart2, roles: ["admin"], tipo: "municipio" },
  { label: "Empleados", path: "/municipal/usuarios", icon: UserCog, roles: ["admin"], tipo: "municipio" },
  { label: "Mapa", path: "/municipal/incidents", icon: MapPin, roles: ["admin"], tipo: "municipio" },
];

export default function QuickLinksCard() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const pedidosAvailable = useEndpointAvailable('/pedidos');

  useEffect(() => {
    if (!user) {
      refreshUser();
    }
  }, [user, refreshUser]);

  if (!user) {
    return (
      <Card className="bg-card shadow-xl rounded-xl border border-border">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const role = normalizeRole(user.rol);
  const tipo = user.tipo_chat as "pyme" | "municipio";

  const items = ITEMS.filter((it) => {
    if (it.path === '/pedidos' && pedidosAvailable === false) return false;
    return (!it.roles || it.roles.includes(role)) && (!it.tipo || it.tipo === tipo);
  });

  if (!items.length) return null;

  return (
    <Card className="bg-card shadow-xl rounded-xl border border-border hover:shadow-2xl transition-shadow">
      <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map(({ label, path, icon: Icon }) => (
          <Button
            key={path}
            aria-label={label}
            variant="outline"
            className="flex flex-col items-center justify-center gap-2 aspect-square w-full text-xs sm:text-sm rounded-xl shadow-sm hover:shadow-md hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => navigate(path)}
          >
            <Icon className="w-6 h-6" />
            {label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
