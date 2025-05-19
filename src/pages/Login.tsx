import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/utils/api";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Si ya está logueado, redirigir automáticamente
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user?.token && user?.email) {
          navigate("/perfil");
        }
      } catch (e) {
        localStorage.removeItem("user");
      }
    }

    // Scroll automático al centro
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const data = await apiFetch("/login", "POST", { email, password });

      if (data?.token && data?.email && data?.plan) {
        const user = {
          token: data.token,
          name: data.name,
          email: data.email,
          plan: data.plan,
          preguntas_usadas: data.preguntas_usadas ?? 0,
          limite_preguntas: data.limite_preguntas ?? 50,
        };

        localStorage.setItem("user", JSON.stringify(user));
        navigate("/perfil");
      } else {
        setError("❌ Credenciales inválidas o datos incompletos.");
      }
    } catch (err) {
      console.error("❌ Error al iniciar sesión:", err);
      setError("⚠️ Error de conexión con el servidor.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-white dark:bg-[#0f0f0f] transition-colors">
      <div className="w-full max-w-md bg-gray-100 dark:bg-[#1a1a1a] p-8 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">
          Iniciar Sesión
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button type="submit" className="w-full">
            Iniciar Sesión
          </Button>
        </form>
        <div className="text-center text-sm text-gray-700 dark:text-gray-300 mt-4">
          ¿No tenés cuenta?{" "}
          <button
            onClick={() => navigate("/register")}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Registrate
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
