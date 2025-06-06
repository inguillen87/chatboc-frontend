// Contenido para: Perfil.tsx
// ... (imports y la primera parte se mantienen igual) ...

  // --- CORRECCIÓN 1: Unificamos la obtención del token ---
  useEffect(() => {
    const token = localStorage.getItem("authToken"); // Siempre buscar 'authToken'
    if (!token) { 
      // Si no hay token, limpiamos todo y vamos al login
      localStorage.clear();
      window.location.href = "/login"; 
      return; 
    }
    fetchPerfil(token);
  }, [fetchPerfil]);

// ...

  const handleSubirArchivo = async () => {
    if (!archivo) { /* ... */ return; }
    
    // --- CORRECCIÓN 2: Unificamos la obtención del token aquí también ---
    const token = localStorage.getItem("authToken"); 
    if (!token) { 
      setResultadoCatalogo({ message: "❌ Sesión no válida para subir catálogo.", type: "error" }); 
      return; 
    }
    
    setLoadingCatalogo(true);
    // ... el resto de tu lógica de subida de archivo se mantiene igual
  };

// ... (el resto de tu componente Perfil se mantiene igual) ...