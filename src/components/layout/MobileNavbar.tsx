import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Ticket, MessageSquare, ShoppingBag, Menu as MenuIcon, X, User, Settings, LogOut, Info, ShieldQuestion, FileText, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'; // Usaremos Sheet para el Drawer
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatbocLogoAnimated from '../chat/ChatbocLogoAnimated'; // Asumiendo que existe y es adaptable
import { useUser } from '@/hooks/useUser'; // Hook para obtener información del usuario
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', icon: Home, label: 'Inicio' }, // Cambiar a /dashboard o la ruta principal post-login
  { href: '/tickets', icon: Ticket, label: 'Tickets' },
  { href: '/chat', icon: MessageSquare, label: 'Chat' }, // O una lista de conversaciones
  { href: '/catalog', icon: ShoppingBag, label: 'Catálogo' },
];

const drawerNavItems: NavItem[] = [
  { href: '/docs', icon: FileText, label: 'Documentación' },
  { href: '/faqs', icon: ShieldQuestion, label: 'FAQs' },
  { href: '/legal/privacy', icon: Info, label: 'Privacidad' },
];

const MobileNavbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user, logout } = useUser(); // Obtener usuario y función de logout

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleLogout = async () => {
    await logout();
    setIsDrawerOpen(false);
    navigate('/login'); // Redirigir a login después del logout
  };

  // Cerrar drawer al cambiar de ruta
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  // TODO: Lógica para el título del Header dinámico
  // const getHeaderTitle = (): string => {
  //   // Lógica para determinar el título basado en location.pathname y los routesConfig
  //   // Por ahora, un placeholder:
  //   const currentMainItem = mainNavItems.find(item => isActive(item.href));
  //   if (currentMainItem) return currentMainItem.label;
  //   // Buscar en rutas anidadas o config de rutas
  //   return "Chatboc";
  // };

  return (
    <>
      {/* Header Superior Fijo */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-16 px-4 bg-card/80 backdrop-blur-sm shadow-sm border-b">
        <div>
          {/* TODO: Botón de Atrás condicional si no es una vista de Tab Bar principal */}
          {/* <Button variant="ghost" size="icon"><ArrowLeft /></Button> */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <ChatbocLogoAnimated size={28} />
            <span className="text-xl font-bold text-primary">Chatboc</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {/* TODO: Icono de Notificaciones y Búsqueda si son globales */}
          {/* <Button variant="ghost" size="icon"><Bell /></Button> */}
          {/* <Button variant="ghost" size="icon"><Search /></Button> */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menú">
                <MenuIcon className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[320px] p-0 flex flex-col">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  {user ? (
                    <>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatarUrl || undefined} alt={user.nombre || 'Usuario'} />
                        <AvatarFallback>{user.nombre ? user.nombre.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                      </Avatar>
                      <span>{user.nombre || 'Menú'}</span>
                    </>
                  ) : (
                    'Menú'
                  )}
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="flex-1">
                <nav className="py-4">
                  {user && (
                    <>
                      <Link
                        to="/perfil"
                        className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent"
                        onClick={() => setIsDrawerOpen(false)}
                      >
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <span>Mi Perfil</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      <Link
                        to="/settings" // Asumir una ruta de configuraciones
                        className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent"
                        onClick={() => setIsDrawerOpen(false)}
                      >
                        <div className="flex items-center gap-3">
                          <Settings className="h-5 w-5 text-muted-foreground" />
                          <span>Configuración</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      <Separator className="my-2" />
                    </>
                  )}
                  {drawerNavItems.map((item) => (
                    <Link
                      key={item.label}
                      to={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noopener noreferrer' : undefined}
                      className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent"
                      onClick={() => setIsDrawerOpen(false)}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5 text-muted-foreground" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </nav>
              </ScrollArea>
              <div className="p-4 mt-auto border-t">
                {user ? (
                  <Button variant="outline" className="w-full" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </Button>
                ) : (
                  <Button asChild className="w-full" onClick={() => setIsDrawerOpen(false)}>
                    <Link to="/login">
                      Iniciar Sesión
                    </Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Tab Bar Inferior Fija */}
      {user && ( // Mostrar TabBar solo si el usuario está logueado
        <nav className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-4 bg-card/80 backdrop-blur-sm shadow-top border-t md:hidden">
          {mainNavItems.slice(0, 4).map((item) => ( // Mostrar solo 4 items principales en TabBar
            <Link
              key={item.label}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 pt-2 pb-1 text-xs font-medium transition-colors",
                isActive(item.href)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive(item.href) ? "text-primary" : "")} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  );
};

export default MobileNavbar;

// Añadir `shadow-top` a tailwind.config.ts si no existe:
// theme: { extend: { boxShadow: { top: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)' } } }
// (Esto es un comentario para el desarrollador, no parte del código del archivo)
