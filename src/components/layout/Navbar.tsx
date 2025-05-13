import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // ← AGREGADO

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate(); // ← AGREGADO

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <span className="text-xl font-bold text-blue-600">Chatboc</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#problems" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
              Problemas
            </a>
            <a href="#solution" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
              Solución
            </a>
            <a href="#how-it-works" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
              Cómo Funciona
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
              Precios
            </a>
            <Button variant="outline" className="mr-2" onClick={() => navigate("/Login")}>
              Iniciar Sesión
            </Button>
            <Button variant="outline" onClick={() => navigate("/Demo")}>
              Prueba Gratuita
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded="false"
            >
              <span className="sr-only">Abrir menú principal</span>
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-b border-gray-200">
            <a href="#problems" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50" onClick={() => setMobileMenuOpen(false)}>Problemas</a>
            <a href="#solution" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50" onClick={() => setMobileMenuOpen(false)}>Solución</a>
            <a href="#how-it-works" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50" onClick={() => setMobileMenuOpen(false)}>Cómo Funciona</a>
            <a href="#pricing" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50" onClick={() => setMobileMenuOpen(false)}>Precios</a>
            <div className="pt-4 pb-3">
              <Button variant="outline" className="w-full mb-2" onClick={() => { setMobileMenuOpen(false); navigate("/login"); }}>
                Iniciar Sesión
              </Button>
              <Button className="w-full" onClick={() => { setMobileMenuOpen(false); navigate("/demo"); }}>
                Prueba Gratuita
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
