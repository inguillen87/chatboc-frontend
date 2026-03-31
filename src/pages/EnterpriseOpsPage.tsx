import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Inbox, MessagesSquare, Users, BellRing, FileText } from 'lucide-react';

const modules = [
  { key: 'fe-02', title: 'Inbox omnicanal', to: '/tickets', icon: Inbox, note: 'Lista, filtros, timeline y panel 360' },
  { key: 'fe-03', title: 'Live chat / admin bridge', to: '/chatcrm', icon: MessagesSquare, note: 'Continuidad operativa entre conversaciones' },
  { key: 'fe-04', title: 'Roles y empleados', to: '/empleados', icon: Users, note: 'Gestión de equipo y cobertura operativa' },
  { key: 'fe-05a', title: 'Notificaciones', to: '/notificaciones', icon: BellRing, note: 'Centro de notificaciones operativas' },
  { key: 'fe-05b', title: 'Templates', to: '/perfil/plantillas-respuesta', icon: FileText, note: 'Gestión de plantillas por canal' },
] as const;

const EnterpriseOpsPage = () => {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 py-6">
      <header className="space-y-2">
        <Badge variant="secondary">Enterprise workspace</Badge>
        <h1 className="text-3xl font-bold tracking-tight">Operación omnicanal</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.key} className="border-border/70">
              <CardHeader className="space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>{module.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{module.note}</p>
                <Button asChild className="w-full">
                  <Link to={module.to}>Abrir módulo</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};

export default EnterpriseOpsPage;
