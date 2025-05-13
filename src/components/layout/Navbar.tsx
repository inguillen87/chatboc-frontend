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
          <span className="text-xl font-bold text-blue-600">Chatboc</span>

          <div className="hidden md:flex items-center space-x-6">
            <a href="#problems" className="text-sm text-gray-600 hover:text-blue-600">Problemas</a>
            <a href="#solution" className="text-sm text-gray-600 hover:text-blue-600">Solución</a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-blue-600">Cómo Funciona</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-blue-600">Precios</a>
            <Button variant="outline" onClick={() => navigate("/login")}>
              Iniciar Sesión
            </Button>
            <Button onClick={() => navigate("/demo")}>
              Prueba Gratuita
            </Button>
          </div>

          <div className="md:hidden">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-600 hover:text-blue-600">
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-sm">
          <div className="px-4 py-4 space-y-3">
            <a href="#problems" className="block text-sm text-gray-700" onClick={() => setMobileMenuOpen(false)}>Problemas</a>
            <a href="#solution" className="block text-sm text-gray-700" onClick={() => setMobileMenuOpen(false)}>Solución</a>
            <a href="#how-it-works" className="block text-sm text-gray-700" onClick={() => setMobileMenuOpen(false)}>Cómo Funciona</a>
            <a href="#pricing" className="block text-sm text-gray-700" onClick={() => setMobileMenuOpen(false)}>Precios</a>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/login');
              }}
            >
              Iniciar Sesión
            </Button>
            <Button
              className="w-full"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/demo');
              }}
            >
              Prueba Gratuita
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
