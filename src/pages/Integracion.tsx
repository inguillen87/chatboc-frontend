// src/pages/Integracion.tsx (VERSIÓN FINAL Y CORREGIDA)

import React, { useEffect, useState } from "react";
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
  tipo_chat?: "pyme" | "municipio";
}

const Integracion = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [copiado, setCopiado] = useState<"iframe" | "script" | null>(null);

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
  }, [navigate]);

  useEffect(() => {
    if (user) {
      validarAcceso(user);
    }
  }, [user]);

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

  // Asegúrate de que user.tipo_chat existe y es 'municipio' o 'pyme'
  const endpoint = (user.tipo_chat === "municipio" ? "municipio" : "pyme");

  // codeScript ahora incluye todos los data-atributos para la configuración
  const codeScript = `<script>(function(){var s=document.createElement('script');s.src='https://www.chatboc.ar/widget.js';s.async=true;s.setAttribute('data-token','${user.token}');s.setAttribute('data-default-open','false');s.setAttribute('data-width','${WIDGET_STD_WIDTH}');s.setAttribute('data-height','${WIDGET_STD_HEIGHT}');s.setAttribute('data-closed-width','${WIDGET_STD_CLOSED_WIDTH}');s.setAttribute('data-closed-height','${WIDGET_STD_CLOSED_HEIGHT}');s.setAttribute('data-bottom','${WIDGET_STD_BOTTOM}');s.setAttribute('data-right','${WIDGET_STD_RIGHT}');s.setAttribute('data-tipo-chat','${endpoint}');document.head.appendChild(s);})();</script>`;

  // codeIframe vuelve a ser un iframe directo (como lo tenías)
  const url = `https://www.chatboc.ar/iframe?token=${user.token}&defaultOpen=true&openWidth=${WIDGET_STD_WIDTH}&openHeight=${WIDGET_STD_HEIGHT}&closedWidth=${WIDGET_STD_CLOSED_WIDTH}&closedHeight=${WIDGET_STD_CLOSED_HEIGHT}&tipo_chat=${endpoint}`;
  const codeIframe = `<iframe id="chatboc-iframe" src="${url}" style="position:fixed;bottom:24px;right:24px;border:none;border-radius:16px;z-index:9999;box-shadow:0 4px 32px rgba(0,0,0,0.2);background:transparent;overflow:hidden;width:${WIDGET_STD_WIDTH}!important;height:${WIDGET_STD_HEIGHT}!important;display:block" allow="clipboard-write" loading="lazy"></iframe><script>(function(){var f=document.getElementById('chatboc-iframe');window.addEventListener('message',function(e){if(e.data&&e.data.type==='chatboc-state-change'){f.style.width=e.data.dimensions.width;f.style.height=e.data.dimensions.height;f.style.borderRadius=e.data.isOpen?'16px':'50%';}});})();</script>`;

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
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 540 }}
        >
          <div
            style={{
              width: 370,
              height: 540,
              border: "1px solid #e3e3e3",
              borderRadius: 16,
              overflow: "hidden",
              background: "#fff",
              boxShadow: "0 4px 24px rgba(0,0,0,0.13)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <iframe
              src={url}
              width="370"
              height="540"
              style={{
                border: "none",
                width: "370px",
                height: "540px",
                borderRadius: "16px",
                background: "transparent",
                display: "block"
              }}
              loading="lazy"
              title="Vista previa Chatboc"
              allow="clipboard-write"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Integracion;
