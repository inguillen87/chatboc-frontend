import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import DarkModeToggle from "@/components/ui/DarkModeToggle";

const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setMenuOpen(false);
    }
  };

  const handleLogoClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-background text-foreground shadow-sm z-50 px-4 py-2 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo con scroll al top */}
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 focus:outline-none"
        >
          <img
            src="/chatboc_widget_64x64.webp"
            alt="Chatboc"
            className="h-10 w-10"
          />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-cyan-400 text-transparent bg-clip-text">
            Chatboc
          </h1>
        </button>

        {/* Navegación central */}
        <nav className="hidden lg:flex gap-6 items-center flex-1 justify-center">
          <button
            onClick={() => scrollToSection("problemas")}
            className="hover:text-primary text-sm transition-colors"
          >
            Problemas
          </button>
          <button
            onClick={() => scrollToSection("solucion")}
            className="hover:text-primary text-sm transition-colors"
          >
            Solución
          </button>
          <button
            onClick={() => scrollToSection("como-funciona")}
            className="hover:text-primary text-sm transition-colors"
          >
            Cómo Funciona
          </button>
          <button
            onClick={() => scrollToSection("precios")}
            className="hover:text-primary text-sm transition-colors"
          >
            Precios
          </button>
        </nav>

        {/* Botones de sesión + toggle */}
        <div className="hidden lg:flex gap-3 items-center">
          <DarkModeToggle />
          <RouterLink
            to="/login"
            className="px-3 py-1 border border-primary text-primary rounded hover:bg-muted text-sm transition-colors"
          >
            Iniciar Sesión
          </RouterLink>
          <RouterLink
            to="/demo"
            className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-blue-700 text-sm transition-colors"
          >
            Prueba Gratuita
          </RouterLink>
        </div>

        {/* Mobile toggle */}
        <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Menú mobile */}
      {menuOpen && (
        <div className="lg:hidden flex flex-col items-center gap-4 py-4 bg-background text-foreground shadow-md transition-colors">
          <button onClick={() => scrollToSection("problemas")}>Problemas</button>
          <button onClick={() => scrollToSection("solucion")}>Solución</button>
          <button onClick={() => scrollToSection("como-funciona")}>
            Cómo Funciona
          </button>
          <button onClick={() => scrollToSection("precios")}>Precios</button>
          <RouterLink to="/login">Iniciar Sesión</RouterLink>
          <RouterLink
            to="/demo"
            className="bg-primary text-primary-foreground px-4 py-2 rounded"
          >
            Prueba Gratuita
          </RouterLink>
        </div>
      )}
    </header>
  );
};

export default Navbar;
