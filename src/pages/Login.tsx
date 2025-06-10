// Contenido COMPLETO y CORREGIDO para: Login.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/utils/api";

// Asegúrate de que esta interfaz refleje EXACTAMENTE lo que tu backend devuelve en /login
interface LoginResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  plan: string; // <<<<<<<<<<<<<< AÑADIDO: Asumo que el backend devuelve el plan
  // También podríamos agregar otras propiedades del user si el backend las devuelve,
  // como 'rubro', etc., para tener un objeto 'user' completo en localStorage.
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

      // ¡Aquí está la CLAVE! Guardar el token y el plan junto con el resto de los datos del usuario.
      const userToStore = {
        id: data.id,
        name: data.name,
        email: data.email,
        token: data.token, // <<<<<<<<<<<<<< INCLUYE EL TOKEN AQUÍ
        plan: data.plan || "free", // <<<<<<<<<<<<<< INCLUYE EL PLAN AQUÍ (o "free" si el backend no lo envía)
      };
      
      localStorage.setItem("user", JSON.stringify(userToStore));
      localStorage.setItem("authToken", data.token); // Sigue guardándolo por separado para consistencia si otros módulos lo esperan.

      navigate("/perfil"); // O a donde corresponda después del login exitoso

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
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-background text-foreground">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-xl border border-border">
        <h2 className="text-2xl font-bold mb-6 text-center text-foreground">
          Iniciar Sesión
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
            {isLoading ? "Ingresando..." : "Iniciar Sesión"}
          </Button>
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