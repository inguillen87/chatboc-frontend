import React from "react";
import ChatWidget from "@/components/chat/ChatWidget"; // Asegúrate que la ruta sea correcta

const Iframe = () => (
  <div style={{
    width: "100vw",
    height: "100vh",
    background: "transparent",
    margin: 0,
    padding: 0,
    overflow: "hidden",
  }}>
    <ChatWidget mode="iframe" />
  </div>
);

export default Iframe;