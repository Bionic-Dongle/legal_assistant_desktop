
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Send, Loader2, Save, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentViewerModal } from './DocumentViewerModal';

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

  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFilename, setViewerFilename] = useState('');
  const [viewerQuote, setViewerQuote] = useState<string | undefined>(undefined);

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

  // Parse citations and render clickable links
  const renderMessageWithCitations = (content: string) => {
    // Pattern 1: [📄 filename] "quote" or [Cite: 📄 filename] or [Cited from: 📄 filename] "quote"
    // Pattern 2: "quote" ■ filename.txt (reverse format)
    // Pattern 3: [📄 filename] without brackets sometimes
    const citationPattern1 = /\[(?:Cite[d]?(?:\s+from)?:\s*)?📄\s+([^\]]+)\](?:\s+"([^"]+)")?/g;
    const citationPattern2 = /"([^"]+)"\s*■\s*([^\s]+\.txt)/gi;
    const citationPattern3 = /📄\s+([^\s]+\.txt)/gi;

    const parts: (string | React.ReactElement)[] = [];
    const citations: Array<{ index: number; filename: string; quote?: string; length: number }> = [];

    // Find all Pattern 1 citations
    let match1;
    while ((match1 = citationPattern1.exec(content)) !== null) {
      citations.push({
        index: match1.index,
        filename: match1[1].trim(),
        quote: match1[2] ? match1[2].trim() : undefined,
        length: match1[0].length
      });
    }

    // Find all Pattern 2 citations (reverse format: "quote" ■ filename.txt)
    let match2;
    while ((match2 = citationPattern2.exec(content)) !== null) {
      citations.push({
        index: match2.index,
        quote: match2[1].trim(),
        filename: match2[2].trim(),
        length: match2[0].length
      });
    }

    // Find all Pattern 3 citations (just 📄 filename.txt without brackets)
    // Also try to extract preceding text as the quote
    let match3;
    while ((match3 = citationPattern3.exec(content)) !== null) {
      // Don't add if this position is already covered by another pattern
      const alreadyCovered = citations.some(c =>
        match3!.index >= c.index && match3!.index < c.index + c.length
      );
      if (!alreadyCovered) {
        // Look backwards for text that might be the quote
        // Find the start of the current paragraph/sentence
        const textBefore = content.substring(0, match3.index);
        let quote: string | undefined = undefined;

        // Try to find preceding text on same line or paragraph
        const lastNewlineIdx = textBefore.lastIndexOf('\n\n');
        const lastPeriodIdx = textBefore.lastIndexOf('. ');
        const startIdx = Math.max(lastNewlineIdx + 2, 0);

        if (startIdx < match3.index) {
          const precedingText = textBefore.substring(startIdx).trim();
          // Only use as quote if it's substantial (more than 20 chars)
          if (precedingText.length > 20) {
            quote = precedingText;
          }
        }

        citations.push({
          index: match3.index,
          filename: match3[1].trim(),
          quote: quote,
          length: match3[0].length
        });
      }
    }

    // Sort by index
    citations.sort((a, b) => a.index - b.index);

    let lastIndex = 0;
    citations.forEach((citation, idx) => {
      // Add text before citation
      if (citation.index > lastIndex) {
        parts.push(content.substring(lastIndex, citation.index));
      }

      // Add clickable citation
      parts.push(
        <span
          key={citation.index}
          className="inline-flex items-center gap-1 cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
          onClick={() => {
            console.log('[Citation clicked]', citation.filename, 'quote:', citation.quote?.substring(0, 50));
            setViewerFilename(citation.filename);
            setViewerQuote(citation.quote);
            setViewerOpen(true);
          }}
        >
          📄 {citation.filename}
        </span>
      );

      lastIndex = citation.index + citation.length;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
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
                  {msg?.role === 'assistant' ? renderMessageWithCitations(msg?.content) : msg?.content}
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

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        filename={viewerFilename}
        quote={viewerQuote}
        caseId={caseId}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
