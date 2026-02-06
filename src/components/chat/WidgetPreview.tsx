import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MessageCircle, MoreVertical, Paperclip, Smile, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- TYPES ---
interface WidgetPreviewProps {
  tenantSlug: string;
  defaultOpen?: boolean;
  primaryColor?: string;
  accentColor?: string;
  userMsgColor?: string;
  chatBackground?: string;
  borderRadius?: number;
  ctaMessage?: string;
  botName?: string;
  logoUrl?: string;
  welcomeMessage?: string;
  logoAnimation?: string; // 'none', 'pulse', 'bounce', 'fade'
  fontFamily?: string;
}

// --- MOCK DATA ---
const MOCK_MESSAGES = [
  { id: 1, text: '¡Hola! 👋 Bienvenido.', sender: 'bot', timestamp: new Date(Date.now() - 60000) },
  { id: 2, text: '¿En qué puedo ayudarte hoy?', sender: 'bot', timestamp: new Date(Date.now() - 55000) },
  // User messages will be added dynamically for "live" feel
];

const WidgetPreview: React.FC<WidgetPreviewProps> = ({
  tenantSlug,
  defaultOpen = true,
  primaryColor = '#007aff',
  accentColor = '#005bb5',
  userMsgColor = '#005bb5',
  chatBackground = '#ffffff',
  borderRadius = 16,
  ctaMessage = '¿Tenés alguna duda?',
  botName = 'Asistente Virtual',
  logoUrl,
  welcomeMessage = '¡Hola! ¿En qué puedo ayudarte hoy?',
  logoAnimation = 'pulse',
  fontFamily = 'Inter',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync open state with prop
  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  // Update welcome message if changed
  useEffect(() => {
    setMessages((prev) => {
        const newMsgs = [...prev];
        if (newMsgs.length > 0 && newMsgs[0].sender === 'bot') {
             // Keep the welcome message fresh if props change
             if (welcomeMessage) newMsgs[0] = { ...newMsgs[0], text: welcomeMessage };
        }
        return newMsgs;
    });
  }, [welcomeMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMsg = {
        id: Date.now(),
        text: inputValue,
        sender: 'user',
        timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Simulate bot reply
    setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
            id: Date.now() + 1,
            text: 'Gracias por tu mensaje. Esto es solo una vista previa.',
            sender: 'bot',
            timestamp: new Date()
        }]);
    }, 1500);
  };

  const containerStyle = {
    fontFamily: fontFamily || 'Inter, sans-serif',
    '--primary': primaryColor,
    '--accent': accentColor,
    '--bg': chatBackground,
    '--radius': `${borderRadius}px`,
    '--user-msg-bg': userMsgColor,
  } as React.CSSProperties;

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    exit: { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } }
  };

  const bubbleVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 25 } }
  };

  const logoAnim = {
      pulse: { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 2 } },
      bounce: { y: [0, -5, 0], transition: { repeat: Infinity, duration: 1.5 } },
      fade: { opacity: [0.8, 1, 0.8], transition: { repeat: Infinity, duration: 2 } },
      none: {}
  };

  return (
    <div className="w-full h-full relative flex flex-col justify-end items-end p-4 overflow-hidden pointer-events-auto" style={containerStyle}>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full h-full max-h-[600px] flex flex-col rounded-[var(--radius)] shadow-2xl overflow-hidden bg-[var(--bg)] border border-black/5"
          >
            {/* HEADER */}
            <div className="p-4 flex items-center justify-between shadow-sm z-10" style={{ background: primaryColor }}>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <motion.div
                            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/30"
                            animate={logoAnim[logoAnimation as keyof typeof logoAnim] || {}}
                        >
                            {logoUrl ? (
                                <img src={logoUrl} alt="Bot Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <MessageCircle className="w-6 h-6 text-white" />
                            )}
                        </motion.div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[var(--primary)] rounded-full"></div>
                    </div>
                    <div className="text-white">
                        <h3 className="font-bold text-sm leading-tight">{botName}</h3>
                        <p className="text-[10px] opacity-90 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                            En línea ahora
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-white/80">
                    <button className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><MoreVertical className="w-4 h-4" /></button>
                    <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
            </div>

            {/* MESSAGES AREA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 scroll-smooth">
                <div className="text-center text-xs text-muted-foreground my-4">
                    <span className="bg-slate-200/50 px-2 py-1 rounded-full">Hoy</span>
                </div>

                {messages.map((msg) => (
                    <motion.div
                        key={msg.id}
                        variants={bubbleVariants}
                        initial="hidden"
                        animate="visible"
                        className={cn(
                            "max-w-[85%] rounded-2xl p-3 text-sm shadow-sm relative group",
                            msg.sender === 'user'
                                ? "ml-auto text-white rounded-br-none"
                                : "mr-auto bg-white text-slate-800 border border-slate-100 rounded-bl-none"
                        )}
                        style={msg.sender === 'user' ? { backgroundColor: userMsgColor } : {}}
                    >
                        {msg.text}
                        <span className={cn(
                            "text-[10px] absolute bottom-1 right-2 opacity-0 group-hover:opacity-60 transition-opacity",
                            msg.sender === 'user' ? "text-white" : "text-slate-400"
                        )}>
                            {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </motion.div>
                ))}

                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-1 w-fit bg-white border border-slate-100 p-3 rounded-2xl rounded-bl-none shadow-sm"
                    >
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA */}
            <div className="p-3 bg-white border-t border-slate-100">
                <div className="flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 border border-transparent focus-within:border-[var(--primary)] focus-within:bg-white transition-all">
                    <button className="text-slate-400 hover:text-[var(--primary)] transition-colors"><Smile className="w-5 h-5" /></button>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-slate-400 text-slate-800"
                    />
                    <button className="text-slate-400 hover:text-[var(--primary)] transition-colors"><Paperclip className="w-4 h-4" /></button>
                    {inputValue.trim() && (
                        <motion.button
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            onClick={handleSend}
                            className="bg-[var(--primary)] text-white p-1.5 rounded-full shadow-sm hover:brightness-110 transition-all"
                        >
                            <Send className="w-4 h-4 ml-0.5" />
                        </motion.button>
                    )}
                </div>
                <div className="flex justify-center mt-2">
                    <p className="text-[10px] text-slate-300 flex items-center gap-1">
                        Powered by <span className="font-bold text-slate-400">ChatBoc AI</span>
                    </p>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING BUTTON (CTA) */}
      <AnimatePresence>
        {!isOpen && (
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute bottom-4 right-4 flex items-end gap-3 z-50"
            >
                {/* CTA BUBBLE */}
                {ctaMessage && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white px-4 py-2 rounded-2xl rounded-br-sm shadow-lg border border-slate-100 text-sm font-medium text-slate-700 max-w-[200px] hidden md:block"
                    >
                        {ctaMessage}
                        <div className="absolute -bottom-[1px] -right-[6px] w-3 h-3 bg-white border-b border-r border-slate-100 transform rotate-45"></div>
                    </motion.div>
                )}

                {/* LAUNCHER BUTTON */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white relative group"
                    style={{ backgroundColor: primaryColor }}
                >
                    <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-20"></div>
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover rounded-full p-0.5" />
                    ) : (
                        <MessageCircle className="w-7 h-7" />
                    )}
                    {/* Notification Badge */}
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></div>
                </motion.button>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WidgetPreview;
