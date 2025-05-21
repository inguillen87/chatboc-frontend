import React, { useState, useEffect, useRef } from "react";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import { apiFetch } from "@/utils/api";

type Message = {
  text: string;
  sender: "user" | "bot";
};

const ChatWidget: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [rubros, setRubros] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Leer user desde localStorage
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
  }, []);

  // Traer rubros desde la API si no hay user
  useEffect(() => {
    if (!user) {
      apiFetch("/rubros", "GET")
        .then((data) => {
          const nombres = data.map((r: any) => r.nombre || r.name);
          setRubros(nombres);
        })
        .catch((err) => {
          console.error("❌ Error cargando rubros:", err);
        });
    }
  }, [user]);

  const handleRubroSeleccionado = (rubro: string) => {
    const anonUser = {
      token: "demo-token",
      name: "ANÓNIMO",
      rubro,
      plan: "demo",
    };
    localStorage.setItem("user", JSON.stringify(anonUser));
    setUser(anonUser);
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
    <div className="fixed bottom-0 right-4 z-50 w-80 h-[500px] bg-white border rounded-t-xl shadow-xl flex flex-col overflow-hidden">
      <ChatHeader />
      {!user ? (
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-sm font-semibold mb-2">
            ¿De qué rubro querés recibir respuestas?
          </h2>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {rubros.map((rubro) => (
              <li
                key={rubro}
                className="cursor-pointer text-blue-600 hover:underline"
                onClick={() => handleRubroSeleccionado(rubro)}
              >
                {rubro}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-2">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
          <ChatInput onSend={handleSend} />
        </>
      )}
    </div>
  );
};

export default ChatWidget;
