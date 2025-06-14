// src/pages/Integracion.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

// Interfaz para el usuario
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

  // Función para validar acceso y redirigir si no tiene plan pro/full
  const validarAcceso = (user: User | null) => {
    if (!user) {
      navigate("/login");
      return false;
    }
    const plan = (user.plan || "").toLowerCase();
    if (plan !== "pro" && plan !== "full") {
      // Mostrá un toast o simplemente redirigí
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

    // Doble check de plan apenas se monta
    validarAcceso(fullUser);
    // eslint-disable-next-line
  }, [navigate]);

  // Doble control de seguridad: cada vez que cambia el usuario, volvemos a validar
  useEffect(() => {
    if (user) {
      validarAcceso(user);
    }
    // eslint-disable-next-line
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen text-foreground bg-background dark:bg-gray-900">
        Cargando datos de usuario...
      </div>
    );
  }

  // Si llegó acá, ya tiene acceso PRO/FULL
  const url = `https://www.chatboc.ar/iframe?token=${user.token}`;
  const codeScript = `<script>(function(){var s=document.createElement('script');s.src='https://www.chatboc.ar/widget.js';s.async=true;s.setAttribute('data-token','${user.token}');document.head.appendChild(s);})();</script>`;
  const codeIframe = `<iframe src="${url}" width="370" height="540" style="position:fixed;bottom:24px;right:24px;border:none;border-radius:32px;z-index:9999;box-shadow:0 4px 32px rgba(0,0,0,0.2);background:var(--background);" allow="clipboard-write" loading="lazy"></iframe>`;

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
        <div className="border border-border rounded overflow-hidden bg-background flex items-center justify-center" style={{ minHeight: 540 }}>
          <iframe
            src={url}
            width="370"
            height="540"
            style={{
              border: "none",
              borderRadius: "32px",
              width: "100%",
              maxWidth: 370,
              minHeight: 540,
              background: "var(--background)",
            }}
            loading="lazy"
            title="Chatboc Preview"
          />
        </div>
      </div>
    </div>
  );
};

export default Integracion;
