import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/utils/api";

interface LoginResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  plan: string;
  preguntas_usadas: number;
  limite_preguntas: number;
}

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("authToken")) navigate("/perfil");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await apiFetch<LoginResponse>('/login', {
        method: 'POST',
        body: { email, password },
      });

      const userProfile = {
        id: data.id,
        name: data.name,
        email: data.email,
        plan: data.plan,
        preguntas_usadas: data.preguntas_usadas,
        limite_preguntas: data.limite_preguntas,
      };

      localStorage.setItem("user", JSON.stringify(userProfile));
      localStorage.setItem("authToken", data.token);

      navigate("/perfil");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || err.body?.message || "Credenciales inválidas.");
      } else {
        setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      }
      console.error("❌ Error al iniciar sesión:", err);
    } finally {
      setIsLoading(false);
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
            disabled={isLoading}
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Ingresando..." : "Iniciar Sesión"}
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
