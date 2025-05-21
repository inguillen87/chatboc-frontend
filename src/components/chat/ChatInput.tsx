import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage }) => {
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSend = () => {
    const message = inputValue.trim();
    if (message.length === 0) return;
    onSendMessage(message);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-white dark:bg-blue-950 border-gray-200 dark:border-blue-800 px-4 py-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Escribí tu mensaje..."
          className="flex-1 rounded-xl px-4 py-2 text-sm border border-gray-300 dark:border-blue-700 bg-white dark:bg-blue-900 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          aria-label="Escribir mensaje"
          autoComplete="off"
        />
        <Button
          onClick={handleSend}
          disabled={inputValue.trim().length === 0}
          className="bg-blue-600 text-white hover:bg-blue-700 transition px-3 py-2 rounded-xl"
          aria-label="Enviar mensaje"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
        💡 Probá con: “¿Qué hace Chatboc?” o “¿Cuánto cuesta?”
      </p>
    </div>
  );
};

export default ChatInput;
