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
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-background via-card to-muted text-foreground"> {/* Ajustado min-h y padding */}
      <div className="w-full max-w-md bg-card p-6 sm:p-8 rounded-xl shadow-2xl border border-border"> {/* Reducido padding en móvil, aumentado shadow */}
        <h2 className="text-3xl font-bold mb-8 text-center text-foreground"> {/* Aumentado tamaño y margen */}
          Iniciar Sesión
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6"> {/* Aumentado space-y */}
          <Input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            sizeVariant="lg" // Usar variante de tamaño grande
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            sizeVariant="lg" // Usar variante de tamaño grande
            autoComplete="current-password"
          />
          {error && <p className="text-destructive text-sm text-center py-1">{error}</p>} {/* text-sm es ahora ~15px */}
          <Button
            type="submit"
            size="lg" // Usar nuestro Button size="lg"
            className="w-full text-base font-semibold" // Asegurar text-base y font-semibold
            disabled={isLoading}
          >
            {isLoading ? "Ingresando..." : "Iniciar Sesión"}
          </Button>
          {/* Asumimos que GoogleLoginButton internamente usará un Button grande o es estilizable */}
          <GoogleLoginButton className="mt-2" onLoggedIn={() => navigate('/perfil')} />
        </form>
        <div className="text-center text-base text-muted-foreground mt-6"> {/* text-base, aumentado mt */}
          ¿No tenés cuenta?{" "}
          <Button variant="link" size="default" onClick={() => navigate("/register")} className="text-base text-primary font-semibold"> {/* Convertido a Button link */}
            Registrate
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;
