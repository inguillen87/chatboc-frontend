import React from "react";

const EnvironmentBadge: React.FC = () => {
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;

  let userName = "ANÓNIMO";
  try {
    const user = storedUser ? JSON.parse(storedUser) : null;
    if (user?.name) userName = user.name;
  } catch (e) {
    console.warn("Error al leer user desde localStorage");
  }

  return (
    <div className={`fixed top-2 right-2 z-50 text-xs px-3 py-2 rounded shadow-md ${
      demoMode
        ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
        : "bg-green-100 text-green-800 border border-green-300"
    }`}>
      {demoMode ? "🟡 MODO DEMO" : "🟢 MODO REAL"} · 👤 {userName}
    </div>
  );
};

export default EnvironmentBadge;
