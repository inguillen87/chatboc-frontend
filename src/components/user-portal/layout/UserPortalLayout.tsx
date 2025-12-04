import React, { useMemo, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom'; // import useNavigate
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu as MenuIconLucide, Bell, Settings, LogOut, Building, ChevronDown, Moon, Sun } from 'lucide-react';
import SideNavigationBar from '../navigation/SideNavigationBar';
import BottomNavigationBar from '../navigation/BottomNavigationBar';
import { useUser } from '@/hooks/useUser';
import { usePortalTheme } from '@/hooks/usePortalTheme';
import { Badge } from '@/components/ui/badge';


const UserPortalLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useUser();
  const [hasNotifications] = useState(true);
  const { toggle, active, setTheme } = usePortalTheme();

  const themeLabel = useMemo(() => {
    switch (active) {
      case 'dark':
        return 'Modo oscuro';
      case 'light':
        return 'Modo claro';
      default:
        return 'Modo automático';
    }
  }, [active]);

  const handleLogout = () => {
    console.log("Cerrar Sesión");
    // TODO: Lógica de logout real: limpiar tokens, redirigir
    navigate('/login');
  };

  return (
    <div className="flex flex-col min-h-screen bg-light bg-gradient-to-b from-background via-background to-muted/40 dark:from-background dark:via-background dark:to-muted/20 transition-colors">
      {/* Navbar Superior */}
      <header className="bg-background/95 backdrop-blur-md border-b border-border/80 shadow-sm sticky top-0 z-40 h-16">
        <div className="container mx-auto px-4 flex items-center justify-between h-full">
          <div className="flex items-center gap-2">
            {/* Logo de la Organización */}
            <Link to="/portal/dashboard" className="flex items-center gap-2">
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                <AvatarImage src={user?.logo_url} alt={user?.nombre_empresa} />
                <AvatarFallback>
                  <Building className="h-5 w-5 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <span
                className="font-semibold text-foreground hidden sm:inline-block truncate max-w-[150px] md:max-w-xs"
                title={user?.nombre_empresa}
              >
                {user?.nombre_empresa}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full md:hidden"
              aria-label="Cambiar tema"
              onClick={toggle}
            >
              {active === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <div className="hidden lg:flex items-center gap-2">
              <Badge variant="secondary" className="hidden xl:inline-flex">{themeLabel}</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" aria-label="Cambiar tema">
                    {active === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Tema del portal</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTheme('light')}>
                    <Sun className="mr-2 h-4 w-4" />
                    Claro
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <Moon className="mr-2 h-4 w-4" />
                    Oscuro
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')}>
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Automático
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="relative">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary rounded-full">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notificaciones</span>
              </Button>
              {hasNotifications && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                </span>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-1 sm:px-2 py-1 h-auto rounded-full">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                    <AvatarImage src={user?.picture} alt={user?.name} />
                    <AvatarFallback className="text-sm">
                      {user?.name?.charAt(0).toUpperCase()}
                      {user?.name?.split(' ')[1]?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline-block text-sm font-medium text-foreground">
                    {user?.name}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:inline-block ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-1">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-foreground">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/portal/cuenta">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Mi Cuenta</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive hover:!bg-destructive/10 focus:!bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Botón de Menú Hamburguesa para Mobile (controla el Sheet) */}
            <div className="md:hidden"> {/* Este botón solo se ve en mobile y controla el Sheet */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <MenuIconLucide className="h-6 w-6" />
                    <span className="sr-only">Abrir menú</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 p-0">
                  <SideNavigationBar onLinkClick={() => setMobileMenuOpen(false)} />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16 md:pt-0"> {/* pt-16 en mobile para compensar navbar fijo */}
        {/* Menú Lateral (Desktop) */}
        <div className="hidden md:block md:fixed md:top-16 md:left-0 md:h-[calc(100vh-4rem)] md:z-30 shadow-md">
            <SideNavigationBar />
        </div>

        {/* Contenido Principal */}
        {/* El ml-64 para desktop debe ser condicional si el sidebar es colapsable */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-gradient-to-b from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/10 md:ml-64 transition-colors">
          <Outlet />
        </main>
      </div>

      {/* Barra de Navegación Inferior (Mobile) */}
      <BottomNavigationBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
    </div>
  );
};

export default UserPortalLayout;
