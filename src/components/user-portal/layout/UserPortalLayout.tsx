import React from 'react';

interface UserPortalLayoutProps {
  children: React.ReactNode;
}

const UserPortalLayout: React.FC<UserPortalLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Placeholder para el Navbar Superior del Portal */}
      <header className="bg-background border-b border-border shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div>Logo Org Placeholder</div>
          <div>User Menu Placeholder</div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Placeholder para el Menú Lateral (Desktop) */}
        <aside className="hidden md:block w-64 bg-card border-r border-border p-4">
          <nav>
            <p className="text-muted-foreground text-sm">Side Navigation Placeholder</p>
            <ul>
              {/* Links irán aquí */}
            </ul>
          </nav>
        </aside>

        {/* Contenido Principal */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-light">
          {children}
        </main>
      </div>

      {/* Placeholder para la Barra de Navegación Inferior (Mobile) */}
      <footer className="md:hidden bg-card border-t border-border shadow-t-lg fixed bottom-0 left-0 right-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-around">
          <p className="text-muted-foreground text-sm">Bottom Navigation Placeholder</p>
        </div>
      </footer>
    </div>
  );
};

export default UserPortalLayout;
