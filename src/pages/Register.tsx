import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { apiFetch } from "@/utils/api";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const data = await apiFetch("/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      setSuccess("✅ Registro exitoso. Iniciá sesión.");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="flex-grow pt-28 pb-12 flex items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="bg-white shadow-md rounded-xl p-8 w-full max-w-md space-y-6 border"
        >
          <h1 className="text-2xl font-bold text-center text-primary">
            Crear Cuenta
          </h1>

          <div className="space-y-1">
            <label htmlFor="name" className="block text-sm font-medium">
              Nombre completo
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium">
              Correo electrónico
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center font-medium">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-600 text-center font-medium">
              {success}
            </p>
          )}

          <Button type="submit" className="w-full">
            Crear Cuenta
          </Button>

          <div className="text-center text-sm text-muted-foreground mt-4">
            ¿Ya tenés cuenta?
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-primary font-semibold hover:underline ml-1"
            >
              Iniciá sesión
            </button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
};

export default Register;
