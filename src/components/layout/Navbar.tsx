import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Menu, X } from "lucide-react";

const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setMenuOpen(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo + scroll up */}
        <button
          onClick={() => {
            const hero = document.querySelector("main");
            if (hero) {
              hero.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className="flex items-center gap-3 focus:outline-none"
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
          <button onClick={() => scrollToSection("problemas")} className="hover:text-blue-600 text-sm">Problemas</button>
          <button onClick={() => scrollToSection("solucion")} className="hover:text-blue-600 text-sm">Solución</button>
          <button onClick={() => scrollToSection("como-funciona")} className="hover:text-blue-600 text-sm">Cómo Funciona</button>
          <button onClick={() => scrollToSection("precios")} className="hover:text-blue-600 text-sm">Precios</button>
        </nav>

        {/* Botones de sesión */}
        <div className="hidden lg:flex gap-3 items-center">
          <RouterLink to="/login" className="px-3 py-1 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 text-sm">
            Iniciar Sesión
          </RouterLink>
            <RouterLink to="/demo" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
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
        <div className="lg:hidden flex flex-col items-center gap-4 py-4 bg-white shadow-md">
          <button onClick={() => scrollToSection("problemas")}>Problemas</button>
          <button onClick={() => scrollToSection("solucion")}>Solución</button>
          <button onClick={() => scrollToSection("como-funciona")}>Cómo Funciona</button>
          <button onClick={() => scrollToSection("precios")}>Precios</button>
          <RouterLink to="/login">Iniciar Sesión</RouterLink>
          <RouterLink to="/register" className="bg-blue-600 text-white px-4 py-2 rounded">Prueba Gratuita</RouterLink>
        </div>
      )}
    </header>
  );
};

export default Navbar;