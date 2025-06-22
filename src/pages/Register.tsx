import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import { apiFetch } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiFetch("/register", "POST", {
        name,
        email,
        password,
      });

      if (data && (data as any).token) {
        safeLocalStorage.setItem("user", JSON.stringify(data));
        navigate("/perfil");
      } else {
        console.error("Registro sin token:", data);
      }
    } catch (err) {
      console.error("❌ Error al registrar usuario:", err);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md border">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          Crear Cuenta
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
          <Button type="submit" className="w-full">
            Registrarme
          </Button>
          <GoogleLoginButton className="mt-2" />
        </form>
        <div className="text-center text-sm text-gray-600 mt-4">
          ¿Ya tenés cuenta?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-blue-600 hover:underline"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
