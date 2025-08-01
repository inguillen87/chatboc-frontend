// Contenido COMPLETO y CORREGIDO para: Login.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";

// Asegúrate de que esta interfaz refleje EXACTAMENTE lo que tu backend devuelve en /login
interface LoginResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  plan: string;
  tipo_chat?: 'pyme' | 'municipio';
  entityToken?: string;
}

const Login = () => {
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await apiFetch<LoginResponse>("/login", {
        method: "POST",
        body: { email, password },
      });

      safeLocalStorage.setItem("authToken", data.token);
      if (data.entityToken) {
        safeLocalStorage.setItem("entityToken", data.entityToken);
      }

      await refreshUser();
      navigate("/perfil");

    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || "Credenciales inválidas.");
      } else {
        setError("No se pudo conectar con el servidor.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-xl border border-border">
        <h2 className="text-2xl font-bold mb-6 text-center text-foreground">
          Iniciar Sesión
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 text-base"
            disabled={isLoading}
          >
            {isLoading ? "Ingresando..." : "Iniciar Sesión"}
          </Button>
          <GoogleLoginButton className="mt-2" onLoggedIn={() => navigate('/perfil')} />
        </form>
        <div className="text-center text-sm text-muted-foreground mt-4">
          ¿No tenés cuenta?{" "}
          <button onClick={() => navigate("/register")} className="text-primary hover:underline">
            Registrate
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
