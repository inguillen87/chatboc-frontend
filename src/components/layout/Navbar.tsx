import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <span className="text-xl font-bold text-blue-600">Chatboc</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <a href="#problems" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition">
              Problemas
            </a>
            <a href="#solution" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition">
              Solución
            </a>
            <a href="#how-it-works" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition">
              Cómo Funciona
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition">
              Precios
            </a>
            <Button variant="outline" onClick={() => navigate("/login")}>
              Iniciar Sesión
            </Button>
            <Button onClick={() => navigate("/demo")}>
              Prueba Gratuita
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-sm">
          <div className="px-4 py-4 space-y-3">
            <a href="#problems" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-gray-700 hover:text-blue-600">
              Problemas
            </a>
            <a href="#solution" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-gray-700 hover:text-blue-600">
              Solución
            </a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-gray-700 hover:text-blue-600">
              Cómo Funciona
            </a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-gray-700 hover:text-blue-600">
              Precios
            </a>
            <div className="pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                className="w-full mb-2"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate("/login");
                }}
              >
                Iniciar Sesión
              </Button>
              <Button
                className="w-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate("/demo");
                }}
              >
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
