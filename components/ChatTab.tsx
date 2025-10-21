
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Send, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function ChatTab({ caseId }: { caseId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [caseId]);

  useEffect(() => {
    messagesEndRef?.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/messages?caseId=${caseId}`);
      const data = await res.json();
      setMessages(data?.messages ?? []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!input?.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, message: userMessage }),
      });

      const data = await res.json();
      
      const assistantMsg: Message = {
        id: data?.messageId ?? `msg-${Date.now()}`,
        role: 'assistant',
        content: data?.response ?? 'No response',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      toast.error('Failed to send message');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveInsight = async (content: string, category: string) => {
    try {
      await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, content, category }),
      });
      toast.success('Saved to ' + category);
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages?.map?.((msg) => (
          <div
            key={msg?.id}
            className={`flex ${
              msg?.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div className="flex flex-col max-w-[80%]">
              <div
                className={`rounded-lg p-5 ${
                  msg?.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap text-base leading-relaxed">
                  {msg?.content}
                </p>
              </div>
              {msg?.role === 'assistant' && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveInsight(msg.content, 'insight')}
                  >
                    <Save className="w-3 h-3 mr-1" />
                    Save as Insight
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveInsight(msg.content, 'argument')}
                  >
                    <Save className="w-3 h-3 mr-1" />
                    Save as Argument
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-5">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 border-t border-border">
        <div className="flex gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e?.target?.value ?? '')}
            placeholder="Ask about your case, request analysis, or say 'save that' to remember key points..."
            className="min-h-[80px] max-h-[200px] text-base"
            onKeyDown={(e) => {
              if (e?.key === 'Enter' && !e?.shiftKey) {
                e?.preventDefault?.();
                sendMessage();
              }
            }}
            disabled={isLoading}
          />
          <Button
            size="lg"
            onClick={sendMessage}
            disabled={isLoading || !input?.trim()}
            className="px-6"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
