import React, { useState } from 'react';
import { TicketListPane } from './TicketListPane';
import { TicketConversationPane } from './TicketConversationPane';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

export const TicketInboxPage: React.FC = () => {
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>();

  // Mock data for initial scaffolding
  const mockTickets = [
    { id: "T-1001", title: "Problema con la calle San Martin", status: "nuevo", category: "Vialidad", lastMessageAt: new Date().toISOString(), unreadCount: 2 },
    { id: "T-1002", title: "Consulta sobre facturación pyme", status: "en_proceso", category: "Comercio", lastMessageAt: new Date(Date.now() - 3600000).toISOString(), unreadCount: 0 }
  ];

  return (
    <div className="flex w-full h-[calc(100vh-4rem)] bg-background">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          defaultSize={30}
          minSize={25}
          maxSize={40}
          className="min-w-[300px]"
        >
          <TicketListPane
            tickets={mockTickets}
            selectedTicketId={selectedTicketId}
            onSelect={setSelectedTicketId}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={70}>
          <TicketConversationPane ticketId={selectedTicketId} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
