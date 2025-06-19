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
    } catch {
      safeLocalStorage.removeItem("user");
    }

    if (!authToken || !parsedUser || !parsedUser.id) {
      navigate("/login");
      return;
    }

    const fullUser: User = { ...parsedUser, token: authToken, plan: parsedUser.plan || "free" };
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

  const WIDGET_STD_WIDTH = "370px";
  const WIDGET_STD_HEIGHT = "540px";
  const WIDGET_STD_CLOSED_WIDTH = "88px";
  const WIDGET_STD_CLOSED_HEIGHT = "88px";

  const codeScript = `<script>(function(){var s=document.createElement('script');s.src='https://www.chatboc.ar/widget.js';s.async=true;s.setAttribute('data-token','${user.token}');s.setAttribute('data-default-open','false');s.setAttribute('data-width','${WIDGET_STD_WIDTH}');s.setAttribute('data-height','${WIDGET_STD_HEIGHT}');s.setAttribute('data-closed-width','${WIDGET_STD_CLOSED_WIDTH}');s.setAttribute('data-closed-height','${WIDGET_STD_CLOSED_HEIGHT}');s.setAttribute('data-bottom','20px');s.setAttribute('data-right','20px');document.head.appendChild(s);})();</script>`;

  const url = `https://www.chatboc.ar/iframe?token=${user.token}&defaultOpen=true&openWidth=${WIDGET_STD_WIDTH}&openHeight=${WIDGET_STD_HEIGHT}&closedWidth=${WIDGET_STD_CLOSED_WIDTH}&closedHeight=${WIDGET_STD_CLOSED_HEIGHT}`;
  const codeIframe = `<iframe id="chatboc-iframe" src="${url}" style="position:fixed;bottom:24px;right:24px;border:none;border-radius:16px;z-index:9999;box-shadow:0 4px 32px rgba(0,0,0,0.2);background:transparent;overflow:hidden;width:${WIDGET_STD_WIDTH}!important;height:${WIDGET_STD_HEIGHT}!important;display:block" allow="clipboard-write" loading="lazy"></iframe><script>(function(){var f=document.getElementById('chatboc-iframe');window.addEventListener('message',function(e){if(e.data&&e.data.type==='chatboc-state-change'){f.style.width=e.data.dimensions.width;f.style.height=e.data.dimensions.height;f.style.borderRadius=e.data.isOpen?'16px':'50%';}});})();</script>`;

  const copiarCodigo = async (tipo: "iframe" | "script") => {
    try {
      await navigator.clipboard.writeText(tipo === "iframe" ? codeIframe : codeScript);
      setCopiado(tipo);
      setTimeout(() => setCopiado(null), 2000);
      toast.success("✅ Código copiado al portapapeles");
    } catch {
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
        <pre className="bg-muted dark:bg-card p-3 rounded text-xs overflow-x-auto border border-border select-all cursor-pointer mb-2 text-foreground" title="Click para copiar" onClick={() => copiarCodigo("script") } style={{ whiteSpace: "pre-line" }}>{codeScript}</pre>
        <Button className="w-full mb-4 bg-secondary text-secondary-foreground hover:bg-secondary/80" onClick={() => copiarCodigo("script") } variant="secondary">
          {copiado === "script" ? "¡Copiado!" : "📋 Copiar código script"}
        </Button>
      </div>
      <div className="mb-5">
        <div className="font-semibold mb-2 text-primary">Opción 2: <span className="text-foreground">Widget con &lt;iframe&gt; (alternativo)</span></div>
        <pre className="bg-muted dark:bg-card p-3 rounded text-xs overflow-x-auto border border-border select-all cursor-pointer mb-2 text-foreground" title="Click para copiar" onClick={() => copiarCodigo("iframe") } style={{ whiteSpace: "pre-line" }}>{codeIframe}</pre>
        <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80" onClick={() => copiarCodigo("iframe") } variant="secondary">
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
            style={{ border: "none", borderRadius: "16px", width: "100%", maxWidth: 370, minHeight: 540, background: "hsl(var(--background))" }}
            loading="lazy"
            title="Chatboc Preview"
          />
        </div>
      </div>
    </div>
  );
};

export default Integracion;
