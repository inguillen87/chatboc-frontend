// src/components/layout/Navbar.tsx

import React, { useEffect, useMemo, useState } from "react";
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
  ShoppingCart,
  Tag,
  ScrollText,
  Layout,
  UserCog,
  Database,
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
import useCartCount from "@/hooks/useCartCount";
import { useTenant } from "@/context/TenantContext";
import { buildTenantPath } from "@/utils/tenantPaths";
import { getChatbocBotAvatar } from "@/utils/brandAssets";
import { useCapabilities } from "@/context/CapabilitiesContext";
import { isBackofficeRole } from "@/utils/roles";

interface AdminNavLink {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  requiredAnyCapabilities?: string[];
}

const Navbar: React.FC = () => {
  const NAVBAR_LOGO_LIGHT_PRIMARY =
    "/chatboc_frontend_pack/branding/chatboc/navbar/chatboc-navbar-mark-circle.svg";
  const NAVBAR_LOGO_DARK_PRIMARY =
    "/chatboc_frontend_pack/branding/chatboc/navbar/chatboc-navbar-mark-clean.svg";
  const NAVBAR_LOGO_LIGHT_PNG =
    "/chatboc_frontend_pack/branding/chatboc/navbar/chatboc-navbar-mark-circle_64.png";
  const NAVBAR_LOGO_DARK_PNG =
    "/chatboc_frontend_pack/branding/chatboc/navbar/chatboc-navbar-mark-clean_64.png";
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [navbarLogoSrc, setNavbarLogoSrc] = useState(NAVBAR_LOGO_LIGHT_PRIMARY);
  const location = useLocation();
  const { user } = useUser();
  const cartCount = useCartCount();
  const { currentSlug } = useTenant();
  const { capabilities } = useCapabilities();

  const isLanding = location.pathname === "/";
  const isLoggedIn = !!safeLocalStorage.getItem("user");
  const userRole = user?.rol;
  const isAdminLike = useMemo(() => isBackofficeRole(userRole), [userRole]);
  const isMunicipal = user?.tipo_chat === "municipio";
  const analyticsPath = isMunicipal ? "/estadisticas" : "/analytics";
  const adminLinks = useMemo(() => {
    if (!isAdminLike) {
      return [] as AdminNavLink[];
    }

    const links: AdminNavLink[] = [
      {
        to: "/tickets",
        label: "Tickets",
        icon: TicketIcon,
        requiredAnyCapabilities: ["tickets.read", "crm.tickets.read", "claims.read"],
      },
      {
        to: "/pedidos",
        label: "Pedidos",
        icon: ClipboardList,
        requiredAnyCapabilities: ["orders.read", "market.orders.read", "commerce.orders.read"],
      },
      {
        to: "/usuarios",
        label: "Usuarios",
        icon: Users,
        requiredAnyCapabilities: ["users.read", "tenant.users.read", "internal_users.read"],
      },
      {
        to: "/empleados",
        label: "Empleados",
        icon: UserCog,
        requiredAnyCapabilities: ["employees.read", "tenant.employees.read"],
      },
    ];

    if (isMunicipal) {
      links.push({
        to: "/municipal/categorias",
        label: "Categorías",
        icon: Tag,
        requiredAnyCapabilities: ["categories.manage", "municipal.categories.manage", "catalog.categories.manage"],
      });
    }

    links.push({
      to: analyticsPath,
      label: isMunicipal ? "Estadísticas" : "Analytics",
      icon: BarChart3,
      requiredAnyCapabilities: ["analytics.read", "dashboard.read", "reports.read"],
    });

    links.push({
      to: "/logs",
      label: "Logs",
      icon: ScrollText,
      requiredAnyCapabilities: ["logs.read", "diagnostics.read", "admin.logs.read"],
    });

    links.push({
      to: "/superadmin",
      label: "Super Admin",
      icon: Database,
      roles: ["super_admin", "superadmin"],
      requiredAnyCapabilities: ["superadmin.access", "platform.admin", "tenants.manage"],
    });

    links.push({ to: buildTenantPath("/", currentSlug), label: "Ver Portal", icon: Layout });

    const normalizedUserRole = userRole?.toLowerCase() || "";
    const normalizedCapabilities = capabilities.map((capability) => capability.toLowerCase());
    const hasBackendCapabilities = normalizedCapabilities.length > 0;

    return links.filter((link) => {
      if (link.roles?.length && !link.roles.some((role) => role.toLowerCase() === normalizedUserRole)) {
        return false;
      }

      if (!hasBackendCapabilities || !link.requiredAnyCapabilities?.length) {
        return true;
      }

      return link.requiredAnyCapabilities.some((requiredCapability) =>
        normalizedCapabilities.includes(requiredCapability.toLowerCase()),
      );
    });
  }, [analyticsPath, capabilities, currentSlug, isAdminLike, isMunicipal, userRole]);
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
      setNavbarLogoSrc(NAVBAR_LOGO_DARK_PRIMARY);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
      setNavbarLogoSrc(NAVBAR_LOGO_LIGHT_PRIMARY);
    }
  }, [NAVBAR_LOGO_DARK_PRIMARY, NAVBAR_LOGO_LIGHT_PRIMARY]);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    const currentlyDark = html.classList.contains("dark");

    if (currentlyDark) {
      html.classList.remove("dark");
      safeLocalStorage.setItem("theme", "light");
      setIsDark(false);
      setNavbarLogoSrc(NAVBAR_LOGO_LIGHT_PRIMARY);
    } else {
      html.classList.add("dark");
      safeLocalStorage.setItem("theme", "dark");
      setIsDark(true);
      setNavbarLogoSrc(NAVBAR_LOGO_DARK_PRIMARY);
    }
  };

  const cartPath = useMemo(() => buildTenantPath("/cart", currentSlug), [currentSlug]);

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
        <button
          onClick={handleLogoClick}
          className="group flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-primary/5 transition-colors"
          aria-label="Ir al inicio de Chatboc"
        >
          {/* Asset anterior reemplazado por pack de branding Chatboc 2026-03-26 */}
          <img
            src={navbarLogoSrc}
            alt="Chatboc Bot"
            loading="eager"
            decoding="async"
            className="h-8 w-8 sm:h-[34px] sm:w-[34px] lg:h-9 lg:w-9 object-contain rounded-full ring-1 ring-primary/20 shadow-[0_4px_14px_rgba(15,23,42,0.18)] transition-transform duration-300 group-hover:scale-105"
            onError={() =>
              setNavbarLogoSrc((prev) =>
                prev === (isDark ? NAVBAR_LOGO_DARK_PRIMARY : NAVBAR_LOGO_LIGHT_PRIMARY)
                  ? (isDark ? NAVBAR_LOGO_DARK_PNG : NAVBAR_LOGO_LIGHT_PNG)
                  : getChatbocBotAvatar(isDark),
              )
            }
          />
          <span className="chatboc-brand-gradient text-2xl font-extrabold tracking-tight">
            chatboc.ar
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
          <RouterLink
            to={cartPath}
            className="relative inline-flex items-center rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm shadow-sm transition-colors hover:border-primary hover:text-primary"
            aria-label="Ver carrito"
          >
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="ml-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary text-primary-foreground text-xs px-2">
                {cartCount}
              </span>
            )}
          </RouterLink>
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
              <RouterLink
                to="/login"
                className="chatboc-cta-secondary px-3 py-1 rounded text-sm"
              >
                Iniciar Sesión
              </RouterLink>
              <RouterLink
                to="/demo"
                className="chatboc-cta-primary px-3 py-1 rounded text-sm"
              >
                Prueba Gratuita
              </RouterLink>
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
                <RouterLink to={cartPath} onClick={() => setMenuOpen(false)} className="hover:text-primary transition-colors flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Carrito
                  {cartCount > 0 && (
                    <span className="ml-auto inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary text-primary-foreground text-xs px-2">
                      {cartCount}
                    </span>
                  )}
                </RouterLink>
                <RouterLink to="/perfil" onClick={() => setMenuOpen(false)} className="hover:text-primary transition-colors">Mi Perfil</RouterLink>
                <RouterLink to="/chat" onClick={() => setMenuOpen(false)} className="hover:text-primary transition-colors">Chat</RouterLink>
                {(adminLinks.length > 0 || FEATURE_ENCUESTAS) && (
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
                      {FEATURE_ENCUESTAS ? (
                        <RouterLink
                          to="/admin/encuestas"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Panel de encuestas
                        </RouterLink>
                      ) : null}
                    </div>
                  </div>
                )}
                <RouterLink to="/" onClick={() => { safeLocalStorage.removeItem("user"); setMenuOpen(false); }} className="text-red-500">
                  Cerrar sesión
                </RouterLink>
              </>
            ) : (
              <>
                <RouterLink to={cartPath} onClick={() => setMenuOpen(false)} className="hover:text-primary transition-colors flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Carrito
                  {cartCount > 0 && (
                    <span className="ml-auto inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary text-primary-foreground text-xs px-2">
                      {cartCount}
                    </span>
                  )}
                </RouterLink>
                <RouterLink
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="hover:text-[#0D35C3] dark:hover:text-[#9CC3FF] transition-colors"
                >
                  Iniciar Sesión
                </RouterLink>
                <RouterLink
                  to="/demo"
                  onClick={() => setMenuOpen(false)}
                  className="chatboc-cta-primary px-4 py-2 rounded"
                >
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
