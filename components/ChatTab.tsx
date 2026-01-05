
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Send, Loader2, Save, Copy } from 'lucide-react';
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
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isSavedChat, setIsSavedChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedSavedChat = useRef(false);
  const isLoadingSavedChat = useRef(false);

  useEffect(() => {
    const handler = (event: CustomEvent) => {
      // Prevent any database loading while loading saved chat
      isLoadingSavedChat.current = true;
      setMessages(event.detail);
      setIsSavedChat(true);
      hasLoadedSavedChat.current = true;
      // Allow database loading again after a short delay
      setTimeout(() => {
        isLoadingSavedChat.current = false;
      }, 100);
    };
    window.addEventListener("chat-loaded", handler as EventListener);
    return () => {
      window.removeEventListener("chat-loaded", handler as EventListener);
    };
  }, []);

  // Load messages from database only when caseId changes and we're not loading a saved chat
  useEffect(() => {
    if (!isLoadingSavedChat.current && !isSavedChat && !hasLoadedSavedChat.current) {
      loadMessages();
    }
  }, [caseId, isSavedChat]);

  useEffect(() => {
    messagesEndRef?.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  // Persist chat messages to localStorage so it reloads correctly when switching tabs or reopening app
  useEffect(() => {
    if (messages?.length) {
      localStorage.setItem("activeChat", JSON.stringify(messages));
    }
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

  const [showSaveModal, setShowSaveModal] = useState(false);

  return (
    <div className="flex flex-col h-full relative">
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-muted p-6 rounded-xl border border-border w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">Name Chat</h2>
            <input
              type="text"
              placeholder="Chat name..."
              className="w-full p-2 rounded border bg-background"
              id="chatNameInput"
            />
            <textarea
              placeholder="Short description (optional)"
              className="w-full p-2 rounded border bg-background"
              id="chatDescInput"
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowSaveModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const nameEl = document.getElementById("chatNameInput") as HTMLInputElement;
                  const descEl = document.getElementById("chatDescInput") as HTMLTextAreaElement;
                  const name = nameEl?.value.trim();
                  const description = descEl?.value.trim();
                  if (!name) return toast.error("Please name the chat");
                  try {
                    const sessionMessages = messages.map(m => ({ ...m, sessionId }));
                    const result = await window.electronAPI.saveChat({
                      caseId,
                      name,
                      description,
                      sessionId,
                      messages: sessionMessages
                    });
                    if (result?.success) {
                      toast.success("Chat saved");
                      setShowSaveModal(false);
                    } else {
                      toast.error(result?.error || "Failed to save");
                    }
                  } catch (err) {
                    console.error("Save error:", err);
                    toast.error("Error saving chat");
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
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
                    onClick={() => navigator.clipboard.writeText(msg.content)}
                  >
                    <Save className="w-3 h-3 mr-1" />
                    Copy to Clipboard
                  </Button>
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
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSaveModal(true)}
            >
              <Save className="w-3 h-3 mr-1" />
              Save Chat As
            </Button>
          </div>
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
          <Button
            size="lg"
            variant="outline"
            onClick={async () => {
              try {
                // Clear messages from database
                await fetch('/api/messages', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ caseId }),
                });

                // Clear UI state
                setMessages([]);
                setIsSavedChat(false);
                hasLoadedSavedChat.current = false;
                isLoadingSavedChat.current = false;
                localStorage.removeItem("activeChat");
                toast.success("Chat cleared");
              } catch (error) {
                console.error("Failed to clear chat:", error);
                toast.error("Failed to clear chat");
              }
            }}
          >
            Clear Chat
          </Button>
        </div>
      </div>
    </div>
  );
}
