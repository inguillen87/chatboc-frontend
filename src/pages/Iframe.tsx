import React from "react";
import ChatWidget from "@/components/chat/ChatWidget";

// Esta versión NO inyecta NADA de fondo. Es 100% transparente y NO trae Layout global ni otros providers.
// Así, si lo usás en un iframe externo (en otra web o plataforma), no va a duplicar ningún panel.

const Iframe = () => (
  <div style={{
    width: "100vw",
    height: "100vh",
    background: "transparent",
    margin: 0,
    padding: 0,
    overflow: "hidden",
    // No agregamos nada de color ni box, así no mete ni sombra ni overlay extra.
  }}>
    <ChatWidget />
  </div>
);

export default Iframe;
