import React from 'react';
import { Message, Ticket, Attachment } from '@/types/tickets';
import { Paperclip, FileText, ImageIcon } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  user: Ticket;
}

const isImage = (filename: string) => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension ? imageExtensions.includes(extension) : false;
};

const AttachmentPreview: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  if (isImage(attachment.filename)) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
        <img src={attachment.url} alt={attachment.filename} className="max-w-xs rounded-lg" />
      </a>
    );
  }

  return (
    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-black/10 hover:bg-black/20 transition-colors">
      {attachment.filename.endsWith('.pdf') ? <FileText className="w-6 h-6" /> : <Paperclip className="w-6 h-6" />}
      <div className="flex flex-col">
        <span className="font-semibold">{attachment.filename}</span>
        <span className="text-xs">{Math.round(attachment.size / 1024)} KB</span>
      </div>
    </a>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, user }) => {
  const isAdmin = message.author === 'agent';

  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-lg px-3 py-2 max-w-lg text-sm shadow-md ${isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.attachments && message.attachments.map(att => (
          <AttachmentPreview key={att.id} attachment={att} />
        ))}
        <div className={`text-xs mt-1 ${isAdmin ? 'text-blue-200' : 'text-gray-500'}`}>
          {new Date(message.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
