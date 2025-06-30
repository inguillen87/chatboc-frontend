import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Ticket, MessageSquare, ShoppingBag, Menu as MenuIcon, User, Settings, LogOut, Info, ShieldQuestion, FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatbocLogoAnimated from '../chat/ChatbocLogoAnimated';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';
import routesConfig from '@/routesConfig'; // Importar la configuración de rutas para el título

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
}

// Rutas que se consideran "nivel raíz" para la TabBar y no mostrarán el botón "Atrás"
// Ajustar según las rutas principales de la aplicación
const rootTabPaths = ['/dashboard', '/tickets', '/chat', '/catalog', '/'];

const mainNavItems: NavItem[] = [
  { href: '/dashboard', icon: Home, label: 'Inicio' },
  { href: '/tickets', icon: Ticket, label: 'Tickets' },
  { href: '/chat', icon: MessageSquare, label: 'Chat' },
  { href: '/catalog', icon: ShoppingBag, label: 'Catálogo' },
];

const drawerNavItems: NavItem[] = [
  // Secciones de información/ayuda
  { href: '/docs', icon: FileText, label: 'Documentación' },
  { href: '/faqs', icon: ShieldQuestion, label: 'FAQs' },
  { href: '/legal/privacy', icon: Info, label: 'Privacidad' },
  // Podríamos añadir más items aquí si es necesario
];

// Función para obtener el título de la página basado en la ruta actual
const getPageTitle = (pathname: string): string => {
  const mainNavItem = mainNavItems.find(item => pathname === item.href || pathname.startsWith(`${item.href}/`));

  if (pathname === '/') return "Chatboc"; // Título para la Landing Page (aunque MobileNavbar no se muestra aquí si no hay user)
  if (mainNavItem && pathname === mainNavItem.href) return mainNavItem.label;

  const routeConfigItem = routesConfig.find(r => {
    const routePathRegex = new RegExp(`^${r.path.replace(/:\w+/g, '([^/]+)')}$`);
    return routePathRegex.test(pathname);
  });

  if (routeConfigItem) {
    const pageElement = routeConfigItem.element as React.ReactElement & { props: { title?: string, label?: string } };
    if (pageElement?.props?.title) return pageElement.props.title;
    if (pageElement?.props?.label) return pageElement.props.label;

    if (!rootTabPaths.includes(pathname)) {
        const pathParts = pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          if (!/^\d+$/.test(lastPart) && lastPart.length < 20) { // Evitar IDs largos o numéricos como títulos
            return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/-/g, ' ');
          }
        }
    }
  }

  if (mainNavItem) return mainNavItem.label; // Fallback para subpáginas de secciones de TabBar

  if (pathname.startsWith('/perfil')) return 'Mi Perfil';
  if (pathname.startsWith('/settings')) return 'Configuración';

  return "Chatboc"; // Título por defecto
};


const MobileNavbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user, logout } = useUser();

  // Ajuste para que '/' (landing) no active todos los items si se usa como prefijo en otras rutas
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const isRootPathForBackButton = rootTabPaths.includes(location.pathname);
  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = async () => {
    await logout();
    setIsDrawerOpen(false);
    navigate('/login');
  };

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  // MobileNavbar solo se renderiza si hay un usuario logueado (ver AppShell.tsx)
  // Por lo tanto, aquí podemos asumir que `user` existe.
  if (!user) {
    return null;
  }

  return (
    <>
      {/* Header Superior Fijo */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-40 flex items-center h-16 px-2 sm:px-4 bg-card/90 backdrop-blur-md shadow-sm border-b",
        "transition-all duration-300"
      )}>
        <div className="flex items-center flex-1 min-w-0">
          {!isRootPathForBackButton ? (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver" className="mr-1 shrink-0">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          ) : (
            <Link to="/dashboard" aria-label="Ir al inicio" className="p-2 shrink-0">
              <ChatbocLogoAnimated size={30} />
            </Link>
          )}
          <h1 className="text-lg font-semibold text-foreground truncate text-center flex-1 mx-2">
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center shrink-0">
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menú" className="ml-auto">
                <MenuIcon className="h-7 w-7" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[320px] p-0 flex flex-col bg-card">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-3 text-lg font-semibold"> {/* Aumentado a text-lg */}
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatarUrl || undefined} alt={user.nombre || 'Usuario'} />
                    <AvatarFallback className="text-base">{user.nombre ? user.nombre.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                  </Avatar>
                  <span>{user.nombre || 'Menú'}</span>
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="flex-1">
                <nav className="py-3 text-base"> {/* text-base para items del drawer (aprox 17px en móvil) */}
                  <Link
                    to="/perfil"
                    className="flex items-center justify-between px-4 py-3.5 hover:bg-accent transition-colors"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span>Mi Perfil</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center justify-between px-4 py-3.5 hover:bg-accent transition-colors"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-muted-foreground" />
                      <span>Configuración</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                  <Separator className="my-2" />
                  {drawerNavItems.map((item) => (
                    <Link
                      key={item.label}
                      to={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noopener noreferrer' : undefined}
                      className="flex items-center justify-between px-4 py-3.5 hover:bg-accent transition-colors"
                      onClick={() => setIsDrawerOpen(false)}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5 text-muted-foreground" />
                        <span>{item.label}</span>
                      </div>
                      {item.external ? null : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    </Link>
                  ))}
                </nav>
              </ScrollArea>
              <div className="p-4 mt-auto border-t">
                <Button variant="outline" size="lg" className="w-full text-base font-medium" onClick={handleLogout}> {/* text-base y size="lg" */}
                  <LogOut className="mr-2 h-5 w-5" />
                  Cerrar Sesión
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Tab Bar Inferior Fija */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-40 grid h-[calc(4.5rem+env(safe-area-inset-bottom))] grid-cols-4 bg-card/90 backdrop-blur-md shadow-top border-t md:hidden", // Altura aumentada a 4.5rem (~72px)
        "pb-[env(safe-area-inset-bottom)]"
      )}>
        {mainNavItems.slice(0, 4).map((item) => (
          <Link
            key={item.label}
            to={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 text-sm font-medium transition-colors", // text-sm para etiquetas (aprox 15px en móvil)
              isActive(item.href)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-6 w-6 mb-0.5", isActive(item.href) ? "text-primary" : "")} /> {/* Iconos h-6 w-6 */}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
};

export default MobileNavbar;
