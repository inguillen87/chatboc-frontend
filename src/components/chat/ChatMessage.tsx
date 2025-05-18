import React from "react";
import { Message } from "@/types/chat";

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
    console.log("🧾 Render message:", message);

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
        <p className="text-sm">{message.text}</p>
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
