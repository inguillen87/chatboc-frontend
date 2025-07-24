import React, { useState, useCallback } from 'react';

const SimpleChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleChat = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    return (
        <div className={`simple-chat-widget-container ${isOpen ? 'open' : ''}`}>
            <div className="simple-chat-widget-bubble" onClick={toggleChat}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div className="simple-chat-widget-panel">
                <div className="simple-chat-widget-header">
                    <h3>Chatboc</h3>
                    <button onClick={toggleChat}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className="simple-chat-widget-body">
                    {/* Chat messages will go here */}
                </div>
                <div className="simple-chat-widget-footer">
                    <input type="text" placeholder="Escribe un mensaje..." />
                    <button>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(SimpleChatWidget);
