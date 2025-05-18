import React, { useState } from "react";
import { Message } from "@/types/chat";

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  console.log("🧾 ChatMessage received:", JSON.stringify(message));

  const [enviado, setEnviado] = useState(false);

  // 🟡 Caso especial: mostrar botones CTA
  if (message.text === "__cta__") {
    return (
      <div className="flex justify-center mt-4">
        <div className="text-center space-y-2">
          <button
            onClick={() => (window.location.href = "/demo")}
            className="px-4 py-2 text-sm bg-[#006AEC] text-white rounded-xl hover:bg-blue-700 transition font-medium shadow"
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
            className="px-4 py-2 text-sm border border-[#006AEC] text-[#006AEC] rounded-xl hover:bg-blue-50 transition font-medium"
          >
            Hablar por WhatsApp
          </button>
        </div>
      </div>
    );
  }

  // 🟠 Caso especial: sugerencia sin respuesta útil
  if (message.text === "__sugerencia__" && message.originalQuestion) {
    return (
      <div className="flex justify-start px-2">
        <div className="bg-yellow-100 text-black max-w-[75%] p-3 rounded-2xl shadow-sm rounded-bl-none">
          <p className="text-sm">🤔 No encontré una respuesta clara a:</p>
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

  // 🟢 Mensajes normales (bot o usuario)
  const isBot = message.isBot;

  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"} px-2`}>
      <div
        className={`max-w-[75%] p-3 rounded-2xl shadow-sm ${
          isBot
            ? "bg-blue-100 text-gray-900 rounded-bl-none"
            : "bg-[#006AEC] text-white rounded-br-none"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">
          {typeof message.text === "string"
            ? message.text
            : JSON.stringify(message)}
        </p>
        <p className="text-xs mt-1 opacity-70 text-right">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
