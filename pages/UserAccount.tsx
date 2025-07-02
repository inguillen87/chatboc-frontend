import React from "react";
import ChatUserPanel from "@/components/chat/ChatUserPanel";

const UserAccount = () => (
  <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
    <ChatUserPanel onClose={() => {}} />
  </div>
);

export default UserAccount;
