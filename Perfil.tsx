import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { RotateCcw, LogOut } from "lucide-react";
import { apiFetch } from "@/utils/api";

const plans = ["free", "starter", "pro", "enterprise"];

const Perfil = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const parsed = stored ? JSON.parse(stored) : null;

    if (!parsed || !parsed.token || !parsed.name || !parsed.email) {
      localStorage.removeItem("user");
      navigate("/login");
    } else {
      setUser(parsed);
    }
  }, [navigate]);

  const handleChangePlan = async (newPlan: string) => {
    if (!user?.token) return;
    try {
      const data = await apiFetch(
        "/update_user",
        "POST",
        { plan: newPlan },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: user.token,
          },
        }
      );

      if (data.plan) {
        const updated = { ...user, ...data };
        localStorage.setItem("user", JSON.stringify(updated));
        setUser(updated);
        setMessage(`✅ Plan actualizado a: ${data.plan}`);
      } else {
        setMessage("❌ No se pudo actualizar el plan.");
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Error de conexión.");
    }
  };
//forzara redepleoy limpio!!
  const handleReset = async () => {
    if (!user?.token) return;
    try {
      const data = await apiFetch(
        "/update_user",
        "POST",
        { reset_preguntas: true },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: user.token,
          },
        }
      );

      if (data.message) {
        const updated = { ...user, ...data };
        localStorage.setItem("user", JSON.stringify(updated));
        setUser(updated);
        setMessage("🔄 Contador reiniciado.");
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ No se pudo reiniciar.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="flex-grow pt-28 pb-12">
        <div className="max-w-5xl mx-auto px-4 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-primary">
              👋 Hola, {user?.name}
            </h1>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border p-6 space-y-6">
            <section className="space-y-2">
              <p>
                📧 <strong>Email:</strong> {user?.email}
              </p>
              <p>
                📄 <strong>Plan actual:</strong>{" "}
                <Badge variant="secondary">{user?.plan}</Badge>
              </p>
              <p>
                💬 <strong>Consultas usadas:</strong> {user?.preguntas_usadas}
              </p>
            </section>

            <section>
              <p className="font-semibold text-sm mb-2">Cambiar plan:</p>
              <div className="flex flex-wrap gap-3">
                {plans.map((plan) => (
                  <Button
                    key={plan}
                    onClick={() => handleChangePlan(plan)}
                    className="px-4 py-1.5 rounded-full text-sm capitalize"
                    variant={user?.plan === plan ? "default" : "outline"}
                  >
                    {plan}
                  </Button>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleReset}
                variant="outline"
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Resetear contador
              </Button>

              <Button
                onClick={() => navigate("/chat")}
                className="bg-blue-600 text-white hover:bg-blue-700 transition w-full sm:w-auto"
              >
                Ir al Chat Completo
              </Button>
            </div>

            {message && (
              <div className="pt-2 text-sm font-medium text-green-600">
                {message}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Perfil;
