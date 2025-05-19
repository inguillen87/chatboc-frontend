import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { RotateCcw, LogOut } from "lucide-react";
import { apiFetch } from "@/utils/api";

const Perfil = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState("");

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
        const response = await apiFetch("/me", "GET", {}, {
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
  }, []);

  const handleReset = async () => {
    if (!user?.token) return;

    try {
      const data = await apiFetch("/update_user", "POST", { reset_preguntas: true }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: user.token,
        },
      });

      if (data.message) {
        const updated = { ...user, ...data };
        localStorage.setItem("user", JSON.stringify(updated));
        setUser(updated);
        setMessage("🔄 Contador reiniciado.");
      } else {
        setMessage("❌ No se pudo reiniciar.");
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Error de conexión.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors">
      <Navbar />
      <main className="flex-grow pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 className="text-3xl font-bold text-primary">
              👋 Hola, {user?.name}
            </h1>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>

          <div className="bg-card shadow-xl rounded-2xl p-6 space-y-6 border border-gray-200 dark:border-gray-700">
            <div className="space-y-2 text-base">
              <p>📧 <strong>Email:</strong> {user?.email}</p>
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
              {user?.plan !== "free" && (
                <Button onClick={handleReset} variant="outline" className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Resetear contador
                </Button>
              )}
              <Button
                onClick={() => navigate("/chat")}
                className="bg-blue-600 text-white hover:bg-blue-700 transition w-full sm:w-auto"
              >
                Ir al Chat Completo
              </Button>
            </div>

            {message && (
              <p className="text-green-600 font-medium text-sm pt-2">{message}</p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Perfil;
