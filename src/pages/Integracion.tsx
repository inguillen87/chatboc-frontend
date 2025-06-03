import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Integracion = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

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

  const esElegible = ["pro", "full"].includes(user.plan);

  // Usá siempre tu dominio .ar, si no puede dar error CORS
  const url = `https://www.chatboc.ar/iframe?token=${user.token}`;
  const codigo = `<iframe src="${url}" width="370" height="520" style="position:fixed;bottom:24px;right:24px;border:none;border-radius:32px;z-index:9999;box-shadow:0 4px 32px #0004;background:white;" allow="clipboard-write" loading="lazy"></iframe>`;

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      window.alert("✅ Código copiado al portapapeles");
    } catch (e) {
      window.prompt("Copiá el código manualmente:", codigo);
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
            Copiá y pegá este código dentro del <code>&lt;body&gt;</code> de tu sitio web, Tiendanube, WooCommerce, Shopify, etc. 
            El widget responderá con los datos y catálogo de tu empresa.
          </p>
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm overflow-x-auto border">
            <code>{codigo}</code>
          </pre>
          <Button onClick={copiarCodigo} className="mt-4">📋 Copiar código</Button>

          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-2">🔍 Vista previa de tu widget:</h2>
            <div className="border border-gray-300 dark:border-gray-700 rounded overflow-hidden bg-white dark:bg-gray-900">
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
              ></iframe>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Integracion;
