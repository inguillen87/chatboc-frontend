import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

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
  const codeIframe = `<iframe src="${url}" width="370" height="520" style="position:fixed;bottom:24px;right:24px;border:none;border-radius:32px;z-index:9999;box-shadow:0 4px 32px #0004;background:white;" allow="clipboard-write" loading="lazy"></iframe>`;
  const codeScript = `<script src="https://www.chatboc.ar/widget.js" data-token="${user.token}"></script>`;

  const copiarCodigo = async (tipo: "iframe" | "script") => {
    try {
      await navigator.clipboard.writeText(tipo === "iframe" ? codeIframe : codeScript);
      setCopiado(tipo);
      setTimeout(() => setCopiado(null), 2000);
    } catch (e) {
      window.prompt("Copiá el código manualmente:", tipo === "iframe" ? codeIframe : codeScript);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🧩 Integración del Chatbot Chatboc</h1>

      {!esElegible ? (
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded border border-yellow-300">
          <p className="mb-2">🔒 Este contenido está disponible solo para usuarios del <b>plan Pro o Full</b>.</p>
          <Button
            onClick={() => navigate("/checkout?plan=pro")}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
          >
            Mejorar mi plan
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4">
            Pegá este código en el <code>&lt;body&gt;</code> de tu web, Tiendanube, WooCommerce, Shopify, etc.
            Tu asistente aparecerá automáticamente abajo a la derecha y responderá con los datos de tu empresa y catálogo.
          </p>

          <div className="mb-5">
            <div className="font-semibold mb-2 text-blue-400">Opción 1: <span className="text-white">Widget con &lt;iframe&gt; (universal, recomendado)</span></div>
            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto border select-all cursor-pointer mb-2"
                 title="Click para copiar"
                 onClick={() => copiarCodigo("iframe")}
                 style={{ whiteSpace: "pre-line" }}
            >{codeIframe}</pre>
            <Button
              className="w-full mb-4"
              onClick={() => copiarCodigo("iframe")}
              variant="secondary"
            >
              {copiado === "iframe" ? "¡Copiado!" : "📋 Copiar código iframe"}
            </Button>
          </div>

          <div className="mb-5">
            <div className="font-semibold mb-2 text-blue-400">Opción 2: <span className="text-white">Widget con &lt;script&gt; (alternativo, para tiendas que lo permitan)</span></div>
            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto border select-all cursor-pointer mb-2"
                 title="Click para copiar"
                 onClick={() => copiarCodigo("script")}
                 style={{ whiteSpace: "pre-line" }}
            >{codeScript}</pre>
            <Button
              className="w-full"
              onClick={() => copiarCodigo("script")}
              variant="secondary"
            >
              {copiado === "script" ? "¡Copiado!" : "📋 Copiar código script"}
            </Button>
          </div>

          <div className="bg-slate-800 text-blue-200 p-4 rounded mb-8 text-xs border border-blue-900">
            <b>¿No ves el widget?</b> Verificá que el código esté bien pegado, y que tu tienda permita iframes/scripts.<br />
            Si usás Tiendanube: pegalo en “Editar Código Avanzado” o consultá a soporte.<br />
            Ante cualquier problema <a href="mailto:soporte@chatboc.ar" className="underline">escribinos</a>.
          </div>

          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-2">🔍 Vista previa en vivo:</h2>
            <div className="border border-gray-300 dark:border-gray-700 rounded overflow-hidden bg-white dark:bg-gray-900 flex items-center justify-center" style={{ minHeight: 520 }}>
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
                  background: "white",
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
