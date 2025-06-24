import React from 'react';

export default function PermissionDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center text-center p-8">
      <div>
        <h1 className="text-3xl font-bold mb-4">Acceso restringido</h1>
        <p>Tu usuario no cuenta con los permisos necesarios para esta sección.</p>
        <p className="mt-2">Contactá al administrador si creés que se trata de un error.</p>
      </div>
    </div>
  );
}
