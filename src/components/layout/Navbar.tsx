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
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setMenuOpen(false);
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 shadow-sm transition-all px-4 py-2">
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
          <nav className="hidden lg:flex gap-6 items-center flex-1 justify-center">
            <button onClick={() => scrollToSection("problemas")} className="hover:text-blue-600 text-sm dark:text-white">
              Problemas
            </button>
            <button onClick={() => scrollToSection("solucion")} className="hover:text-blue-600 text-sm dark:text-white">
              Solución
            </button>
            <button onClick={() => scrollToSection("como-funciona")} className="hover:text-blue-600 text-sm dark:text-white">
              Cómo Funciona
            </button>
            <button onClick={() => scrollToSection("precios")} className="hover:text-blue-600 text-sm dark:text-white">
              Precios
            </button>
          </nav>
        )}

        {/* Botones lado derecho */}
        <div className="hidden lg:flex gap-3 items-center">
          {isLoggedIn ? (
            <>
              <RouterLink to="/perfil" className="text-sm text-gray-700 dark:text-white hover:underline">
                Mi perfil
              </RouterLink>
              <RouterLink to="/chat" className="text-sm text-gray-700 dark:text-white hover:underline">
                Chat
              </RouterLink>
              <RouterLink
                to="/"
                onClick={() => localStorage.removeItem("user")}
                className="text-sm text-red-500 hover:underline"
              >
                Cerrar sesión
              </RouterLink>
            </>
          ) : (
            <>
              <RouterLink to="/login" className="px-3 py-1 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 text-sm dark:text-white dark:border-white dark:hover:bg-gray-800">
                Iniciar Sesión
              </RouterLink>
              <RouterLink to="/demo" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                Prueba Gratuita
              </RouterLink>
            </>
          )}
          <button
            onClick={toggleDarkMode}
            title="Modo claro / oscuro"
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-600" />}
          </button>
        </div>

        {/* Botón menú mobile */}
        <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Menú Mobile desplegable */}
      {menuOpen && (
        <div className="lg:hidden bg-white dark:bg-gray-900 shadow-md mt-2 rounded-b-xl animate-fade-in-down">
          <div className="flex flex-col items-center gap-3 py-4">
            {isLanding && (
              <>
                <button onClick={() => scrollToSection("problemas")}>Problemas</button>
                <button onClick={() => scrollToSection("solucion")}>Solución</button>
                <button onClick={() => scrollToSection("como-funciona")}>Cómo Funciona</button>
                <button onClick={() => scrollToSection("precios")}>Precios</button>
              </>
            )}
            {isLoggedIn ? (
              <>
                <RouterLink to="/perfil" onClick={() => setMenuOpen(false)}>Mi Perfil</RouterLink>
                <RouterLink to="/chat" onClick={() => setMenuOpen(false)}>Chat</RouterLink>
                <RouterLink to="/" onClick={() => { localStorage.removeItem("user"); setMenuOpen(false); }} className="text-red-500">
                  Cerrar sesión
                </RouterLink>
              </>
            ) : (
              <>
                <RouterLink to="/login" onClick={() => setMenuOpen(false)}>Iniciar Sesión</RouterLink>
                <RouterLink to="/demo" onClick={() => setMenuOpen(false)} className="bg-blue-600 text-white px-4 py-2 rounded">
                  Prueba Gratuita
                </RouterLink>
              </>
            )}
            <button onClick={toggleDarkMode} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition">
              {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-600" />}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
