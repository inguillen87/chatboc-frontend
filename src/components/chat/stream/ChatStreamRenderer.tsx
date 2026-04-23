import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StreamingCursor } from './StreamingCursor';
import { ToolExecutionChip } from './ToolExecutionChip';
import { CitationDrawer } from './CitationDrawer';
import { consumeStream, StreamCallbacks } from '@/services/ai-stream';
import { Citation } from '@/schemas/api';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface ToolState {
  name: string;
  status: 'running' | 'completed' | 'error';
}

interface ChatStreamRendererProps {
  streamSource: Response | string; // Provide the active fetch Response object, or the finished string
  onFinish?: (finalContent: string, citations: Citation[]) => void;
}

export const ChatStreamRenderer: React.FC<ChatStreamRendererProps> = ({ streamSource, onFinish }) => {
  const [content, setContent] = useState('');
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolState[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof streamSource === 'string') {
      // It's already completed static content
      setContent(streamSource);
      return;
    }

    let isMounted = true;
    let accumulatedContent = '';

    const callbacks: StreamCallbacks = {
      onStart: () => setIsStreaming(true),
      onDelta: (text) => {
        if (!isMounted) return;
        accumulatedContent += text;
        setContent(accumulatedContent);
      },
      onReasoning: (text) => {
         if (!isMounted) return;
         setReasoning(text);
      },
      onToolStart: (name) => {
        if (!isMounted) return;
        setActiveTools(prev => [...prev, { name, status: 'running' }]);
      },
      onToolComplete: (name) => {
        if (!isMounted) return;
        setActiveTools(prev => prev.map(t => t.name === name ? { ...t, status: 'completed' } : t));
      },
      onCitation: (citation) => {
        if (!isMounted) return;
        setCitations(prev => [...prev, citation as Citation]);
      },
      onError: (err) => {
        if (!isMounted) return;
        setError(err.message);
        setIsStreaming(false);
      },
      onComplete: () => {
        if (!isMounted) return;
        setIsStreaming(false);
        onFinish?.(accumulatedContent, citations); // Need a ref for citations to get latest
      }
    };

    consumeStream(streamSource, callbacks).catch(err => {
      if (isMounted) setError(err.message);
    });

    return () => {
      isMounted = false;
    };
  }, [streamSource]);

  return (
    <div className="flex flex-col w-full text-sm sm:text-base leading-relaxed">
      {/* Active Tools Area */}
      {activeTools.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          {activeTools.map((tool, idx) => (
            <ToolExecutionChip key={idx} toolName={tool.name} status={tool.status} />
          ))}
        </div>
      )}

      {/* Optional Reasoning Summary */}
      {reasoning && (
        <div className="mb-3 px-3 py-2 bg-muted/50 rounded-lg text-xs text-muted-foreground border border-muted italic">
          💡 {reasoning}
        </div>
      )}

      {/* Main Content Markdown */}
      <div className="prose prose-sm dark:prose-invert max-w-none break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
        {isStreaming && <StreamingCursor />}
      </div>

      {/* Citations Drawer */}
      {citations.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <CitationDrawer citations={citations} />
        </div>
      )}

      {/* Error state */}
      {error && (
         <div className="mt-2 text-xs text-red-500 font-medium">
           ⚠️ Se interrumpió la conexión: {error}
         </div>
      )}

      {/* Feedback Thumbs (only when done streaming) */}
      {!isStreaming && content.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-2 justify-end opacity-60 hover:opacity-100 transition-opacity">
           <Button variant="ghost" size="icon" className="h-6 w-6">
             <ThumbsUp className="w-3.5 h-3.5" />
           </Button>
           <Button variant="ghost" size="icon" className="h-6 w-6">
             <ThumbsDown className="w-3.5 h-3.5" />
           </Button>
        </div>
      )}
    </div>
  );
};
