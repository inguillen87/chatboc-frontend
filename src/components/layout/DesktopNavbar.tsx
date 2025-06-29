import React, { useEffect, useState } from "react";
import ChatbocLogoAnimated from "../chat/ChatbocLogoAnimated";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Moon, Sun, LogOut } from "lucide-react"; // Importado LogOut
import { useUser } from "@/hooks/useUser"; // Hook para usuario
import { useIsMobile } from "@/hooks/use-mobile"; // Hook para detectar móvil
import { Button } from "@/components/ui/button"; // Usar nuestro Button personalizado

const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false); // Para el menú desplegable en landing page móvil (si se mantiene)
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { user, logout } = useUser(); // Usamos el hook useUser
  const isMobile = useIsMobile();   // Usamos el hook useIsMobile

  const isLanding = location.pathname === "/";
  // isLoggedIn se basa ahora en el estado del hook useUser
  const isLoggedIn = !!user;

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
    setMenuOpen(false); // Cerrar menú al hacer click
    const el = document.getElementById(id);
    if (el && isLanding) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      // Si no estamos en landing, guardamos la sección y redirigimos
      safeLocalStorage.setItem("pendingScrollSection", id);
      navigate("/");
    }
  };

  const handleLogoClick = () => {
    setMenuOpen(false); // Cerrar menú al hacer click
    if (isLanding) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/");
    }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/login"); // O a la landing page
  };

  // Si es móvil y el usuario está logueado, MobileNavbar se encarga de la navegación.
  // Este Navbar de escritorio solo se debe mostrar si NO es móvil, o si es móvil PERO el usuario NO está logueado (ej. en landing, login, register).
  if (isMobile && isLoggedIn) {
    return null; // No renderizar este Navbar si MobileNavbar está activo.
  }

  return (
    // El 'md:flex' asegura que los links centrales y botones de la derecha solo se vean en desktop.
    // El logo y el botón de menú hamburguesa (si se mantiene para landing móvil) se verán siempre o condicionalmente.
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md shadow-sm transition-all px-4 py-2.5">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between h-12">
        {/* Logo */}
        <button onClick={handleLogoClick} className="flex items-center gap-2 focus:outline-none">
          <ChatbocLogoAnimated size={32} />
          <span className="text-2xl font-bold bg-gradient-to-r from-primary via-blue-600 to-secondary text-transparent bg-clip-text">
            Chatboc
          </span>
        </button>

        {/* Links centrales - solo landing - desktop */}
        {isLanding && (
          <nav className="hidden md:flex gap-x-5 items-center flex-1 justify-center">
            {(["problemas", "solucion", "como-funciona", "precios", "publico-objetivo", "proximamente", "cta"] as const).map((id) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " ")}
              </button>
            ))}
          </nav>
        )}

        {/* Botones lado derecho (Desktop) y Menú Hamburguesa (Móvil no logueado en Landing) */}
        <div className="flex items-center gap-2">
          {/* Botones para Desktop */}
          <div className="hidden md:flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <RouterLink to="/perfil">Mi Perfil</RouterLink>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <RouterLink to="/chat">Chat</RouterLink>
                </Button>
                <Button variant="destructive" size="sm" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <RouterLink to="/login">Iniciar Sesión</RouterLink>
                </Button>
                <Button variant="default" size="sm" asChild>
                  <RouterLink to="/demo">Prueba Gratuita</RouterLink>
                </Button>
              </>
            )}
          </div>

          {/* Dark Mode Toggle - visible en todas las vistas de este Navbar */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            title="Modo claro / oscuro"
            className="text-muted-foreground hover:text-foreground"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Botón menú hamburguesa para móvil en Landing Page (si no está logueado) */}
          {isMobile && isLanding && !isLoggedIn && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Abrir menú de navegación"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Menú Mobile desplegable para Landing Page (si no está logueado) */}
      {isMobile && isLanding && !isLoggedIn && menuOpen && (
        <div className="md:hidden bg-card shadow-lg mt-2 rounded-lg border animate-accordion-down overflow-hidden">
          <nav className="flex flex-col py-3">
            {(["problemas", "solucion", "como-funciona", "precios", "publico-objetivo", "proximamente", "cta"] as const).map((id) => (
                <button
                  key={id}
                  onClick={() => scrollToSection(id)}
                  className="px-4 py-2.5 text-sm text-left text-foreground hover:bg-accent transition-colors w-full"
                >
                  {id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " ")}
                </button>
              ))}
            <div className="border-t my-2"></div>
            <div className="px-4 py-2 flex flex-col gap-2">
              <Button variant="outline" className="w-full" asChild onClick={() => setMenuOpen(false)}>
                <RouterLink to="/login">Iniciar Sesión</RouterLink>
              </Button>
              <Button variant="default" className="w-full" asChild onClick={() => setMenuOpen(false)}>
                <RouterLink to="/demo">Prueba Gratuita</RouterLink>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
