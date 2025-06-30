// src/App.tsx

import React from "react"; // Un solo import de React
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
// useLocation no se usa directamente aquí, se usa en AppRoutesContent a través de React.useContext
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";

// Layouts y Páginas
import AppShell from "@/components/layout/AppShell"; // Aseguramos el uso del alias @
import NotFound from "./pages/NotFound";
import ChatWidget from "@/components/chat/ChatWidget";
import routes from "./routesConfig";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DateSettingsProvider } from "./hooks/useDateSettings";
import { UserProvider } from "./hooks/useUser";
import useTicketUpdates from "./hooks/useTicketUpdates";
// useIsMobile y useUser ahora se usan dentro de AppShell y sus componentes hijos (Navbars)

const queryClient = new QueryClient();
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
if (!GOOGLE_CLIENT_ID) {
  console.warn(
    'VITE_GOOGLE_CLIENT_ID is missing. Google OAuth login will fail until this variable is set. See README.md for setup instructions.'
  );
}

// Componente para manejar las rutas y el ChatWidget global
function AppRoutesContent() {
  useTicketUpdates(); // Hook para actualizaciones de tickets

  // Rutas donde el ChatWidget global no debería aparecer
  const rutasSinWidgetGlobal = [
    '/',
    "/iframe",
    "/login",
    "/register",
    "/user/login",
    "/user/register",
    "/cuenta",
    '/chat',
    "/integracion",
    "/demo"
  ];

  const location = React.useContext(BrowserRouter).navigator.location; // Acceso a location

  const ocultarWidgetGlobalEnApp = rutasSinWidgetGlobal.some(
    (ruta) =>
      location.pathname === ruta || location.pathname.startsWith(ruta + "/")
  );

  // El hook useIsMobile se usará dentro de AppShell para decidir el Navbar,
  // aquí solo necesitamos saber si NO es móvil para mostrar el widget global.
  // Esta lógica podría simplificarse o moverse si AppShell gestiona el widget.
  const [isDesktopForWidget, setIsDesktopForWidget] = React.useState(window.innerWidth >= 768);
  React.useEffect(() => {
    const checkDesktop = () => setIsDesktopForWidget(window.innerWidth >= 768);
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);


  return (
    <>
      <Outlet /> {/* Las rutas anidadas bajo AppShell se renderizarán aquí */}
      {!ocultarWidgetGlobalEnApp && isDesktopForWidget && (
        <ChatWidget mode="standalone" defaultOpen={false} />
      )}
    </>
  );
}


const App = () => (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <DateSettingsProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell><AppRoutesContent /></AppShell>}>
                  {/* Todas las rutas de la aplicación ahora son hijas de AppShell */}
                  {routes.map(({ path, element, roles }) => (
                    <Route
                      key={path}
                      path={path}
                      element={roles ? (
                        <ProtectedRoute roles={roles}>{element}</ProtectedRoute>
                      ) : (
                        element
                      )}
                    />
                  ))}
                  {/* La ruta NotFound también debe estar bajo AppShell si queremos que tenga el mismo layout */}
                  <Route path="*" element={<NotFound />} />
                </Route>
                {/* Podríamos tener rutas fuera de AppShell si es necesario, ej. una página de mantenimiento */}
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </DateSettingsProvider>
      </UserProvider>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;
