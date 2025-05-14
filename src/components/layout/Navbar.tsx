import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem("user") || "null");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const scrollToSection = (id: string) => {
    if (location.pathname === "/") {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(`/#${id}`);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <img
              src="/chatboc_widget_64x64.webp"
              alt="Logo"
              className="w-9 h-9"
            />
            <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent">
              Chatboc
            </span>
          </div>

          {/* Links del medio (centrados) */}
          <div className="hidden md:flex flex-1 justify-center items-center space-x-6">
            <button onClick={() => scrollToSection("problems")} className="text-sm text-gray-600 hover:text-blue-600">Problemas</button>
            <button onClick={() => scrollToSection("solution")} className="text-sm text-gray-600 hover:text-blue-600">Solución</button>
            <button onClick={() => scrollToSection("how-it-works")} className="text-sm text-gray-600 hover:text-blue-600">Cómo Funciona</button>
            <button onClick={() => scrollToSection("pricing")} className="text-sm text-gray-600 hover:text-blue-600">Precios</button>
          </div>

          {/* Botones derecha (desktop) */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="outline" onClick={() => navigate("/login")}>Iniciar Sesión</Button>
            <Button onClick={() => navigate("/demo")}>Prueba Gratuita</Button>
          </div>

          {/* Botón mobile */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-600 hover:text-blue-600"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menú mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-sm">
          <div className="px-4 py-4 space-y-3">
            <button className="block w-full text-left text-sm text-gray-700" onClick={() => scrollToSection("problems")}>Problemas</button>
            <button className="block w-full text-left text-sm text-gray-700" onClick={() => scrollToSection("solution")}>Solución</button>
            <button className="block w-full text-left text-sm text-gray-700" onClick={() => scrollToSection("how-it-works")}>Cómo Funciona</button>
            <button className="block w-full text-left text-sm text-gray-700" onClick={() => scrollToSection("pricing")}>Precios</button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>Iniciar Sesión</Button>
            <Button className="w-full" onClick={() => navigate("/register")}>Registrarse</Button>
            <Button className="w-full" onClick={() => navigate("/demo")}>Prueba Gratuita</Button>
          </div>
        </div>
      )}

      {/* Botón especial si está logueado */}
      {user && user.plan && (
        <div className="fixed bottom-5 right-5 md:top-4 md:right-4 md:bottom-auto z-50">
          <Button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full shadow-md">
            {user.plan === "free" ? "Versión Gratuita" : "Versión Premium"}
          </Button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
