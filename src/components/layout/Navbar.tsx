import React, { useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Menu, X, Moon, Sun } from "lucide-react";

const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();

  const isLanding = location.pathname === "/";
  const isLoggedIn = !!localStorage.getItem("user");

  useEffect(() => {
    const currentTheme = localStorage.theme;
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.removeItem("theme"); // Asegurar que no hay preferencia de tema si no es dark
      setIsDark(false);
    }
  }, []);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    const currentlyDark = html.classList.contains("dark");

    if (currentlyDark) {
      html.classList.remove("dark");
      localStorage.theme = "light";
      setIsDark(false);
    } else {
      html.classList.add("dark");
      localStorage.theme = "dark";
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-card dark:bg-background shadow-sm transition-all px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <button onClick={handleLogoClick} className="flex items-center gap-2">
          <img src="/chatboc_widget_64x64.webp" alt="Chatboc" className="h-9 w-9" />
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-cyan-400 text-transparent bg-clip-text">
            Chatboc
          </span>
        </button>

        {/* Links centrales - solo landing - desktop */}
       {isLanding && (
          <nav className="hidden lg:flex gap-6 items-center flex-1 justify-center text-foreground">
            <button onClick={() => scrollToSection("problemas")} className="hover:text-primary text-sm">Problemas</button>
            <button onClick={() => scrollToSection("solucion")} className="hover:text-primary text-sm">Solución</button>
            <button onClick={() => scrollToSection("como-funciona")} className="hover:text-primary text-sm">Cómo Funciona</button>
            <button onClick={() => scrollToSection("precios")} className="hover:text-primary text-sm">Precios</button>
            <button onClick={() => scrollToSection("publico-objetivo")} className="hover:text-primary text-sm">Público Objetivo</button>
            <button onClick={() => scrollToSection("proximamente")} className="hover:text-primary text-sm">Próximamente</button>
            <button onClick={() => scrollToSection("cta")} className="hover:text-primary text-sm">Empezar</button>
          </nav>
        )}

        {/* Botones lado derecho */}
        <div className="hidden lg:flex gap-3 items-center">
          {isLoggedIn ? (
            <>
              <RouterLink to="/perfil" className="text-sm text-muted-foreground hover:underline hover:text-foreground">Mi perfil</RouterLink>
              <RouterLink to="/chat" className="text-sm text-muted-foreground hover:underline hover:text-foreground">Chat</RouterLink>
              <RouterLink to="/" onClick={() => localStorage.removeItem("user")} className="text-sm text-destructive hover:underline">Cerrar sesión</RouterLink>
            </>
          ) : (
            <>
              <RouterLink to="/login" className="px-3 py-1 border border-primary text-primary rounded hover:bg-primary/10 text-sm">Iniciar Sesión</RouterLink>
              <RouterLink to="/demo" className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm">Prueba Gratuita</RouterLink>
            </>
          )}
          <button
            onClick={toggleDarkMode}
            title="Modo claro / oscuro"
            className="p-2 rounded hover:bg-accent dark:hover:bg-accent transition" // COMENTARIO ELIMINADO
          >
            {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-primary" />}
          </button>
        </div>

        {/* Botón menú mobile */}
        <button className="lg:hidden p-2 text-foreground" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Menú Mobile desplegable */}
      {menuOpen && (
        <div className="lg:hidden bg-card dark:bg-background shadow-md mt-2 rounded-b-xl animate-fade-in-down text-foreground">
          <div className="flex flex-col items-center gap-3 py-4">
            {isLanding && (
            <>
            <button onClick={() => scrollToSection("problemas")} className="text-foreground hover:text-primary">Problemas</button>
            <button onClick={() => scrollToSection("solucion")} className="text-foreground hover:text-primary">Solución</button>
            <button onClick={() => scrollToSection("como-funciona")} className="text-foreground hover:text-primary">Cómo Funciona</button>
            <button onClick={() => scrollToSection("precios")} className="text-foreground hover:text-primary">Precios</button>
            <button onClick={() => scrollToSection("publico-objetivo")} className="text-foreground hover:text-primary">Público Objetivo</button>
            <button onClick={() => scrollToSection("proximamente")} className="text-foreground hover:text-primary">Próximamente</button>
            <button onClick={() => scrollToSection("cta")} className="text-foreground hover:text-primary">Empezar</button>
            </>
          )}

            {isLoggedIn ? (
            <>
              <RouterLink to="/perfil" onClick={() => setMenuOpen(false)} className="text-foreground hover:text-primary">Mi Perfil</RouterLink>
              <RouterLink to="/chat" onClick={() => setMenuOpen(false)} className="text-foreground hover:text-primary">Chat</RouterLink>
              <RouterLink to="/" onClick={() => { localStorage.removeItem("user"); setMenuOpen(false); }} className="text-destructive hover:text-destructive/80">
                Cerrar sesión
              </RouterLink>
            </>
          ) : (
            <>
              <RouterLink to="/login" onClick={() => setMenuOpen(false)} className="text-foreground hover:text-primary">Iniciar Sesión</RouterLink>
              <RouterLink to="/demo" onClick={() => setMenuOpen(false)} className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90">
                Prueba Gratuita
              </RouterLink>
            </>
          )}
            <button onClick={toggleDarkMode} className="p-2 rounded hover:bg-accent transition">
              {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-primary" />}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;