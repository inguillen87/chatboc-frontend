// src/pages/Integracion.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Interfaz para el usuario, asegurando que el token sea parte de la interfaz si se usa de esa forma
interface User {
  id: number;
  name: string;
  email: string;
  token: string; // Aseguramos que la interfaz User tenga la propiedad token
  plan?: string; // Si el plan también viene en el objeto user
}

const Integracion = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null); // Usamos la interfaz User
  const [copiado, setCopiado] = useState<"iframe" | "script" | null>(null);

  useEffect(() => {
    // Leer el token de autenticación directamente de localStorage
    const authToken = localStorage.getItem("authToken"); 
    // Leer el objeto de usuario (sin el token, como viene actualmente)
    const storedUser = localStorage.getItem("user");
    let parsedUser: Omit<User, 'token'> | null = null; // Definimos el tipo como User sin el token por ahora

    // Intentar parsear el objeto de usuario
    try {
      parsedUser = storedUser ? JSON.parse(storedUser) : null;
    } catch (err) {
      console.warn("❌ Integracion: Error al parsear usuario desde localStorage:", err);
      // Opcional: Si hay error de parseo, limpiar localStorage para evitar bucles
      localStorage.removeItem("user");
      // Considerar también localStorage.removeItem("authToken"); si el parseo fallido indica un problema mayor
    }

    // --- Lógica de Validación de Sesión Robusta ---
    // Si no hay token O si no hay usuario parseado (o si el usuario parseado no tiene ID)
    if (!authToken || !parsedUser || !parsedUser.id) {
      console.log("Integracion: Sesión no válida (falta token o datos de usuario). Redirigiendo a /login.");
      navigate("/login");
      return;
    }

    // Si llegamos aquí, tenemos un authToken y un parsedUser válido.
    // Creamos el objeto `user` completo para el estado del componente.
    const fullUser: User = {
      ...parsedUser,
      token: authToken, // Añadimos el token directamente al objeto user
      // Aquí podrías también obtener 'plan' si viene en 'parsedUser' o en otra parte
      plan: parsedUser.plan || "free" // Asume plan 'free' si no está definido
    };
    setUser(fullUser);

    console.log("Integracion: Sesión válida. Usuario cargado:", fullUser); // Confirma que se cargó correctamente
  }, [navigate]); // navigate es una dependencia para useEffect

  // Si el usuario aún no se ha cargado (puede pasar brevemente), no renderizar nada para evitar errores
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen text-foreground bg-background dark:bg-gray-900">
        Cargando datos de usuario...
      </div>
    );
  }

  const esElegible = ["pro", "full"].includes((user.plan || "").toLowerCase());

  // URLs y códigos para integración (ahora user.token estará disponible)
  const url = `https://www.chatboc.ar/iframe?token=${user.token}`;
  const codeIframe = `<iframe src="${url}" width="370" height="520" style="position:fixed;bottom:24px;right:24px;border:none;border-radius:32px;z-index:9999;box-shadow:0 4px 32px rgba(0,0,0,0.2);background:transparent;" allow="clipboard-write" loading="lazy"></iframe>`;
  const codeScript = `<script src="https://www.chatboc.ar/widget.js" data-token="${user.token}"></script>`;

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

      {!esElegible ? (
        <div className="bg-yellow-100 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300 p-4 rounded border border-yellow-300 dark:border-yellow-700">
          <p className="mb-2">🔒 Este contenido está disponible solo para usuarios del <b>plan Pro o Full</b>.</p>
          <Button
            onClick={() => navigate("/checkout?plan=pro")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Mejorar mi plan
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-muted-foreground">
            Pegá este código en el <code>&lt;body&gt;</code> de tu web, Tiendanube, WooCommerce, Shopify, etc.
            Tu asistente aparecerá automáticamente abajo a la derecha y responderá con los datos de tu empresa y catálogo.
          </p>

          <div className="mb-5">
            <div className="font-semibold mb-2 text-primary">Opción 1: <span className="text-foreground">Widget con &lt;iframe&gt; (universal, recomendado)</span></div>
            <pre
                  className="bg-muted dark:bg-card p-3 rounded text-xs overflow-x-auto border border-border select-all cursor-pointer mb-2 text-foreground"
                  title="Click para copiar"
                  onClick={() => copiarCodigo("iframe")}
                  style={{ whiteSpace: "pre-line" }}
            >{codeIframe}</pre>
            <Button
              className="w-full mb-4 bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => copiarCodigo("iframe")}
              variant="secondary"
            >
              {copiado === "iframe" ? "¡Copiado!" : "📋 Copiar código iframe"}
            </Button>
          </div>

          <div className="mb-5">
            <div className="font-semibold mb-2 text-primary">Opción 2: <span className="text-foreground">Widget con &lt;script&gt; (alternativo, para tiendas que lo permitan)</span></div>
            <pre
                  className="bg-muted dark:bg-card p-3 rounded text-xs overflow-x-auto border border-border select-all cursor-pointer mb-2 text-foreground"
                  title="Click para copiar"
                  onClick={() => copiarCodigo("script")}
                  style={{ whiteSpace: "pre-line" }}
            >{codeScript}</pre>
            <Button
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => copiarCodigo("script")}
              variant="secondary"
            >
              {copiado === "script" ? "¡Copiado!" : "📋 Copiar código script"}
            </Button>
          </div>

          <div className="bg-muted text-muted-foreground p-4 rounded mb-8 text-xs border border-border">
            <b>¿No ves el widget?</b> Verificá que el código esté bien pegado, y que tu tienda permita iframes/scripts.<br />
            Si usás Tiendanube: pegalo en “Editar Código Avanzado” o consultá a soporte.<br />
            Ante cualquier problema <a href="mailto:soporte@chatboc.ar" className="underline text-primary">escribinos</a>.
          </div>

          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-2 text-foreground">🔍 Vista previa en vivo:</h2>
            <div className="border border-border rounded overflow-hidden bg-background flex items-center justify-center" style={{ minHeight: 520 }}>
              <iframe
                src={url}
                width="370"
                height="520"
                style={{
                  border: "none",
                  borderRadius: "32px",
                  width: "100%",
                  maxWidth: 370,
                  minHeight: 520,
                  background: "var(--background)",
                }}
                loading="lazy"
                title="Chatboc Preview"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Integracion;