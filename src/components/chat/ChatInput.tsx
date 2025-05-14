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
    if (inputValue.trim() === "") return;
    onSendMessage(inputValue.trim());
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Escribí tu mensaje..."
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006AEC]"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        <Button
          onClick={handleSend}
          className="bg-[#006AEC] text-white px-3 py-2 rounded-xl hover:bg-blue-700 transition"
          disabled={inputValue.trim() === ""}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 text-xs text-gray-500 text-center">
        Probá con: “¿Qué hace Chatboc?” o “¿Cuánto cuesta?”
      </div>
    </div>
  );
};

export default ChatInput;
