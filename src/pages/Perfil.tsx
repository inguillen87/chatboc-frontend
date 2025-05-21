import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { LogOut } from "lucide-react";
import { apiFetch } from "@/utils/api";
// ... imports originales
import WidgetEmbed from "@/components/chat/WidgetEmbed";

const Perfil = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const stored = localStorage.getItem("user");
      let parsed = null;

      try {
        parsed = stored ? JSON.parse(stored) : null;
      } catch (err) {
        console.warn("❌ Error al parsear localStorage:", err);
      }

      if (!parsed || !parsed.token || !parsed.email || !parsed.name) {
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      try {
        const response = await apiFetch("/me", "GET", undefined, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${parsed.token}`,
          },
        });

        if (response?.email) {
          const updated = { ...parsed, ...response };
          localStorage.setItem("user", JSON.stringify(updated));
          setUser(updated);
        } else {
          setUser(parsed);
        }
      } catch (err) {
        console.error("❌ Error al obtener datos del usuario:", err);
        navigate("/login");
      }
    };

    fetchUserData();
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 200);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors">
      <Navbar />
      <main className="flex-grow pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 className="text-3xl font-bold text-primary">
              {user?.nombre_empresa
                ? `Perfil de ${user.nombre_empresa}`
                : `Perfil de ${user.name}`}
            </h1>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>

          <div className="bg-card shadow-xl rounded-2xl p-6 space-y-6 border border-gray-200 dark:border-gray-700">
            <div className="space-y-2 text-base">
              <p>📧 <strong>Email:</strong> {user?.email}</p>
              <p>🏢 <strong>Empresa:</strong> {user?.nombre_empresa || 'No especificado'}</p>
              <p className="text-sm text-muted-foreground">⚠️ Es importante que hayas ingresado correctamente el nombre real de tu empresa, pyme o negocio. Esto mejora la experiencia del cliente y permite al bot aprender y responder con mayor precisión.</p>
              <p>📄 <strong>Plan actual:</strong> <Badge variant="secondary">{user?.plan}</Badge></p>
              <p>💬 <strong>Consultas usadas:</strong> {user?.preguntas_usadas}</p>
              <p>📈 <strong>Límite:</strong> {user?.limite_preguntas}</p>
            </div>

            {(user?.plan === "free" || user?.plan === "pro") && (
              <div className="space-y-2">
                <p className="font-semibold text-sm">Mejorá tu plan:</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {user?.plan === "free" && (
                    <Button
                      className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                      onClick={() => navigate("/checkout?plan=pro")}
                    >
                      Pasar a Plan Pro · $30/mes
                    </Button>
                  )}
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    onClick={() => navigate("/checkout?plan=full")}
                  >
                    Pasar a Plan Full · $80/mes
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Button
                onClick={() => navigate("/chat")}
                className="bg-blue-600 text-white hover:bg-blue-700 transition w-full sm:w-auto"
              >
                Ir al Chat Completo
              </Button>
            </div>

            {/* 🔌 Bloque nuevo para incrustar el iframe del widget */}
            <WidgetEmbed token={user.token} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Perfil;
