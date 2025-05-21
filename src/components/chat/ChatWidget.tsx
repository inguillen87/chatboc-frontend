import React, { useState, useEffect, useRef } from "react";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { apiFetch } from "@/utils/api";
import { useLocation } from "react-router-dom";

type Message = {
  text: string;
  sender: "user" | "bot";
};

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.token) {
          setUser(parsedUser);
        }
      }
    } catch (e) {
      console.error("❌ Error leyendo user desde localStorage:", e);
    }
  }, [location]);

  if (!user) return null;

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const handleSend = async (messageText: string) => {
    const newMessage: Message = { text: messageText, sender: "user" };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      const response = await apiFetch(
        "/responder_chatboc",
        "POST",
        {
          pregunta: messageText,
          rubro: user.rubro || "general",
        },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      setMessages([
        ...updatedMessages,
        { text: response.respuesta, sender: "bot" },
      ]);
    } catch (error) {
      console.error("❌ Error en handleSend:", error);
      setMessages([
        ...updatedMessages,
        {
          text: "⚠️ Hubo un error al procesar tu pregunta. Intentá nuevamente.",
          sender: "bot",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <div
        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg cursor-pointer"
        onClick={toggleChat}
      >
        💬
      </div>

      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 h-[450px] bg-white border rounded-xl shadow-xl flex flex-col overflow-hidden">
          <ChatHeader onClose={toggleChat} />
          <div className="flex-1 overflow-y-auto p-2">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
          <ChatInput onSend={handleSend} />
        </div>
      )}
    </>
  );
};

export default ChatWidget;
