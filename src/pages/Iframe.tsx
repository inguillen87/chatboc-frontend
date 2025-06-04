import React from "react";
import ChatWidget from "@/components/chat/ChatWidget"; // Ajusta la ruta si es necesario

const Iframe = () => (
  <div style={{
    width: "100vw",
    height: "100vh",
    background: "transparent", // El iframe wrapper es transparente
    margin: 0,
    padding: 0,
    overflow: "hidden", // Evita scrollbars en el body del iframe
  }}>
    {/* ChatWidget.tsx ahora ocupará este espacio y tendrá su propio fondo */}
    <ChatWidget />
  </div>
);

export default Iframe;