// /src/components/Navbar.tsx
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const isPerfil = location.pathname === "/perfil";
  const showModoReal = user && isPerfil;

  return (
    <header className="flex items-center justify-between px-4 py-2 shadow-sm">
      <Link to="/" className="flex items-center">
        <img src="/logo.svg" alt="Chatboc" className="h-8 mr-2" />
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-gray-600 text-transparent bg-clip-text">Chatboc</h1>
      </Link>

      <nav className="hidden lg:flex gap-6 items-center">
        <Link to="/#problemas" className="hover:text-blue-500">Problemas</Link>
        <Link to="/#solucion" className="hover:text-blue-500">Solución</Link>
        <Link to="/#como-funciona" className="hover:text-blue-500">Cómo Funciona</Link>
        <Link to="/#precios" className="hover:text-blue-500">Precios</Link>
        <Link to="/login" className="text-sm font-medium">Iniciar Sesión</Link>
        <Link to="/register" className="px-3 py-1 bg-blue-600 text-white rounded">Prueba Gratuita</Link>
      </nav>

      <button className="lg:hidden" onClick={toggleMenu}>
        {menuOpen ? <X /> : <Menu />}
      </button>

      {showModoReal && (
        <div className="ml-4 px-3 py-1 bg-green-100 text-green-800 rounded text-xs">
          🟢 MODO REAL · ANÓNIMO
        </div>
      )}

      {menuOpen && (
        <div className="absolute top-14 left-0 w-full bg-white shadow-md lg:hidden flex flex-col items-center gap-4 py-4 z-50">
          <Link to="/#problemas" onClick={toggleMenu}>Problemas</Link>
          <Link to="/#solucion" onClick={toggleMenu}>Solución</Link>
          <Link to="/#como-funciona" onClick={toggleMenu}>Cómo Funciona</Link>
          <Link to="/#precios" onClick={toggleMenu}>Precios</Link>
          <Link to="/login" onClick={toggleMenu}>Iniciar Sesión</Link>
          <Link to="/register" onClick={toggleMenu} className="bg-blue-600 text-white px-4 py-2 rounded">Prueba Gratuita</Link>
        </div>
      )}
    </header>
  );
};

export default Navbar;
