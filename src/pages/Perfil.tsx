import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import EnvironmentBadge from "../components/EnvironmentBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { RotateCcw, LogOut } from "lucide-react";

const plans = ["free", "starter", "pro", "enterprise"];

const Perfil = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
  const stored = localStorage.getItem("user");
  const parsed = stored ? JSON.parse(stored) : null;

  // Validar que tenga los campos mínimos esperados
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
      const res = await fetch("http://localhost:5000/update_user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: user.token,
        },
        body: JSON.stringify({ plan: newPlan }),
      });
      const data = await res.json();
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

  const handleReset = async () => {
    if (!user?.token) return;
    try {
      const res = await fetch("http://localhost:5000/update_user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: user.token,
        },
        body: JSON.stringify({ reset_preguntas: true }),
      });
      const data = await res.json();
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
      <EnvironmentBadge />

      <main className="flex-grow pt-28 pb-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-primary">👋 Hola, {user?.name}</h1>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>

          <div className="bg-card shadow-lg rounded-2xl p-6 space-y-6 border">
            <div className="text-base space-y-2">
              <p>📧 <strong>Email:</strong> {user?.email}</p>
              <p>📄 <strong>Plan actual:</strong> <Badge variant="secondary">{user?.plan}</Badge></p>
              <p>💬 <strong>Consultas usadas:</strong> {user?.preguntas_usadas}</p>
            </div>

            <div>
              <p className="font-semibold text-sm mb-1">Cambiar plan:</p>
              <div className="flex flex-wrap gap-3">
                {plans.map(plan => (
                  <Button
                    key={plan}
                    onClick={() => handleChangePlan(plan)}
                    className="px-4 py-1.5 rounded-full text-sm"
                  >
                    {plan}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleReset}
              variant="outline"
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Resetear contador
            </Button>

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
