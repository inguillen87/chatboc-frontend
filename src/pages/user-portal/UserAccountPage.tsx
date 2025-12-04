import React, { useMemo, useState } from 'react';
import { Bell, Moon, Shield, UserCircle } from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

const UserAccountPage = () => {
  const { user } = useUser();
  const { currentSlug } = useTenant();
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);

  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [darkModePreview, setDarkModePreview] = useState(false);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Panel demo editable en este dispositivo</p>
          <h1 className="text-3xl font-bold text-foreground">Mi cuenta</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Revisa tus datos de contacto y preferencias de notificaciones.
          </p>
        </div>
        {!user && (
          <Button asChild variant="outline">
            <a href={loginPath}>Iniciar sesión</a>
          </Button>
        )}
      </div>

      <Card className="border border-muted/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            Datos de contacto
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" placeholder="Nombre de la cuenta" defaultValue={user?.name ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" placeholder="correo@ejemplo.com" defaultValue={user?.email ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" type="tel" placeholder="Actualizar teléfono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document">Documento</Label>
            <Input id="document" placeholder="Documento" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="secondary">Guardar en este dispositivo</Button>
        </CardFooter>
      </Card>

      <Card className="border border-muted/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Preferencias de notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Notificaciones por correo</p>
              <p className="text-xs text-muted-foreground">Avisos de pedidos, reclamos y eventos.</p>
            </div>
            <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Notificaciones push</p>
              <p className="text-xs text-muted-foreground">Seguimiento en tiempo real desde el portal.</p>
            </div>
            <Switch checked={notifyPush} onCheckedChange={setNotifyPush} />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-muted/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-primary" />
            Apariencia y seguridad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Modo oscuro</p>
              <p className="text-xs text-muted-foreground">Previsualiza la versión nocturna del portal.</p>
            </div>
            <Switch checked={darkModePreview} onCheckedChange={setDarkModePreview} />
          </div>
          <div className="flex items-start gap-3 text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg">
            <Shield className="h-5 w-5 text-primary" />
            <p>Al iniciar sesión, tus preferencias se guardarán junto con tu cuenta y tenant activo.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Sincroniza tu sesión para aplicar los cambios reales.</span>
          <Button asChild size="sm">
            <a href={loginPath}>Ir a iniciar sesión</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default UserAccountPage;
