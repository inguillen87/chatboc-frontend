import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Mic, Send, MapPin } from 'lucide-react';
import pusher from '@/pusher';

const ChatWidget = ({ primaryColor = '#007bff', logoUrl = '', position = 'right', user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatBodyRef = useRef(null);

  useEffect(() => {
    const channel = pusher.subscribe('chat');

    channel.bind('new-message', (data) => {
      setMessages((prevMessages) => [...prevMessages, data.message]);
    });

    channel.bind('typing', () => {
      setIsTyping(true);
    });

    channel.bind('stop-typing', () => {
      setIsTyping(false);
    });

    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }

    return () => {
      pusher.unsubscribe('chat');
    };
  }, [messages]);

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    pusher.trigger('chat', 'typing', { user });
  };

  const handleInputBlur = () => {
    pusher.trigger('chat', 'stop-typing', { user });
  };

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;
    const newMessage = {
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages([...messages, newMessage]);
    setInputValue('');
  };

  const handleSendLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const newMessage = {
          text: `Mi ubicación: ${latitude}, ${longitude}`,
          sender: 'user',
          timestamp: new Date(),
        };
        setMessages([...messages, newMessage]);
      });
    }
  };

  const widgetStyle = {
    right: position === 'right' ? '1.25rem' : 'auto',
    left: position === 'left' ? '1.25rem' : 'auto',
  };

  const launcherStyle = {
    backgroundColor: primaryColor,
  };

  return (
    <div className="fixed bottom-5 z-50" style={widgetStyle}>
      <div
        className={`chat-widget-launcher w-16 h-16 rounded-full flex items-center justify-center cursor-pointer shadow-lg transform transition-transform duration-300 ${isOpen ? 'scale-0' : 'scale-100'}`}
        onClick={togglePanel}
        style={launcherStyle}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="logo" className="w-10 h-10 rounded-full" />
        ) : (
          <svg className="w-8 h-8 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </div>
      <div className={`chat-widget-panel w-96 h-[600px] bg-white rounded-lg shadow-xl flex flex-col transform transition-transform duration-300 ${isOpen ? 'scale-100' : 'scale-0'}`}>
        <div className="chat-widget-header p-4 bg-gray-100 rounded-t-lg flex justify-between items-center" style={{ backgroundColor: primaryColor, color: 'white' }}>
          <h2 className="text-lg font-semibold">Chatboc</h2>
          <button onClick={togglePanel}>
            <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div ref={chatBodyRef} className="chat-widget-body flex-grow p-4 overflow-y-auto">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
              <div className={`p-2 rounded-lg ${message.sender === 'user' ? 'text-white' : 'bg-gray-200'}`} style={{ backgroundColor: message.sender === 'user' ? primaryColor : '#f3f4f6' }}>
                {message.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start mb-2">
              <div className="p-2 rounded-lg bg-gray-200">
                ...
              </div>
            </div>
          )}
        </div>
        <div className="chat-widget-footer p-4 bg-gray-100 rounded-b-lg">
          <div className="flex items-center">
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="text"
              placeholder="Escribe un mensaje..."
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button className="p-2 text-gray-600 hover:text-blue-600">
              <Paperclip />
            </button>
            <button className="p-2 text-gray-600 hover:text-blue-600">
              <Mic />
            </button>
            <button onClick={handleSendLocation} className="p-2 text-gray-600 hover:text-blue-600">
              <MapPin />
            </button>
            <button onClick={handleSendMessage} className="p-2 text-white rounded-full ml-2" style={{ backgroundColor: primaryColor }}>
              <Send />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;
