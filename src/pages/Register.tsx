import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/utils/api";

const rubros = [
  { id: 1, nombre: "Médico" },
  { id: 2, nombre: "Bodega" },
  { id: 3, nombre: "Almacén y Minimarket" },
];

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rubroId, setRubroId] = useState(1);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const data = await apiFetch("/register", "POST", {
        name,
        email,
        password,
        rubro_id: rubroId,
      });

      if (data?.token) {
        localStorage.setItem("user", JSON.stringify(data));
        navigate("/perfil");
      } else {
        setError("❌ Error al registrar. Verificá los datos.");
      }
    } catch (err) {
      console.error("❌ Error en registro:", err);
      setError("⚠️ Error de conexión con el servidor.");
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

          <select
            value={rubroId}
            onChange={(e) => setRubroId(parseInt(e.target.value))}
            className="w-full p-2 border rounded text-sm text-gray-700"
            required
          >
            {rubros.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <Button type="submit" className="w-full">
            Registrarme
          </Button>
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
