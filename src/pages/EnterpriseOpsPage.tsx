import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, CheckCircle2, FileText, Inbox, MessagesSquare, ServerCog, Users } from 'lucide-react';

import EnterprisePageHeader from '@/components/enterprise/EnterprisePageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const modules = [
  {
    key: 'fe-02',
    title: 'Inbox omnicanal',
    to: '/tickets',
    icon: Inbox,
    note: 'Lista, filtros, timeline y panel 360 preparados para contratos v2.',
    status: 'Backend parcial',
  },
  {
    key: 'fe-03',
    title: 'Live chat / admin bridge',
    to: '/chatcrm',
    icon: MessagesSquare,
    note: 'Continuidad operativa entre conversaciones, handoff y contexto.',
    status: 'Frontend listo',
  },
  {
    key: 'fe-04',
    title: 'Roles y empleados',
    to: '/empleados',
    icon: Users,
    note: 'Cobertura operativa y asignaciones pendientes de datos backend.',
    status: 'Backend requerido',
  },
  {
    key: 'fe-05a',
    title: 'Notificaciones',
    to: '/notificaciones',
    icon: BellRing,
    note: 'Centro operativo preparado para hooks y preferencias por canal.',
    status: 'Backend requerido',
  },
  {
    key: 'fe-05b',
    title: 'Templates',
    to: '/perfil/plantillas-respuesta',
    icon: FileText,
    note: 'Plantillas por canal listas para permisos, variables y versionado.',
    status: 'Frontend listo',
  },
] as const;

const backendBlockers = [
  'Employee coverage y disponibilidad real.',
  'Tenant health para ranking y alertas.',
  'Executive summary superadmin consolidado.',
  'Inbox omnicanal premium con timeline completo.',
  'Hooks de notifications y delivery status.',
];

const EnterpriseOpsPage = () => {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 py-6">
      <EnterprisePageHeader
        badge="Enterprise workspace"
        title="Operacion omnicanal"
        description="Modulos operativos conectados a contratos backend-driven, con rutas listas para completar datos reales sin personalizacion local."
        meta={`${modules.length} modulos disponibles`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          const isBackendRequired = module.status === 'Backend requerido';

          return (
            <Card key={module.key} className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant={isBackendRequired ? 'outline' : 'secondary'}>{module.status}</Badge>
                </div>
                <div className="space-y-1.5">
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>{module.note}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" variant={isBackendRequired ? 'outline' : 'default'}>
                  <Link to={module.to}>
                    Abrir modulo
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Frontend preparado
            </CardTitle>
            <CardDescription>
              Las rutas enterprise ya tienen shells, estados de carga/error/offline y handoff de contratos para backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <ReadinessStat label="Rutas" value={modules.length} />
            <ReadinessStat label="Listas FE" value={modules.filter((module) => module.status === 'Frontend listo').length} />
            <ReadinessStat label="Backend" value={modules.filter((module) => module.status !== 'Frontend listo').length} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ServerCog className="h-5 w-5 text-muted-foreground" />
              Backend blockers
            </CardTitle>
            <CardDescription>Pedidos concretos ya documentados para la proxima tanda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {backendBlockers.map((blocker) => (
              <p key={blocker}>{blocker}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

function ReadinessStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default EnterpriseOpsPage;
