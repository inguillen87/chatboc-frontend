import React from 'react';

const ConversationPanel: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Título del Ticket</h2>
      </div>
      <div className="flex-1 p-4">
        <p className="text-sm text-muted-foreground">Conversación, notas e historial aquí.</p>
      </div>
      <div className="p-4 border-t">
        <p className="text-sm text-muted-foreground">Input de chat aquí.</p>
      </div>
    </div>
  );
};

export default ConversationPanel;
