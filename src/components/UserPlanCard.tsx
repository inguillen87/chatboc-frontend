import React from "react";

interface UserData {
  name: string;
  plan: string;
  preguntas_usadas: number;
}

const planLimits: Record<string, number> = {
  free: 10,
  starter: 300,
  pro: 1000,
  enterprise: Infinity,
};

const UserPlanCard: React.FC = () => {
  const path = window.location.pathname;
  const isRutaPublica = ["/", "/demo", "/login", "/register"].some((r) => path.startsWith(r));

  const storedUser = localStorage.getItem("user");
  const user: UserData | null = storedUser ? JSON.parse(storedUser) : null;

  // 👇 Ocultar si está en ruta pública o si no hay usuario logueado
  if (!user || isRutaPublica) return null;

  const limit = planLimits[user.plan] ?? 10;

  return (
    <div className="fixed bottom-4 right-4 z-40 p-4 border rounded-lg bg-white shadow text-sm w-72">
      <h2 className="text-lg font-semibold mb-2">👋 Hola {user.name}</h2>
      <p>📄 Tu plan actual: <strong>{user.plan}</strong></p>
      <p>💬 Consultas usadas: <strong>{user.preguntas_usadas}</strong> / {limit === Infinity ? '∞' : limit}</p>

      {user.plan === "free" && (
        <div className="mt-3 bg-yellow-100 text-yellow-800 p-2 rounded">
          Has alcanzado el límite gratuito. <br />
          <button className="mt-1 text-blue-600 underline hover:font-semibold">
            Upgradear plan
          </button>
        </div>
      )}
    </div>
  );
};

export default UserPlanCard;
