// src/components/Navbar.tsx
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
    <header className="flex items-center justify-between px-4 py-2 shadow-sm fixed top-0 left-0 right-0 bg-white z-50">
      <RouterLink to="/" className="flex items-center">
        <img
          src="/chatboc_widget_64x64.webp"
          alt="Chatboc"
          className="h-8 w-8 mr-2"
        />
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-gray-600 text-transparent bg-clip-text">Chatboc</h1>
      </RouterLink>

      <nav className="hidden lg:flex gap-6 items-center">
        <button onClick={() => scrollToSection("problemas")} className="hover:text-blue-500">Problemas</button>
        <button onClick={() => scrollToSection("solucion")} className="hover:text-blue-500">Solución</button>
        <button onClick={() => scrollToSection("como-funciona")} className="hover:text-blue-500">Cómo Funciona</button>
        <button onClick={() => scrollToSection("precios")} className="hover:text-blue-500">Precios</button>
        <RouterLink to="/login" className="text-sm font-medium">Iniciar Sesión</RouterLink>
        <RouterLink to="/register" className="px-3 py-1 bg-blue-600 text-white rounded">Prueba Gratuita</RouterLink>
      </nav>

      <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X /> : <Menu />}
      </button>

      {menuOpen && (
        <div className="absolute top-14 left-0 w-full bg-white shadow-md lg:hidden flex flex-col items-center gap-4 py-4 z-50">
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
