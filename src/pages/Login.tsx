// Contenido COMPLETO para: Login.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/utils/api";

interface LoginResponse {
  id: number;
  token: string;
  name: string;
  email: string;
}

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await apiFetch<LoginResponse>('/login', {
        method: 'POST',
        body: { email, password },
      });

      localStorage.setItem("authToken", data.token);

      const userProfileToStore = {
        id: data.id,
        name: data.name,
        email: data.email,
      };
      
      localStorage.setItem("user", JSON.stringify(userProfileToStore));

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
    // MODIFICADO: Fondo de la página de login
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-background text-foreground">
      {/* MODIFICADO: Contenedor del formulario */}
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-xl border border-border">
        <h2 className="text-2xl font-bold mb-6 text-center text-foreground"> {/* Usar text-foreground */}
          Iniciar Sesión
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* MODIFICADO: Input con bg-input y border-input, text-foreground, placeholder:text-muted-foreground */}
          <Input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          {error && <p className="text-destructive text-sm text-center">{error}</p>} {/* Usar text-destructive */}
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}> {/* Usar bg-primary */}
            {isLoading ? "Ingresando..." : "Iniciar Sesión"}
          </Button>
        </form>
        <div className="text-center text-sm text-muted-foreground mt-4"> {/* Usar text-muted-foreground */}
          ¿No tenés cuenta?{" "}
          <button onClick={() => navigate("/register")} className="text-primary hover:underline"> {/* Usar text-primary */}
            Registrate
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;