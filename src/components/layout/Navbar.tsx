import React, { useEffect, useMemo, useState } from "react";
import ChatbocLogoAnimated from "../chat/ChatbocLogoAnimated";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Moon,
  Sun,
  User,
  LogOut,
  MessageCircle,
  BarChart3,
  Ticket as TicketIcon,
  ClipboardList,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FEATURE_ENCUESTAS } from "@/config/featureFlags";
import { useUser } from "@/hooks/useUser";
import type { LucideIcon } from "lucide-react";

const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();
  const { user } = useUser();

  const isLanding = location.pathname === "/";
  const isLoggedIn = !!safeLocalStorage.getItem("user");
  const userRole = user?.rol;
  const isAdminLike = useMemo(
    () => Boolean(userRole && ["admin", "empleado", "super_admin"].includes(userRole)),
    [userRole],
  );
  const isMunicipal = user?.tipo_chat === "municipio";
  const analyticsPath = isMunicipal ? "/estadisticas" : "/analytics";
  const adminLinks = useMemo(() => {
    if (!isAdminLike) {
      return [] as Array<{ to: string; label: string; icon: LucideIcon }>;
    }

    const links: Array<{ to: string; label: string; icon: LucideIcon }> = [
      { to: "/tickets", label: "Tickets", icon: TicketIcon },
      { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
      { to: "/usuarios", label: "Usuarios", icon: Users },
    ];

    links.push({
      to: analyticsPath,
      label: isMunicipal ? "Estadísticas" : "Analytics",
      icon: BarChart3,
    });

    return links;
  }, [analyticsPath, isAdminLike, isMunicipal]);
  const storedUserRaw = useMemo(
    () => (isLoggedIn ? safeLocalStorage.getItem("user") : null),
    [isLoggedIn],
  );
  const userInitials = useMemo(() => {
    if (!storedUserRaw) return "TU";
    try {
      const parsed = JSON.parse(storedUserRaw);
      const source = parsed?.nombre || parsed?.name || parsed?.email || "";
      if (!source) return "TU";
      const letters = source
        .split(/\s+/)
        .filter(Boolean)
        .map((part: string) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
      return letters || "TU";
    } catch {
      return "TU";
    }
  }, [storedUserRaw]);

  useEffect(() => {
    const currentTheme = safeLocalStorage.getItem("theme");
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    const currentlyDark = html.classList.contains("dark");

    if (currentlyDark) {
      html.classList.remove("dark");
      safeLocalStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      html.classList.add("dark");
      safeLocalStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el && isLanding) {
      el.scrollIntoView({ behavior: "smooth" });
      setMenuOpen(false);
    } else {
      window.location.href = `/#${id}`;
    }
  };

  const handleLogoClick = () => {
    if (isLanding) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.location.href = "/";
    }
    setMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card shadow-sm transition-all px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <button onClick={handleLogoClick} className="flex items-center gap-2">
          <ChatbocLogoAnimated size={36} blinking pulsing />
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-cyan-400 text-transparent bg-clip-text">
            Chatboc
          </span>
        </button>

        {/* Links centrales - solo landing - desktop */}
        {isLanding && (
          <nav className="hidden md:flex gap-6 items-center flex-1 justify-center">
            <button onClick={() => scrollToSection("problemas")} className="text-sm text-foreground/80 hover:text-primary dark:hover:text-primary transition-colors">Problemas</button>
            <button onClick={() => scrollToSection("solucion")} className="text-sm text-foreground/80 hover:text-primary dark:hover:text-primary transition-colors">Solución</button>
            <button onClick={() => scrollToSection("como-funciona")} className="text-sm text-foreground/80 hover:text-primary dark:hover:text-primary transition-colors">Cómo Funciona</button>
            <button onClick={() => scrollToSection("precios")} className="text-sm text-foreground/80 hover:text-primary dark:hover:text-primary transition-colors">Precios</button>
            <button onClick={() => scrollToSection("publico-objetivo")} className="text-sm text-foreground/80 hover:text-primary dark:hover:text-primary transition-colors">Público Objetivo</button>
            <RouterLink to="/opinar" className="text-sm text-foreground/80 hover:text-primary dark:hover:text-primary transition-colors">Próximamente</RouterLink>
            <button onClick={() => scrollToSection("cta")} className="text-sm text-foreground/80 hover:text-primary dark:hover:text-primary transition-colors">Empezar</button>
          </nav>
        )}

        {/* Botones lado derecho */}
        <div className="hidden md:flex gap-3 items-center">
          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm shadow-sm transition-colors hover:bg-accent"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden font-medium text-foreground md:inline">Mi cuenta</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <RouterLink to="/perfil" className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    Mi perfil
                  </RouterLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <RouterLink to="/chat" className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4" />
                    Chat en vivo
                  </RouterLink>
                </DropdownMenuItem>
                {adminLinks.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {adminLinks.map(({ to, label, icon: Icon }) => (
                      <DropdownMenuItem asChild key={to}>
                        <RouterLink to={to} className="flex items-center gap-2 text-sm">
                          <Icon className="h-4 w-4" />
                          {label}
                        </RouterLink>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                {FEATURE_ENCUESTAS && (
                  <DropdownMenuItem asChild>
                    <RouterLink to="/admin/encuestas" className="flex items-center gap-2 text-sm">
                      <BarChart3 className="h-4 w-4" />
                      Panel de encuestas
                    </RouterLink>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                  onSelect={() => {
                    safeLocalStorage.removeItem('user');
                    window.location.href = '/';
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <RouterLink to="/login" className="px-3 py-1 border border-primary text-primary rounded hover:bg-primary/10 text-sm dark:text-primary-foreground dark:border-primary-foreground dark:hover:bg-primary-foreground/10 transition-colors">Iniciar Sesión</RouterLink>
              <RouterLink to="/demo" className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm transition-colors">Prueba Gratuita</RouterLink>
            </>
          )}
          <button
            onClick={toggleDarkMode}
            title="Modo claro / oscuro"
            className="p-2 rounded-full hover:bg-accent text-foreground transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Botón menú mobile */}
        <button className="md:hidden p-2 text-foreground" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Menú Mobile desplegable */}
      {menuOpen && (
        <div className="md:hidden bg-card shadow-md mt-2 rounded-b-xl animate-fade-in-down">
          <div className="flex flex-col items-center gap-3 py-4 text-foreground">
            {isLanding && (
              <>
                <button onClick={() => scrollToSection("problemas")} className="hover:text-primary transition-colors">Problemas</button>
                <button onClick={() => scrollToSection("solucion")} className="hover:text-primary transition-colors">Solución</button>
                <button onClick={() => scrollToSection("como-funciona")} className="hover:text-primary transition-colors">Cómo Funciona</button>
                <button onClick={() => scrollToSection("precios")} className="hover:text-primary transition-colors">Precios</button>
                <button onClick={() => scrollToSection("publico-objetivo")} className="hover:text-primary transition-colors">Público Objetivo</button>
                <RouterLink to="/opinar" onClick={() => setMenuOpen(false)} className="hover:text-primary transition-colors">Próximamente</RouterLink>
                <button onClick={() => scrollToSection("cta")} className="hover:text-primary transition-colors">Empezar</button>
              </>
            )}

            {isLoggedIn ? (
              <>
                <RouterLink to="/perfil" onClick={() => setMenuOpen(false)} className="hover:text-primary transition-colors">Mi Perfil</RouterLink>
                <RouterLink to="/chat" onClick={() => setMenuOpen(false)} className="hover:text-primary transition-colors">Chat</RouterLink>
                {adminLinks.length > 0 && (
                  <div className="w-full space-y-2 border-t border-border/40 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Panel admin</p>
                    <div className="flex flex-col gap-2">
                      {adminLinks.map(({ to, label, icon: Icon }) => (
                        <RouterLink
                          key={to}
                          to={to}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </RouterLink>
                      ))}
                    </div>
                  </div>
                )}
                <RouterLink to="/" onClick={() => { safeLocalStorage.removeItem("user"); setMenuOpen(false); }} className="text-red-500">
                  Cerrar sesión
                </RouterLink>
              </>
            ) : (
              <>
                <RouterLink to="/login" onClick={() => setMenuOpen(false)} className="hover:text-primary transition-colors">Iniciar Sesión</RouterLink>
                <RouterLink to="/demo" onClick={() => setMenuOpen(false)} className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors">
                  Prueba Gratuita
                </RouterLink>
              </>
            )}
            <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-accent text-foreground transition-colors">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
