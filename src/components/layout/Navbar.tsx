import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* 🔵 LOGO Chatboc */}
          <div
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => navigate("/")}>
            <img
              src="/chatboc_navbar_logo.webp"
              alt="Chatboc"
              className="h-10 w-auto"
            />
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-6">
            <button onClick={() => navigate("/#problems")} className="text-sm text-gray-600 hover:text-blue-600">Problemas</button>
            <button onClick={() => navigate("/#solution")} className="text-sm text-gray-600 hover:text-blue-600">Solución</button>
            <button onClick={() => navigate("/#how-it-works")} className="text-sm text-gray-600 hover:text-blue-600">Cómo Funciona</button>
            <button onClick={() => navigate("/#pricing")} className="text-sm text-gray-600 hover:text-blue-600">Precios</button>
            <Button variant="outline" onClick={() => navigate("/login")}>
              Iniciar Sesión
            </Button>
            <Button onClick={() => navigate("/demo")}>
              Prueba Gratuita
            </Button>
          </div>

          {/* Botón hamburguesa (solo mobile) */}
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
            <button className="block w-full text-left text-sm text-gray-700" onClick={() => navigate("/#problems")}>Problemas</button>
            <button className="block w-full text-left text-sm text-gray-700" onClick={() => navigate("/#solution")}>Solución</button>
            <button className="block w-full text-left text-sm text-gray-700" onClick={() => navigate("/#how-it-works")}>Cómo Funciona</button>
            <button className="block w-full text-left text-sm text-gray-700" onClick={() => navigate("/#pricing")}>Precios</button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>Iniciar Sesión</Button>
            <Button className="w-full" onClick={() => navigate("/demo")}>Prueba Gratuita</Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
