// En ChatMessage.tsx

import React, { useState } from "react";
import { Message } from "@/types/chat";

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [enviado, setEnviado] = useState(false);

  // Tu lógica existente para mensajes inválidos o "__cta__"
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-red-600 italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }

 if (message.text === "__cta__") {
  // ... (tu lógica para el Call To Action especial se mantiene igual)
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (user?.token) return null;

  return (
    <div className="flex justify-center mt-4">
      <div className="text-center space-y-2">
        <button
          onClick={() => (window.location.href = "/demo")}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium shadow"
        >
          Usar Chatboc en mi empresa
        </button>
        <button
          onClick={() =>
            window.open(
              "https://wa.me/5492613168608?text=Hola! Estoy probando Chatboc y quiero implementarlo en mi empresa.",
              "_blank"
            )
          }
          className="px-4 py-2 text-sm border border-blue-600 text-blue-600 rounded-xl hover:bg-blue-50 transition font-medium"
        >
          Hablar por WhatsApp
        </button>
      </div>
    </div>
  );
}

  // Tu lógica para el mensaje de sugerencia se mantiene igual
  if (message.text === "__sugerencia__" && message.originalQuestion) {
    // ... (tu lógica para el mensaje de sugerencia se mantiene igual)
    return (
      <div className="flex justify-start px-2 mt-2">
        {/* ... tu JSX para sugerencia ... */}
      </div>
    );
  }

  const isBot = message.isBot;

  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"} px-2 mt-2`}>
      <div
        className={`max-w-[75%] p-3 rounded-2xl shadow-md text-sm ${ // Quitado whitespace-pre-wrap si el HTML maneja los saltos
          isBot
            ? "bg-blue-100 text-gray-900 rounded-bl-none dark:bg-blue-900 dark:text-white"
            : "bg-blue-600 text-white rounded-br-none"
        }`}
      >
        {/* MODIFICACIÓN AQUÍ para renderizar HTML */}
        <div dangerouslySetInnerHTML={{ __html: message.text }} />
        
        <div className="text-xs mt-1 opacity-70 text-right">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;