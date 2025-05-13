import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { apiFetch } from "@/utils/api";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const data = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("user", JSON.stringify(data));
      navigate("/perfil");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="flex-grow pt-28 pb-12 flex justify-center items-center">
        <form
          onSubmit={handleSubmit}
          className="bg-white shadow-md rounded-xl p-8 w-full max-w-md space-y-6 border"
        >
          <h1 className="text-2xl font-bold text-center text-primary">
            Iniciar Sesión
          </h1>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Correo electrónico</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Contraseña</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center font-medium">{error}</p>
          )}

          <Button variant="default" className="w-full">
            Entrar
          </Button>

          <div className="text-center text-sm text-muted-foreground mt-4">
            ¿No tenés cuenta?
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="text-primary font-semibold hover:underline ml-1"
            >
              Registrate
            </button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
};

export default Login;
