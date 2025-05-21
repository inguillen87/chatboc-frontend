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

  const url = `https://chatboc.ar/iframe?token=${user.token}`;
  const codigo = `<iframe src='${url}' width='100%' height='500px' frameborder='0'></iframe>`;

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      alert("✅ Código copiado al portapapeles");
    } catch {
      alert("❌ Error al copiar el código");
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🧩 Integración del Chatbot</h1>

      {!esElegible ? (
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded border border-yellow-300">
          <p className="mb-2">🔒 Este contenido está disponible solo para usuarios del plan Pro o Full.</p>
          <Button
            onClick={() => navigate("/checkout?plan=pro")}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
          >
            Mejorá tu plan para acceder
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4">
            Copiá este código y pegalo dentro del <code>&lt;body&gt;</code> de tu sitio web.
          </p>
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm overflow-x-auto border">
            <code>{codigo}</code>
          </pre>
          <Button onClick={copiarCodigo} className="mt-4">📋 Copiar código</Button>

          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-2">🔍 Vista previa:</h2>
            <div className="border border-gray-300 dark:border-gray-700 rounded overflow-hidden">
              <iframe
                src={url}
                width="100%"
                height="500px"
                frameBorder="0"
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
