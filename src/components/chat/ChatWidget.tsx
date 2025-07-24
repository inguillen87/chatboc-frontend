import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Mic, Send, MapPin } from 'lucide-react';
import io from 'socket.io-client';

const socket = io('http://localhost:3001'); // Reemplaza con la URL de tu servidor de sockets

const ChatWidget = ({ primaryColor = '#007bff', logoUrl = '', position = 'right', user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const chatBodyRef = useRef(null);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });

    socket.on('new_comment', (data) => {
      setMessages((prevMessages) => [...prevMessages, data.comment]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_comment');
    };
  }, []);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;
    const newMessage = {
      id: Date.now(),
      comentario: inputValue,
      fecha: new Date().toISOString(),
      es_admin: false,
    };
    socket.emit('new_comment', { ticketId: 1, comment: newMessage }); // Reemplaza con el ID del ticket actual
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
        // socket.emit('new_comment', { ticketId: 1, comment: newMessage }); // Reemplaza con el ID del ticket actual
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newMessage = {
          id: Date.now(),
          comentario: '',
          fecha: new Date().toISOString(),
          es_admin: false,
          attachment: {
            type: file.type,
            url: event.target.result,
          },
        };
        setMessages([...messages, newMessage]);
      };
      reader.readAsDataURL(file);
    }
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
          <h2 className="text-lg font-semibold">{user?.name || 'Chatboc'}</h2>
          <button onClick={togglePanel}>
            <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div ref={chatBodyRef} className="chat-widget-body flex-grow p-4 overflow-y-auto">
          {user && (
            <div className="text-center p-4 border-b">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
              {user.telefono && (
                <a href={`https://wa.me/${user.telefono}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                  {user.telefono}
                </a>
              )}
            </div>
          )}
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.es_admin ? 'justify-start' : 'justify-end'} mb-2`}>
              <div className={`p-2 rounded-lg ${!message.es_admin ? 'text-white' : 'bg-gray-200'}`} style={{ backgroundColor: !message.es_admin ? primaryColor : '#f3f4f6' }}>
                {message.comentario}
                {message.attachment && (
                  <img src={message.attachment.url} alt="attachment" className="max-w-xs max-h-48 mt-2 rounded-lg" />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="chat-widget-footer p-4 bg-gray-100 rounded-b-lg">
          <div className="flex items-center">
            <input
              className="w-full p-2 border border-gray-300 rounded-lg"
              type="text"
              placeholder="Escribe un mensaje..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <label className="p-2 text-gray-600 hover:text-blue-600 cursor-pointer">
              <Paperclip />
              <input type="file" className="hidden" onChange={handleFileChange} />
            </label>
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
