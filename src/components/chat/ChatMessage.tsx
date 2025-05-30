import React, { useState } from "react";
import { Message } from "@/types/chat";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [enviado, setEnviado] = useState(false);

  // Mensaje inválido
  if (!message || typeof message.text !== "string") {
    return (
      <div className="text-xs text-red-600 italic mt-2 px-3">
        ❌ Mensaje inválido o malformado.
      </div>
    );
  }

  // CTA especial
  if (message.text === "__cta__") {
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

  // Sugerencias
  if (message.text === "__sugerencia__" && message.originalQuestion) {
    return (
      <div className="flex justify-start px-2 mt-2">
        {/* ... tu lógica original de sugerencia ... */}
      </div>
    );
  }

  const isBot = message.isBot;

  return (
    <div
      className={`
        flex items-end gap-2 
        px-2 mt-2
        ${isBot ? "justify-start" : "justify-end"}
      `}
    >
      {/* Avatar o icono */}
      {isBot && (
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center border border-blue-300 shadow">
          <Bot className="w-5 h-5 text-blue-600 dark:text-blue-300" />
        </span>
      )}
      <div
        className={`
          max-w-[78vw] sm:max-w-[70%] p-3 rounded-2xl shadow
          text-sm break-words 
          ${isBot
            ? "bg-blue-100 text-gray-900 rounded-bl-none dark:bg-blue-900 dark:text-blue-50 border border-blue-200 dark:border-blue-800"
            : "bg-blue-600 text-white rounded-br-none border border-blue-700"}
          `}
        style={{ wordBreak: "break-word" }}
      >
        <div dangerouslySetInnerHTML={{ __html: message.text }} />
        <div className="text-xs mt-1 opacity-70 text-right">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      {/* Avatar del usuario */}
      {!isBot && (
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center border border-gray-300 shadow">
          <User className="w-5 h-5 text-gray-500 dark:text-gray-300" />
        </span>
      )}
    </div>
  );
};

export default ChatMessage;
