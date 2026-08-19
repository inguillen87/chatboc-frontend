import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCheck,
  Mic,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Video,
} from 'lucide-react';

interface SimMessage {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
  isAudio?: boolean;
  audioDuration?: string;
}

const DEMO_CONVERSATION: SimMessage[] = [
  {
    id: 1,
    text: '\u00a1Hola! Soy el asistente virtual de la Municipalidad. \u00bfEn qu\u00e9 puedo ayudarte hoy?',
    isBot: true,
    timestamp: '10:30',
    status: 'read',
  },
  {
    id: 2,
    text: 'Hola, quiero hacer un reclamo por una luminaria rota en mi cuadra',
    isBot: false,
    timestamp: '10:31',
    status: 'read',
  },
  {
    id: 3,
    text: 'Entendido. Voy a registrar tu reclamo de *Alumbrado P\u00fablico*. \u00bfPodr\u00edas indicarme la direcci\u00f3n exacta donde se encuentra la luminaria da\u00f1ada?',
    isBot: true,
    timestamp: '10:31',
    status: 'read',
  },
  {
    id: 4,
    text: 'Av. San Mart\u00edn esquina Belgrano',
    isBot: false,
    timestamp: '10:32',
    status: 'read',
  },
  {
    id: 5,
    text: '\ud83d\udccd Perfecto. Registr\u00e9 la ubicaci\u00f3n en *Av. San Mart\u00edn esq. Belgrano*.\n\n\u00bfPodr\u00edas enviarnos una foto de la luminaria para que la cuadrilla pueda identificarla r\u00e1pidamente?',
    isBot: true,
    timestamp: '10:32',
    status: 'read',
  },
  {
    id: 6,
    text: '',
    isBot: false,
    timestamp: '10:33',
    status: 'read',
    isAudio: true,
    audioDuration: '0:12',
  },
  {
    id: 7,
    text: '\u2705 *Tu reclamo fue registrado con \u00e9xito.*\n\n\ud83c\udfab Ticket: *M-2024-0847*\n\ud83d\udccd Direcci\u00f3n: Av. San Mart\u00edn esq. Belgrano\n\ud83d\udca1 Categor\u00eda: Alumbrado P\u00fablico\n\ud83d\udcca Estado: En proceso\n\nTe avisaremos por este mismo chat cuando la cuadrilla est\u00e9 en camino. \u00a1Gracias por reportar!',
    isBot: true,
    timestamp: '10:33',
    status: 'read',
  },
];

const formatBoldText = (text: string) => {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(1, -1)}
        </strong>
      );
    }
    return part;
  });
};

const AudioWaveformSim: React.FC<{ isBot: boolean }> = ({ isBot }) => {
  const bars = 24;
  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isBot ? 'bg-[#128C7E] text-white' : 'bg-white/20 text-white'
        }`}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <div className="flex items-end gap-[2px] h-6 flex-1">
        {Array.from({ length: bars }).map((_, i) => {
          const h = Math.random() * 100;
          return (
            <div
              key={i}
              className={`w-[3px] rounded-full ${
                isBot ? 'bg-[#128C7E]/60' : 'bg-white/50'
              }`}
              style={{ height: `${Math.max(15, h)}%` }}
            />
          );
        })}
      </div>
      <span className={`text-[10px] ml-1 shrink-0 ${isBot ? 'text-gray-500' : 'text-white/70'}`}>
        0:12
      </span>
    </div>
  );
};

const StatusIcon: React.FC<{ status?: string }> = ({ status }) => {
  if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-gray-400" />;
  return <Check className="w-3.5 h-3.5 text-gray-400" />;
};

export const WhatsappChatSimulator: React.FC<{
  botName?: string;
  botAvatar?: string;
  className?: string;
}> = ({ botName = 'Chatboc Municipio', botAvatar, className = '' }) => {
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentMsgIndex >= DEMO_CONVERSATION.length) return;

    const msg = DEMO_CONVERSATION[currentMsgIndex];
    const delay = msg.isBot ? 800 + Math.random() * 400 : 1200 + Math.random() * 600;

    if (msg.isBot && currentMsgIndex > 0) {
      setIsTyping(true);
      const typingTimer = setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, msg]);
        setCurrentMsgIndex((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(typingTimer);
    }

    const timer = setTimeout(() => {
      setMessages((prev) => [...prev, msg]);
      setCurrentMsgIndex((prev) => prev + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [currentMsgIndex]);

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isTyping]);

  return (
    <div
      className={`w-full max-w-[420px] mx-auto rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 ${className}`}
    >
      {/* Header */}
      <div className="bg-[#075E54] dark:bg-[#1F2C34] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#128C7E] flex items-center justify-center text-white font-bold text-sm shrink-0">
          {botAvatar ? (
            <img src={botAvatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            botName.charAt(0)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white text-sm font-semibold truncate">{botName}</h3>
          <p className="text-emerald-200 text-[11px]">
            {isTyping ? 'escribiendo...' : 'en l\u00ednea'}
          </p>
        </div>
        <div className="flex items-center gap-4 text-white/80">
          <Video className="w-5 h-5" />
          <Phone className="w-5 h-5" />
          <Search className="w-5 h-5" />
        </div>
      </div>

      {/* Chat Area */}
      <div
        ref={containerRef}
        className="h-[480px] overflow-y-auto p-3 space-y-1.5"
        style={{
          backgroundColor: '#ECE5DD',
        }}
      >
        {/* Date separator */}
        <div className="flex justify-center mb-3">
          <span className="bg-white/90 text-gray-600 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">
            HOY
          </span>
        </div>

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-1.5 shadow-sm relative ${
                  msg.isBot
                    ? 'bg-white text-gray-900 rounded-tl-sm'
                    : 'bg-[#DCF8C6] text-gray-900 rounded-tr-sm'
                }`}
              >
                {msg.isAudio ? (
                  <AudioWaveformSim isBot={msg.isBot} />
                ) : (
                  <p className="text-[13px] leading-[18px] whitespace-pre-line">
                    {formatBoldText(msg.text)}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-0.5 justify-end">
                  <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
                  {!msg.isBot && <StatusIcon status={msg.status} />}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white rounded-xl rounded-tl-sm px-4 py-2 shadow-sm">
              <div className="flex items-center gap-1">
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                  className="w-2 h-2 rounded-full bg-gray-400"
                />
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                  className="w-2 h-2 rounded-full bg-gray-400"
                />
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                  className="w-2 h-2 rounded-full bg-gray-400"
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-[#F0F0F0] dark:bg-[#1F2C34] px-2 py-2 flex items-center gap-2">
        <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
          <Smile className="w-5 h-5" />
        </button>
        <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
          <Paperclip className="w-5 h-5" />
        </button>
        <div className="flex-1 bg-white dark:bg-[#2A3942] rounded-3xl px-4 py-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escrib\u00ed un mensaje..."
            className="w-full text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
        <button className="w-10 h-10 rounded-full bg-[#128C7E] text-white flex items-center justify-center hover:bg-[#075E54] transition-colors active:scale-95">
          {inputText ? <Send className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

export default WhatsappChatSimulator;
