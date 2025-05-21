import React, { useState } from "react";
import { Message } from "@/types/chat";

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [enviado, setEnviado] = useState(false);

  // 🛡️ Protección general contra mensajes malformados
  if (!message || typeof message.text !== "string") return null;

  // 🔵 CTA final
  if (message.text === "__cta__") {
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

  // 🟡 Mensaje de sugerencia
  if (message.text === "__sugerencia__" && message.originalQuestion) {
    return (
      <div className="flex justify-start px-2 mt-2">
        <div className="bg-yellow-100 dark:bg-yellow-900 text-black dark:text-yellow-100 max-w-[75%] p-3 rounded-2xl shadow rounded-bl-none">
          <p className="text-sm font-medium">🤔 No encontré una respuesta clara a:</p>
          <p className="text-sm italic mt-1">"{message.originalQuestion}"</p>
          {!enviado ? (
            <button
              onClick={async () => {
                const user = JSON.parse(localStorage.getItem("user") || "null");
                await fetch("https://api.chatboc.ar/sugerencia", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${user?.token || ""}`,
                  },
                  body: JSON.stringify({
                    texto: message.originalQuestion,
                    rubro_id: user?.rubro_id || 1,
                  }),
                });
                setEnviado(true);
              }}
              className="mt-2 text-xs text-blue-700 underline hover:text-blue-900"
            >
              ➕ Enviar esta duda como sugerencia
            </button>
          ) : (
            <p className="text-xs text-green-700 mt-2">✅ ¡Gracias por tu sugerencia!</p>
          )}
        </div>
      </div>
    );
  }

  // 🟢 Mensaje normal (bot o usuario)
  const isBot = message.isBot;

  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"} px-2 mt-2`}>
      <div
        className={`max-w-[75%] p-3 rounded-2xl shadow-md text-sm whitespace-pre-wrap ${
          isBot
            ? "bg-blue-100 text-gray-900 rounded-bl-none dark:bg-blue-900 dark:text-white"
            : "bg-blue-600 text-white rounded-br-none"
        }`}
      >
        {message.text}

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
