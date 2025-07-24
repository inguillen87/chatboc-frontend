import React, { useState, useCallback } from 'react';
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import ChatHeader from "./ChatHeader";

const SelfContainedWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleChat = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    return (
        <div className={`chatboc-widget-container ${isOpen ? 'open' : ''}`}>
            {!isOpen && (
                <div className="chatboc-bubble" onClick={toggleChat}>
                    <ChatbocLogoAnimated size={32} />
                </div>
            )}
            {isOpen && (
                <div className="chatboc-panel">
                    <ChatHeader onClose={toggleChat} />
                    <div className="chatboc-body">
                        {/* Chat messages will go here */}
                    </div>
                    <div className="chatboc-footer">
                        <input type="text" placeholder="Escribe un mensaje..." />
                        <button>Enviar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(SelfContainedWidget);
