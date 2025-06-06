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
  
  // --- MEJORA: Añadimos un estado de carga ---
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Si ya está logueado, redirigir automáticamente
    const storedToken = localStorage.getItem("authToken");
    if (storedToken) {
      navigate("/perfil"); // O a tu panel de tickets
    }

    // Scroll automático al centro
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true); // --- MEJORA: Activamos el estado de carga

    try {
      const data = await apiFetch("/login", "POST", { email, password });

      if (data?.token && data?.email && data?.plan) {
        
        // --- INICIO DE LA CORRECCIÓN PRINCIPAL ---

        // 1. Creamos el objeto 'userProfile' para guardar en localStorage, SIN el token.
        const userProfile = {
          name: data.name,
          email: data.email,
          plan: data.plan,
          preguntas_usadas: data.preguntas_usadas ?? 0,
          limite_preguntas: data.limite_preguntas ?? 50,
        };

        // 2. Guardamos el perfil del usuario bajo la clave "user".
        localStorage.setItem("user", JSON.stringify(userProfile));

        // 3. Guardamos el TOKEN por separado bajo la clave "authToken".
        //    Esta es la clave que tu apiService está esperando.
        localStorage.setItem("authToken", data.token);

        // --- FIN DE LA CORRECCIÓN PRINCIPAL ---

        // 4. Redirigimos al usuario.
        navigate("/perfil"); // O a la ruta de tu panel de tickets

      } else {
        setError("❌ Credenciales inválidas o datos incompletos.");
      }
    } catch (err) {
      console.error("❌ Error al iniciar sesión:", err);
      setError("⚠️ Error de conexión con el servidor.");
    } finally {
        setIsLoading(false); // --- MEJORA: Desactivamos el estado de carga
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
            disabled={isLoading} // --- MEJORA: Deshabilitamos input durante la carga
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading} // --- MEJORA: Deshabilitamos input durante la carga
          />
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {/* --- MEJORA: Cambiamos el texto del botón al cargar --- */}
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