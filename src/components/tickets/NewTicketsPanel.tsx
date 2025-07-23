import React from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import Sidebar from './Sidebar';
import ConversationPanel from './ConversationPanel';
import DetailsPanel from './DetailsPanel';

const NewTicketsPanel: React.FC = () => {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-screen w-full"
    >
      <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
        <Sidebar />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={45} minSize={30}>
        <ConversationPanel />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
        <DetailsPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default NewTicketsPanel;
