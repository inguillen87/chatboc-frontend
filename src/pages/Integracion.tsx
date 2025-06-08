import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // Asegúrate de que sonner esté bien configurado en tu proyecto

const Integracion = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [copiado, setCopiado] = useState<"iframe" | "script" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    let parsed = null;

    try {
      parsed = stored ? JSON.parse(stored) : null;
    } catch (err) {
      console.warn("❌ Error al parsear usuario:", err);
    }

    if (!parsed || !parsed.token) {
      navigate("/login");
      return;
    }
    setUser(parsed);
  }, [navigate]);

  if (!user) return null;

  const esElegible = ["pro", "full"].includes((user.plan || "").toLowerCase());

  // URLs y códigos para integración
  const url = `https://www.chatboc.ar/iframe?token=${user.token}`;
  // MODIFICADO: Estilos inline del iframe para adaptarse mejor al tema si se usa background transparente
  // o colores temáticos para el iframe mismo.
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
    <div className="p-8 max-w-2xl mx-auto bg-background text-foreground"> {/* Usar bg-background y text-foreground */}
      <h1 className="text-3xl font-bold mb-6 text-primary">🧩 Integración del Chatbot Chatboc</h1> {/* Usar text-primary */}

      {!esElegible ? (
        // MODIFICADO: Colores adaptativos
        <div className="bg-yellow-100 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300 p-4 rounded border border-yellow-300 dark:border-yellow-700">
          <p className="mb-2">🔒 Este contenido está disponible solo para usuarios del <b>plan Pro o Full</b>.</p>
          <Button
            onClick={() => navigate("/checkout?plan=pro")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" // Usar bg-primary
          >
            Mejorar mi plan
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-muted-foreground"> {/* Usar text-muted-foreground */}
            Pegá este código en el <code>&lt;body&gt;</code> de tu web, Tiendanube, WooCommerce, Shopify, etc.
            Tu asistente aparecerá automáticamente abajo a la derecha y responderá con los datos de tu empresa y catálogo.
          </p>

          <div className="mb-5">
            <div className="font-semibold mb-2 text-primary">Opción 1: <span className="text-foreground">Widget con &lt;iframe&gt; (universal, recomendado)</span></div> {/* Usar text-primary y text-foreground */}
            <pre
                 // MODIFICADO: Colores adaptativos para pre y border
                 className="bg-muted dark:bg-card p-3 rounded text-xs overflow-x-auto border border-border select-all cursor-pointer mb-2 text-foreground"
                 title="Click para copiar"
                 onClick={() => copiarCodigo("iframe")}
                 style={{ whiteSpace: "pre-line" }}
            >{codeIframe}</pre>
            <Button
              className="w-full mb-4 bg-secondary text-secondary-foreground hover:bg-secondary/80" // Usar bg-secondary
              onClick={() => copiarCodigo("iframe")}
              variant="secondary"
            >
              {copiado === "iframe" ? "¡Copiado!" : "📋 Copiar código iframe"}
            </Button>
          </div>

          <div className="mb-5">
            <div className="font-semibold mb-2 text-primary">Opción 2: <span className="text-foreground">Widget con &lt;script&gt; (alternativo, para tiendas que lo permitan)</span></div> {/* Usar text-primary y text-foreground */}
            <pre
                 // MODIFICADO: Colores adaptativos para pre y border
                 className="bg-muted dark:bg-card p-3 rounded text-xs overflow-x-auto border border-border select-all cursor-pointer mb-2 text-foreground"
                 title="Click para copiar"
                 onClick={() => copiarCodigo("script")}
                 style={{ whiteSpace: "pre-line" }}
            >{codeScript}</pre>
            <Button
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80" // Usar bg-secondary
              onClick={() => copiarCodigo("script")}
              variant="secondary"
            >
              {copiado === "script" ? "¡Copiado!" : "📋 Copiar código script"}
            </Button>
          </div>

          // MODIFICADO: Colores adaptativos
          <div className="bg-muted text-muted-foreground p-4 rounded mb-8 text-xs border border-border">
            <b>¿No ves el widget?</b> Verificá que el código esté bien pegado, y que tu tienda permita iframes/scripts.<br />
            Si usás Tiendanube: pegalo en “Editar Código Avanzado” o consultá a soporte.<br />
            Ante cualquier problema <a href="mailto:soporte@chatboc.ar" className="underline text-primary">escribinos</a>. {/* Usar text-primary */}
          </div>

          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-2 text-foreground">🔍 Vista previa en vivo:</h2> {/* Usar text-foreground */}
            <div className="border border-border rounded overflow-hidden bg-background flex items-center justify-center" style={{ minHeight: 520 }}> {/* Usar border-border y bg-background */}
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
                  background: "var(--background)", // Usar la variable CSS para el fondo
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