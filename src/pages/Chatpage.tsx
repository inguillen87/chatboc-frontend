import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Message } from '@/types/chat';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import TypingIndicator from '@/components/TypingIndicator';
import { apiFetch } from '@/utils/api';

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [remainingQuestions, setRemainingQuestions] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    } else {
      // Obtener cantidad de preguntas restantes
      apiFetch('/questions_remaining', 'GET')
        .then((data) => {
          setRemainingQuestions(data.remaining);
        })
        .catch(() => {
          setRemainingQuestions(null);
        });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      const response = await apiFetch('/chat', 'POST', {
        messages: updatedMessages,
      });

      const botReply: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
      };

      setMessages([...updatedMessages, botReply]);
      if (typeof response.remaining === 'number') {
        setRemainingQuestions(response.remaining);
      }
    } catch (error) {
      setMessages([
        ...updatedMessages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Lo siento, hubo un error procesando tu mensaje.',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-center mb-4">Tu Asistente Virtual</h1>
        {remainingQuestions !== null && (
          <p className="text-center text-sm text-gray-600 mb-4">
            Preguntas restantes: {remainingQuestions}
          </p>
        )}
        <div className="border rounded-lg bg-white shadow-md p-4 h-[500px] overflow-y-auto">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
};

export default ChatPage;
