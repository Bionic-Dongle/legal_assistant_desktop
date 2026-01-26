'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, Bot, X, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface EvidenceUploadBotPanelProps {
  caseId: string;
  documentId: string | null;
  documentText: string;
  filename: string;
  onTaggingComplete: (metadata: any) => void;
  onClose: () => void;
}

export function EvidenceUploadBotPanel({
  caseId,
  documentId,
  documentText,
  filename,
  onTaggingComplete,
  onClose,
}: EvidenceUploadBotPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Bot's initial greeting when document is loaded
    if (filename && documentText) {
      const initialMessage: Message = {
        role: 'assistant',
        content: `I'll help you tag "${filename}".\n\nTell me about this document - what's the story here? Who created it, who submitted it in discovery, and why does it matter to your case?`,
      };
      setMessages([initialMessage]);
    }
  }, [filename, documentText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/evidence-upload-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          document_id: documentId,
          message: input,
          messages: messages,
          document_text: documentText,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Check if bot returned metadata (tagging complete)
      if (data.metadata) {
        // Bot confirmed tagging - save metadata and close
        onTaggingComplete(data.metadata);
        toast.success('Document tagged successfully!');
        return;
      }

      // Regular conversational response
      const botMessage: Message = {
        role: 'assistant',
        content: data.reply,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!filename) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Bot className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Evidence Upload Bot</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Drop a document to start a conversation. I'll help you tag it properly by asking questions about context and nuance.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">Evidence Upload Bot</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              Tagging: {filename}
            </p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="w-3 h-3" />
                  <span className="text-xs font-semibold">Upload Bot</span>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Bot className="w-3 h-3 animate-pulse" />
                <span className="text-xs">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your response..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
