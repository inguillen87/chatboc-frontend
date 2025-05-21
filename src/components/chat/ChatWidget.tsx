import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { apiFetch } from "@/utils/api";

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      console.log("🧠 localStorage.getItem('user'):", storedUser);

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser?.token) {
            console.log("✅ Usuario cargado en ChatWidget:", parsedUser);
            setUser(parsedUser);
          } else {
            console.warn("⚠️ El objeto de usuario no tiene token");
          }
        } catch (e) {
          console.error("❌ Error parseando user de localStorage:", e);
        }
      } else {
        console.warn("⚠️ No hay user en localStorage");
      }
    }
  }, []);

  if (!user) {
    console.log("⛔ ChatWidget oculto: no hay usuario logueado.");
    return null;
  }

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
      const res = await apiFetch("/responder_chatboc", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: {
          pregunta: messageText,
          rubro: user.rubro || "general",
        },
      });

      setMessages([...updatedMessages, { text: res.respuesta, sender: "bot" }]);
    } catch (err) {
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
