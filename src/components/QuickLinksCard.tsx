import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Ticket,
  Users,
  BarChart2,
  UserCog,
  LayoutDashboard,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { normalizeRole } from "@/utils/roles";

interface LinkItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  tipo?: "pyme" | "municipio";
}

const ITEMS: LinkItem[] = [
  { label: "Tickets", path: "/tickets", icon: Ticket, roles: ["admin", "empleado"] },
  { label: "Usuarios", path: "/usuarios", icon: Users, roles: ["admin", "empleado"] },
  { label: "Estadísticas", path: "/municipal/stats", icon: BarChart2, roles: ["admin"], tipo: "municipio" },
  { label: "Empleados", path: "/municipal/usuarios", icon: UserCog, roles: ["admin"], tipo: "municipio" },
];

export default function QuickLinksCard() {
  const navigate = useNavigate();
  const { user } = useUser();

  if (!user) return null;

  const role = normalizeRole(user.rol);
  const tipo = user.tipo_chat as "pyme" | "municipio";

  const items = ITEMS.filter(
    (it) => (!it.roles || it.roles.includes(role)) && (!it.tipo || it.tipo === tipo)
  );

  if (!items.length) return null;

  return (
    <Card className="bg-card shadow-xl rounded-xl border border-border hover:shadow-2xl transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5" /> Accesos rápidos
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {items.map(({ label, path, icon: Icon }) => (
          <Button
            key={path}
            variant="outline"
            className="flex flex-col items-center justify-center gap-2 aspect-square w-full text-xs sm:text-sm rounded-xl shadow-sm hover:bg-accent hover:text-accent-foreground"
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
