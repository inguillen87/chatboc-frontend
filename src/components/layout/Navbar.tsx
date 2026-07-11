// src/components/layout/Navbar.tsx

import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  ClipboardList,
  Database,
  Layout,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  ScrollText,
  ShoppingCart,
  Sun,
  Tag,
  Ticket as TicketIcon,
  User,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ChatbocBrandLockup from "@/components/brand/ChatbocBrandLockup";
import { useClerkRuntime } from "@/components/auth/ClerkRuntimeContext";
import IdentityAvatar from "@/components/identity/IdentityAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FEATURE_ENCUESTAS } from "@/config/featureFlags";
import { useCapabilities } from "@/context/CapabilitiesContext";
import { useTenant } from "@/context/TenantContext";
import useCartCount from "@/hooks/useCartCount";
import { useLandingExperience } from "@/hooks/useLandingExperience";
import { useUser } from "@/hooks/useUser";
import { hasRequiredRole, isBackofficeRole } from "@/utils/roles";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { getValidStoredToken } from "@/utils/authTokens";
import { buildTenantPath } from "@/utils/tenantPaths";
import { TICKET_DESK_PATH } from "@/utils/backofficeRoutes";
import { resolveConsentedAvatar } from "@/utils/avatarConsent";
import { ORDER_READ_CAPABILITIES, TICKET_READ_CAPABILITIES } from "@/utils/moduleCapabilities";
import { logoutChatbocSession } from "@/utils/sessionLogout";

interface AdminNavLink {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  requiredAnyCapabilities?: string[];
}

const landingNavItems = [
  { id: "problemas", label: "Problemas" },
  { id: "solucion", label: "Solución" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "precios", label: "Precios" },
  { id: "publico-objetivo", label: "Sectores" },
  { id: "cta", label: "Empezar" },
];

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readLandingNavItems = (navigation: unknown) => {
  const rawItems = (() => {
    if (Array.isArray(navigation)) return navigation;
    if (isRecord(navigation)) {
      if (Array.isArray(navigation.items)) return navigation.items;
      if (Array.isArray(navigation.links)) return navigation.links;
    }
    return [];
  })();

  const items = rawItems
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = String(item.label || item.title || item.name || "").trim();
      const target = String(item.id || item.section_id || item.href || item.to || item.route || "").trim();
      if (!label || !target) return null;
      const id = target.replace(/^\/?#/, "").replace(/^\/+/, "");
      return { id, label };
    })
    .filter((item): item is (typeof landingNavItems)[number] => Boolean(item))
    .filter((item) => item.id.toLowerCase() !== "opinar" && item.label.toLowerCase() !== "opinar");

  return items.length ? items : landingNavItems;
};

const parseStoredUser = (raw: string | null) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();
  const { user } = useUser();
  const cartCount = useCartCount();
  const clerkRuntime = useClerkRuntime();
  const { currentSlug } = useTenant();
  const { capabilities, hasAnyCapability } = useCapabilities();

  const isLanding = location.pathname === "/";
  const { experience: landingExperience } = useLandingExperience({ enabled: isLanding });
  const hasValidStoredToken = Boolean(getValidStoredToken("authToken") || getValidStoredToken("chatAuthToken"));
  const isLoggedIn = Boolean(user || (hasValidStoredToken && safeLocalStorage.getItem("user")));
  const cartPath = useMemo(() => buildTenantPath("/cart", currentSlug), [currentSlug]);
  const resolvedLandingNavItems = useMemo(
    () => readLandingNavItems(landingExperience?.navigation),
    [landingExperience],
  );
  const storedUserRaw = useMemo(
    () => (isLoggedIn ? safeLocalStorage.getItem("user") : null),
    [isLoggedIn],
  );
  const storedUser = useMemo(() => parseStoredUser(storedUserRaw), [storedUserRaw]);
  const effectiveUser = user ?? storedUser;

  const userRole = typeof effectiveUser?.rol === "string" ? effectiveUser.rol : undefined;
  const isAdminLike = useMemo(() => isBackofficeRole(userRole), [userRole]);
  const isTenantOwnerLike = useMemo(() => hasRequiredRole(userRole, ["tenant_admin", "superadmin"]), [userRole]);
  const isMunicipal = effectiveUser?.tipo_chat === "municipio";
  const analyticsPath = isMunicipal ? "/estadisticas" : "/analytics";
  const liveChatPath = isAdminLike ? `${TICKET_DESK_PATH}&focus=live_chat` : "/chat";
  const userDisplayName =
    String(effectiveUser?.nombre || effectiveUser?.name || effectiveUser?.nombre_empresa || effectiveUser?.email || "").trim() ||
    "Mi cuenta";
  const userAvatar = resolveConsentedAvatar(effectiveUser as Record<string, unknown> | null | undefined);

  const adminLinks = useMemo(() => {
    if (!isAdminLike) {
      return [] as AdminNavLink[];
    }

    const links: AdminNavLink[] = [
      {
        to: TICKET_DESK_PATH,
        label: isMunicipal ? "Reclamos" : "Tickets",
        icon: TicketIcon,
        roles: ["tenant_admin", "employee", "superadmin"],
        requiredAnyCapabilities: TICKET_READ_CAPABILITIES,
      },
      {
        to: "/pedidos",
        label: "Pedidos",
        icon: ClipboardList,
        requiredAnyCapabilities: ORDER_READ_CAPABILITIES,
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
    });

    links.push({ to: buildTenantPath("/", currentSlug), label: "Ver sitio publico", icon: Layout });

    const hasBackendCapabilities = capabilities.length > 0;

    return links.filter((link) => {
      if (link.roles?.length && !hasRequiredRole(userRole, link.roles)) {
        return false;
      }

      if (!hasBackendCapabilities || !link.requiredAnyCapabilities?.length || isTenantOwnerLike) {
        return true;
      }

      return hasAnyCapability(link.requiredAnyCapabilities);
    });
  }, [analyticsPath, capabilities, currentSlug, hasAnyCapability, isAdminLike, isMunicipal, isTenantOwnerLike, userRole]);

  useEffect(() => {
    const currentTheme = safeLocalStorage.getItem("theme");
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
      return;
    }

    document.documentElement.classList.remove("dark");
    setIsDark(false);
  }, []);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    const currentlyDark = html.classList.contains("dark");

    if (currentlyDark) {
      html.classList.remove("dark");
      safeLocalStorage.setItem("theme", "light");
      setIsDark(false);
      return;
    }

    html.classList.add("dark");
    safeLocalStorage.setItem("theme", "dark");
    setIsDark(true);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el && isLanding) {
      el.scrollIntoView({ behavior: "smooth" });
      setMenuOpen(false);
      return;
    }
    window.location.href = `/#${id}`;
  };

  const handleLogoClick = () => {
    if (isLanding) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.location.href = "/";
    }
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logoutChatbocSession({ clerkEnabled: clerkRuntime.enabled });
    window.location.href = "/";
  };

  const navButtonClass =
    "rounded-[8px] px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-primary/5 hover:text-primary";
  const mobileItemClass =
    "w-full rounded-[8px] px-3 py-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-primary/5 hover:text-primary";

  return (
    <header className="chatboc-brand-navbar fixed left-0 right-0 top-0 z-50 border-b border-border/70 px-4 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <button
          onClick={handleLogoClick}
          className="group flex items-center rounded-[8px] px-1 py-1 transition-colors hover:bg-primary/5"
          aria-label="Ir al inicio de Chatboc"
        >
          <ChatbocBrandLockup
            size="nav"
            tone={isDark ? "dark" : "light"}
            className="transition-transform duration-300 group-hover:translate-y-[-1px] group-hover:scale-[1.01]"
          />
        </button>

        {isLanding ? (
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {resolvedLandingNavItems.map((item) => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className={navButtonClass}>
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="hidden items-center gap-3 md:flex">
          <RouterLink
            to={cartPath}
            className="relative inline-flex items-center rounded-[8px] border border-border/70 bg-card/80 px-3 py-1.5 text-sm shadow-sm transition-colors hover:border-primary/50 hover:text-primary"
            aria-label="Ver carrito"
          >
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 ? (
              <span className="ml-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-2 text-xs text-primary-foreground">
                {cartCount}
              </span>
            ) : null}
          </RouterLink>

          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 rounded-[8px] border border-border/70 bg-card/80 px-3 py-1.5 text-sm shadow-sm transition-colors hover:bg-accent"
                >
                  <IdentityAvatar
                    name={userDisplayName}
                    avatarUrl={userAvatar.avatarUrl}
                    source={userAvatar.source || "iniciales"}
                    consented={userAvatar.consented}
                    size="sm"
                  />
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
                  <RouterLink to={liveChatPath} className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4" />
                    Chat en vivo
                  </RouterLink>
                </DropdownMenuItem>
                {adminLinks.length > 0 ? (
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
                ) : null}
                {FEATURE_ENCUESTAS ? (
                  <DropdownMenuItem asChild>
                    <RouterLink to="/admin/encuestas" className="flex items-center gap-2 text-sm">
                      <BarChart3 className="h-4 w-4" />
                      Panel de encuestas
                    </RouterLink>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem className="flex items-center gap-2 text-destructive focus:text-destructive" onSelect={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <RouterLink to="/login" className="chatboc-cta-secondary rounded-[8px] px-3 py-1.5 text-sm font-semibold">
                Iniciar sesión
              </RouterLink>
              <RouterLink to="/demo" className="chatboc-cta-primary rounded-[8px] px-3 py-1.5 text-sm font-semibold">
                Prueba gratuita
              </RouterLink>
            </>
          )}

          <button
            onClick={toggleDarkMode}
            title="Modo claro / oscuro"
            aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
            className="rounded-full p-2 text-foreground transition-colors hover:bg-accent"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        <button
          className="rounded-[8px] p-2 text-foreground transition-colors hover:bg-accent md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {menuOpen ? (
        <div className="mx-auto mt-2 max-w-7xl rounded-[8px] border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur md:hidden">
          <div className="flex flex-col gap-1 text-foreground">
            {isLanding
              ? resolvedLandingNavItems.map((item) => (
                  <button key={item.id} onClick={() => scrollToSection(item.id)} className={mobileItemClass}>
                    {item.label}
                  </button>
                ))
              : null}
            <RouterLink to={cartPath} onClick={() => setMenuOpen(false)} className={`${mobileItemClass} flex items-center gap-2`}>
              <ShoppingCart className="h-4 w-4" />
              Carrito
              {cartCount > 0 ? (
                <span className="ml-auto inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-2 text-xs text-primary-foreground">
                  {cartCount}
                </span>
              ) : null}
            </RouterLink>

            {isLoggedIn ? (
              <>
                <RouterLink to="/perfil" onClick={() => setMenuOpen(false)} className={mobileItemClass}>
                  Mi perfil
                </RouterLink>
                <RouterLink to={liveChatPath} onClick={() => setMenuOpen(false)} className={mobileItemClass}>
                  Chat
                </RouterLink>
                {adminLinks.length > 0 || FEATURE_ENCUESTAS ? (
                  <div className="mt-2 space-y-2 border-t border-border/60 pt-3">
                    <p className="px-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground/80">Panel admin</p>
                    <div className="flex flex-col gap-1">
                      {adminLinks.map(({ to, label, icon: Icon }) => (
                        <RouterLink
                          key={to}
                          to={to}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 rounded-[8px] border border-border/70 px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:text-primary"
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </RouterLink>
                      ))}
                      {FEATURE_ENCUESTAS ? (
                        <RouterLink
                          to="/admin/encuestas"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 rounded-[8px] border border-border/70 px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:text-primary"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Panel de encuestas
                        </RouterLink>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <button onClick={handleLogout} className={`${mobileItemClass} text-destructive hover:text-destructive`}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <RouterLink to="/login" onClick={() => setMenuOpen(false)} className={mobileItemClass}>
                  Iniciar sesión
                </RouterLink>
                <RouterLink
                  to="/demo"
                  onClick={() => setMenuOpen(false)}
                  className="chatboc-cta-primary mt-1 rounded-[8px] px-4 py-2 text-center text-sm font-semibold"
                >
                  Prueba gratuita
                </RouterLink>
              </>
            )}

            <button onClick={toggleDarkMode} className="mt-1 rounded-[8px] p-2 text-foreground transition-colors hover:bg-accent">
              {isDark ? <Sun className="mx-auto h-5 w-5" /> : <Moon className="mx-auto h-5 w-5" />}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Navbar;
