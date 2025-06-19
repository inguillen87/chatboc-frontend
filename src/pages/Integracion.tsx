// src/pages/Integracion.tsx

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

interface User {
  id: number;
  name: string;
  email: string;
  token: string;
  plan?: string;
}

const Integracion = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [copiado, setCopiado] = useState<"iframe" | "script" | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null); // Ref para el contenedor de la vista previa

  const validarAcceso = (user: User | null) => {
    if (!user) {
      navigate("/login");
      return false;
    }
    const plan = (user.plan || "").toLowerCase();
    if (plan !== "pro" && plan !== "full") {
      toast.error("Acceso restringido a usuarios PRO o FULL");
      navigate("/perfil");
      return false;
    }
    return true;
  };

  useEffect(() => {
    const authToken = safeLocalStorage.getItem("authToken");
    const storedUser = safeLocalStorage.getItem("user");
    let parsedUser: Omit<User, 'token'> | null = null;

    try {
      parsedUser = storedUser ? JSON.parse(storedUser) : null;
    } catch (err) {
      safeLocalStorage.removeItem("user");
    }

    if (!authToken || !parsedUser || !parsedUser.id) {
      navigate("/login");
      return;
    }

    const fullUser: User = {
      ...parsedUser,
      token: authToken,
      plan: parsedUser.plan || "free"
    };
    setUser(fullUser);

    validarAcceso(fullUser);
  }, [navigate]); // Elimina el eslint-disable-line si no es necesario

  useEffect(() => {
    if (user) {
      validarAcceso(user);
    }
  }, [user]); // Elimina el eslint-disable-line si no es necesario

  // --- LÓGICA DE VISTA PREVIA DEL WIDGET ---
  useEffect(() => {
    if (previewContainerRef.current && user) {
      // Limpiar el contenedor antes de inyectar para evitar duplicados
      previewContainerRef.current.innerHTML = ''; 

      // Crea y configura el script para la vista previa
      const script = document.createElement('script');
      script.src = `https://www.chatboc.ar/widget.js`; // URL de tu widget.js desplegado
      script.async = true;
      script.setAttribute('data-token', user.token);
      script.setAttribute('data-default-open', 'false'); // Para que inicie como botón cerrado
      script.setAttribute('data-width', '370px'); // Ancho del panel
      script.setAttribute('data-height', '540px'); // Alto del panel
      script.setAttribute('data-closed-width', '88px'); // Ancho del botón
      script.setAttribute('data-closed-height', '88px'); // Alto del botón
      script.setAttribute('data-z', '10'); // Z-index bajo para la vista previa, para no interferir con la UI de Integración
      script.setAttribute('data-target-element-id', 'chatboc-preview-div'); // ID del div donde se renderizará

      // Eliminar cualquier instancia anterior del script de la vista previa para evitar problemas de duplicación
      const oldScript = document.getElementById('chatboc-preview-script');
      if (oldScript) oldScript.remove();
      script.id = 'chatboc-preview-script'; // Asigna un ID para poder removerlo después

      // Inyectar el script en el cuerpo del documento.
      // El widget.js detectará 'data-target-element-id' y se renderizará en el div especificado.
      document.body.appendChild(script);

      // Función de limpieza para remover el script cuando el componente se desmonte
      return () => {
        const scriptToRemove = document.getElementById('chatboc-preview-script');
        if (scriptToRemove) scriptToRemove.remove();
      };
    }
  }, [user]); // Recargar la vista previa si el objeto 'user' cambia (ej. token)

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen text-foreground bg-background dark:bg-gray-900">
        Cargando datos de usuario...
      </div>
    );
  }

  // Definir las dimensiones estándar del widget para los códigos de copia
  const WIDGET_STD_WIDTH = "370px";
  const WIDGET_STD_HEIGHT = "540px";
  const WIDGET_STD_CLOSED_WIDTH = "88px";
  const WIDGET_STD_CLOSED_HEIGHT = "88px";
  const WIDGET_STD_BOTTOM = "20px";
  const WIDGET_STD_RIGHT = "20px";

  // Reconstruir codeScript (Opción 1: Flotante estándar con widget.js)
  const codeScript = `<script>(function(){var s=document.createElement('script');s.src='https://www.chatboc.ar/widget.js';s.async=true;s.setAttribute('data-token','${user.token}');s.setAttribute('data-default-open','false');s.setAttribute('data-width','${WIDGET_STD_WIDTH}');s.setAttribute('data-height','${WIDGET_STD_HEIGHT}');s.setAttribute('data-closed-width','${WIDGET_STD_CLOSED_WIDTH}');s.setAttribute('data-closed-height','${WIDGET_STD_CLOSED_HEIGHT}');s.setAttribute('data-bottom','${WIDGET_STD_BOTTOM}');s.setAttribute('data-right','${WIDGET_STD_RIGHT}');document.head.appendChild(s);})();</script>`;

  // Reconstruir codeIframe (Opción 2: Incrustado en un DIV específico con widget.js)
  // Esta opción utiliza widget.js para crear el iframe dentro de un div,
  // para sistemas que requieran un contenedor específico para el widget.
  const codeIframe = `<div id="chatboc-embed-container" style="position:relative; width:${WIDGET_STD_WIDTH}; height:${WIDGET_STD_HEIGHT}; border:1px solid #ccc; border-radius:16px; overflow:hidden; margin:auto;"></div><script>(function(){var s=document.createElement('script');s.src='https://www.chatboc.ar/widget.js';s.async=true;s.setAttribute('data-token','${user.token}');s.setAttribute('data-default-open','false');s.setAttribute('data-width','${WIDGET_STD_WIDTH}');s.setAttribute('data-height','${WIDGET_STD_HEIGHT}');s.setAttribute('data-closed-width','${WIDGET_STD_CLOSED_WIDTH}');s.setAttribute('data-closed-height','${WIDGET_STD_CLOSED_HEIGHT}');s.setAttribute('data-target-element-id','chatboc-embed-container');document.head.appendChild(s);})();</script>`;

  const copiarCodigo = async (tipo: "iframe" | "script") => {
    try {
      await navigator.clipboard.writeText(tipo === "iframe" ? codeIframe : codeScript);
      setCopiado(tipo);
      setTimeout(() => setCopiado(null), 2000);
      toast.success("✅ Código copiado al portapapeles");
    } catch (e) {
      window.prompt("Copiá el código manualmente:", tipo === "iframe" ? codeIframe : codeScript);
      toast.error("❌ No se pudo copiar automáticamente.");
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-6 text-primary">🧩 Integración del Chatbot Chatboc</h1>

      <p className="mb-4 text-muted-foreground">
        Pegá este código en el <code>&lt;body&gt;</code> de tu web, Tiendanube, WooCommerce, Shopify, etc.
        Tu asistente aparecerá automáticamente abajo a la derecha y responderá con los datos de tu empresa y catálogo.
      </p>

      <div className="mb-5">
        <div className="font-semibold mb-2 text-primary">Opción 1: <span className="text-foreground">Widget con &lt;script&gt; (recomendado)</span></div>
        <pre
          className="bg-muted dark:bg-card p-3 rounded text-xs overflow-x-auto border border-border select-all cursor-pointer mb-2 text-foreground"
          title="Click para copiar"
          onClick={() => copiarCodigo("script")}
          style={{ whiteSpace: "pre-line" }}
        >{codeScript}</pre>
        <Button
          className="w-full mb-4 bg-secondary text-secondary-foreground hover:bg-secondary/80"
          onClick={() => copiarCodigo("script")}
          variant="secondary"
        >
          {copiado === "script" ? "¡Copiado!" : "📋 Copiar código script"}
        </Button>
      </div>

      <div className="mb-5">
        <div className="font-semibold mb-2 text-primary">Opción 2: <span className="text-foreground">Widget con &lt;iframe&gt; (alternativo)</span></div>
        <pre
          className="bg-muted dark:bg-card p-3 rounded text-xs overflow-x-auto border border-border select-all cursor-pointer mb-2 text-foreground"
          title="Click para copiar"
          onClick={() => copiarCodigo("iframe")}
          style={{ whiteSpace: "pre-line" }}
        >{codeIframe}</pre>
        <Button
          className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
          onClick={() => copiarCodigo("iframe")}
          variant="secondary"
        >
          {copiado === "iframe" ? "¡Copiado!" : "📋 Copiar código iframe"}
        </Button>
      </div>

      <div className="bg-muted text-muted-foreground p-4 rounded mb-8 text-xs border border-border">
        <b>¿No ves el widget?</b> Verificá que el código esté bien pegado, y que tu tienda permita iframes/scripts.<br />
        Si usás Tiendanube: pegalo en “Editar Código Avanzado” o consultá a soporte.<br />
        Ante cualquier problema <a href="mailto:soporte@chatboc.ar" className="underline text-primary">escribinos</a>.
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-2 text-foreground">🔍 Vista previa en vivo:</h2>
        {/* El div donde el widget real se inyectará para la vista previa */}
        <div 
          ref={previewContainerRef} 
          id="chatboc-preview-div" // Este ID es CRÍTICO para que widget.js lo encuentre
          style={{ 
            position: 'relative', // Importante para que el widget se posicione ABSOLUTE dentro
            width: '370px', 
            height: '540px', 
            border: '1px solid hsl(var(--border))', 
            borderRadius: '16px', 
            overflow: 'hidden', 
            margin: 'auto',
            background: 'hsl(var(--background))' 
          }}
        >
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Cargando vista previa...
          </div>
        </div>
      </div>
    </div>
  );
};

export default Integracion;