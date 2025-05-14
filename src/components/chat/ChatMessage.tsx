// src/components/ChatMessage.tsx
import React from "react";
import { Message } from "@/types/chat";

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isBot = message.isBot;

  const formattedTime = React.useMemo(() => {
    return new Date(message.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [message.timestamp]);

  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"} w-full`}>
      <div className="flex items-end space-x-2">
        {isBot && (
          <img
            src="/chatboc_widget_64x64.webp"
            alt="Chatboc"
            aria-label="Avatar del asistente Chatboc"
            className="w-6 h-6 rounded-full"
          />
        )}

        <div className="flex flex-col max-w-[90%] sm:max-w-[75%]">
          <div
            className={`px-4 py-2 rounded-xl text-sm shadow-sm break-words ${
              isBot
                ? "bg-gray-100 text-gray-800"
                : "bg-blue-500 text-white self-end"
            }`}
          >
            {message.text}
          </div>
          <span
            className={`text-xs mt-1 ${
              isBot ? "text-gray-500" : "text-blue-300 self-end"
            }`}
          >
            {formattedTime}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
