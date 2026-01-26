'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Send, Loader2, MessageSquare, X, ChevronRight, Paperclip, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentViewerModal } from './DocumentViewerModal';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface PlotPoint {
  id: string;
  narrative_id: string;
  thread_id: string | null;
  title: string;
  content: string;
  event_date: string | null;
  sort_order: number;
  attachments?: string | null;
}

interface Thread {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  color: string;
  sort_order: number;
  is_visible: boolean;
}

interface PlotPointSuggestion {
  title: string;
  date: string;
  thread: string;
  content: string;
  reason: string;
}

interface ContentAdditionSuggestion {
  plotPointTitle: string;
  additionalContent: string;
  reason: string;
}

interface BatchSuggestion {
  id: string;
  suggestedTitle: string;
  date: string | null;
  thread: string;
  content: string;
  reason: string;
  crossReference?: string | null;
  selected: boolean;
}

interface TimelineChatPanelProps {
  caseId: string;
  narrativeId: string;
  plotPoints: PlotPoint[];
  threads: Thread[];
  onRefreshTimeline: () => void;
}

export function TimelineChatPanel({
  caseId,
  narrativeId,
  plotPoints,
  threads,
  onRefreshTimeline,
}: TimelineChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<PlotPointSuggestion | null>(null);
  const [pendingContentAddition, setPendingContentAddition] = useState<ContentAdditionSuggestion | null>(null);
  const [batchSuggestions, setBatchSuggestions] = useState<BatchSuggestion[]>([]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const [uploadedDocText, setUploadedDocText] = useState<string | null>(null);
  const [storedAnalysisEvents, setStoredAnalysisEvents] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFilename, setViewerFilename] = useState('');
  const [viewerQuote, setViewerQuote] = useState<string | undefined>(undefined);

  // Load messages from localStorage on mount
  useEffect(() => {
    const storageKey = `timeline_chat_${caseId}_${narrativeId}`;
    const savedMessages = localStorage.getItem(storageKey);
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (error) {
        console.error('Failed to load saved messages:', error);
      }
    }
  }, [caseId, narrativeId]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      const storageKey = `timeline_chat_${caseId}_${narrativeId}`;
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, caseId, narrativeId]);

  useEffect(() => {
    messagesEndRef?.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if ((!input?.trim() && !attachedFile) || isLoading) return;

    const userMessage = input;
    const hasAttachment = !!attachedFile;

    setInput('');
    setIsLoading(true);

    try {
      // If there's a file attached, upload it first
      if (attachedFile) {
        const formData = new FormData();
        formData.append('file', attachedFile);
        formData.append('caseId', caseId);
        formData.append('narrativeId', narrativeId);

        const uploadRes = await fetch('/api/timeline-chat/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();

        if (uploadData.duplicate) {
          toast.info('Document already exists in system');
        }

        // Store document reference for this conversation
        const docText = uploadData.document?.extracted_text || uploadData.document?.extractedText;
        setUploadedDocId(uploadData.document?.id);
        setUploadedDocText(docText);

        // Add user message with document reference and their comment
        const tempMsg: Message = {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: `[Uploaded: ${attachedFile.name}]\n${userMessage}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempMsg]);
        setAttachedFile(null);

        // Check if user is requesting deep analysis
        const isDeepAnalysisRequest = /analyze|analyse|extract|create plot points|add to timeline|suggest events|check dates|find contradictions|assess|evaluate|examine|review|audit|inspect|scrutinize|odd|unusual|problems|issues|concerns|carefully/i.test(userMessage);

        if (isDeepAnalysisRequest) {
          // Run multi-agent deep analysis
          await runMultiAgentAnalysis(uploadData.document?.id, docText);
        } else {
          // Just send to AI for conversational response with document context
          await sendToAI(userMessage, docText);
        }
      } else {
        // No attachment, regular message
        const tempMsg: Message = {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: userMessage,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempMsg]);

        // INTENT DETECTION: Check if user wants to extract stored plot points
        const extractionIntent = /extract plot points|add to timeline|create plot points|show me the events/i.test(userMessage);

        if (extractionIntent && storedAnalysisEvents.length > 0) {
          // Show batch modal with stored events
          const suggestions: BatchSuggestion[] = storedAnalysisEvents.map((event: any, index: number) => ({
            id: `batch-${Date.now()}-${index}`,
            suggestedTitle: event.suggestedTitle,
            date: event.date,
            thread: event.thread || 'Thoughts',
            content: event.content,
            reason: event.reason,
            crossReference: event.crossReference,
            selected: true,
          }));
          setBatchSuggestions(suggestions);
          setIsLoading(false);
          return;
        }

        // INTENT DETECTION: Check if user wants to add content to existing plot point
        const addContentIntent = detectAddContentIntent(userMessage);

        if (addContentIntent) {
          // Skip AI, directly show confirmation modal
          setPendingContentAddition({
            plotPointTitle: addContentIntent.plotPointTitle,
            additionalContent: addContentIntent.content,
            reason: 'User requested addition',
          });
          setIsLoading(false);
          return;
        }

        // Send to AI with previous document context if available
        await sendToAI(userMessage, uploadedDocText);
      }
    } catch (error) {
      toast.error('Failed to send message');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendToAI = async (userMessage: string, documentText: string | null) => {
    try {
      // Build message with document context if available
      let messageWithContext = userMessage;
      if (documentText) {
        // Include full document (up to 50k chars for context limit)
        const docContent = documentText.substring(0, 50000);
        messageWithContext = `DOCUMENT CONTENT:\n${docContent}\n\n---\n\nUser question: ${userMessage}`;
      }

      const res = await fetch('/api/timeline-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          narrative_id: narrativeId,
          message: messageWithContext,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          plot_points: plotPoints,
          threads: threads,
        }),
      });

      const data = await res.json();
      const reply = data?.reply ?? 'No response';

      // Check for structured suggestions FIRST
      const hasStructuredResponse = parseSuggestions(reply);

      // Only add to messages if it's NOT a structured response
      if (!hasStructuredResponse) {
        const assistantMsg: Message = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: reply,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (error) {
      throw error;
    }
  };

  const runMultiAgentAnalysis = async (documentId: string, documentText: string) => {
    try {
      // Show analysis in progress message
      const progressMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: '🤖 Dispatching specialist analysis teams... (Temporal Validation, Contradiction Detection, Timeline Extraction, Strategic Assessment)',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, progressMsg]);

      const analyzeRes = await fetch('/api/document-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          documentText,
          caseId,
          narrativeId,
        }),
      });

      const analysisData = await analyzeRes.json();

      if (analysisData.error) {
        const errorMsg: Message = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `Analysis error: ${analysisData.error}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      // Display synthesized report from master orchestrator
      const synthesisMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: analysisData.synthesis || 'Analysis complete.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, synthesisMsg]);

      // Store timeline events but DON'T show batch modal automatically
      // User needs to explicitly request "extract plot points" or "add to timeline"
      const timelineReport = analysisData.agentReports?.timeline_extraction;
      if (timelineReport?.events && timelineReport.events.length > 0) {
        setStoredAnalysisEvents(timelineReport.events);

        // Add helpful message about next steps
        const nextStepsMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: `\n\nI found ${timelineReport.events.length} timeline events. Would you like me to add them to your timeline? Just say "extract plot points" or "add to timeline" when ready.`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, nextStepsMsg]);
      }
    } catch (error) {
      throw error;
    }
  };

  const detectAddContentIntent = (message: string): { plotPointTitle: string; content: string } | null => {
    // Patterns that indicate adding content to existing plot point
    const patterns = [
      // "in the card titled X, add Y"
      /in\s+the\s+card\s+titled\s+["']([^"']+)["'][,\s]+(?:can\s+you\s+)?add\s+(?:to\s+the\s+content\s+and\s+say\s+)?["']?(.+?)["']?$/i,
      // "add to X: Y" or "add Y to X"
      /add\s+(?:to\s+)?["']?([^"':]+?)["']?[:\s]+(.+)$/i,
      // "update X with Y"
      /update\s+["']?([^"']+?)["']?\s+with\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const potentialTitle = match[1].trim();
        const content = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes

        // Find matching plot point (case-insensitive)
        const plotPoint = plotPoints.find(
          (pp) => pp.title.toLowerCase() === potentialTitle.toLowerCase()
        );

        if (plotPoint) {
          return {
            plotPointTitle: plotPoint.title,
            content: content,
          };
        }
      }
    }

    return null;
  };

  const parseSuggestions = (text: string): boolean => {
    // Parse ADD_CONTENT format (check this first as it's more specific)
    const contentAddMatch = text.match(
      /ADD_CONTENT:\s*PlotPointTitle:\s*(.+?)\s*AdditionalContent:\s*(.+?)\s*Reason:\s*(.+?)(?:\n|$)/s
    );

    if (contentAddMatch) {
      setPendingContentAddition({
        plotPointTitle: contentAddMatch[1].trim(),
        additionalContent: contentAddMatch[2].trim(),
        reason: contentAddMatch[3].trim(),
      });
      return true; // Found structured response
    }

    // Parse SUGGEST_PLOT_POINT format
    const suggestionMatch = text.match(
      /SUGGEST_PLOT_POINT:\s*Title:\s*(.+?)\s*Date:\s*(.+?)\s*Thread:\s*(.+?)\s*Content:\s*(.+?)\s*Reason:\s*(.+?)(?:\n|$)/s
    );

    if (suggestionMatch) {
      setPendingSuggestion({
        title: suggestionMatch[1].trim(),
        date: suggestionMatch[2].trim(),
        thread: suggestionMatch[3].trim(),
        content: suggestionMatch[4].trim(),
        reason: suggestionMatch[5].trim(),
      });
      return true; // Found structured response
    }

    return false; // No structured response found
  };

  const handleConfirmSuggestion = async () => {
    if (!pendingSuggestion) return;

    try {
      // Find the thread by title
      const thread = threads.find(
        (t) => t.title.toLowerCase() === pendingSuggestion.thread.toLowerCase()
      );

      if (!thread) {
        toast.error(`Thread "${pendingSuggestion.thread}" not found`);
        return;
      }

      // Create the plot point
      await fetch(`/api/narratives/${narrativeId}/plot-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pendingSuggestion.title,
          content: pendingSuggestion.content,
          event_date: pendingSuggestion.date,
          thread_id: thread.id,
          sort_order: plotPoints.length,
        }),
      });

      toast.success('Plot point created');
      setPendingSuggestion(null);
      onRefreshTimeline();
    } catch (error) {
      console.error('Failed to create plot point:', error);
      toast.error('Failed to create plot point');
    }
  };

  const handleConfirmContentAddition = async () => {
    if (!pendingContentAddition) return;

    try {
      // Find the plot point by title
      const plotPoint = plotPoints.find(
        (pp) => pp.title.toLowerCase() === pendingContentAddition.plotPointTitle.toLowerCase()
      );

      if (!plotPoint) {
        toast.error(`Plot point "${pendingContentAddition.plotPointTitle}" not found`);
        return;
      }

      // Append new content to existing content
      const updatedContent = plotPoint.content
        ? `${plotPoint.content}\n\n${pendingContentAddition.additionalContent}`
        : pendingContentAddition.additionalContent;

      // Update the plot point
      await fetch(`/api/narratives/${narrativeId}/plot-points/${plotPoint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: updatedContent,
        }),
      });

      toast.success('Content added to plot point');
      setPendingContentAddition(null);
      onRefreshTimeline();
    } catch (error) {
      console.error('Failed to add content:', error);
      toast.error('Failed to add content');
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedTypes.includes(fileExt)) {
      toast.error('Unsupported file type. Please upload PDF, DOC, DOCX, or TXT');
      return;
    }

    setAttachedFile(file);
    toast.success(`File attached: ${file.name}`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleBatchApproval = async () => {
    const selectedSuggestions = batchSuggestions.filter(s => s.selected);
    if (selectedSuggestions.length === 0) {
      toast.error('No suggestions selected');
      return;
    }

    setIsLoading(true);
    try {
      let successCount = 0;

      for (const suggestion of selectedSuggestions) {
        // Find or use default thread
        const thread = threads.find(t => t.title.toLowerCase() === suggestion.thread.toLowerCase()) || threads[0];

        await fetch(`/api/narratives/${narrativeId}/plot-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: suggestion.suggestedTitle,
            content: suggestion.content,
            event_date: suggestion.date,
            thread_id: thread?.id || null,
            sort_order: plotPoints.length + successCount,
          }),
        });

        successCount++;
      }

      toast.success(`Created ${successCount} plot points`);
      setBatchSuggestions([]);
      onRefreshTimeline();
    } catch (error) {
      console.error('Batch approval error:', error);
      toast.error('Failed to create some plot points');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSuggestionSelection = (id: string) => {
    setBatchSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s)
    );
  };

  const toggleSelectAll = () => {
    const allSelected = batchSuggestions.every(s => s.selected);
    setBatchSuggestions(prev =>
      prev.map(s => ({ ...s, selected: !allSelected }))
    );
  };

  const updateSuggestion = (id: string, field: keyof BatchSuggestion, value: any) => {
    setBatchSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, [field]: value } : s)
    );
  };

  // Parse citations and render clickable links
  const renderMessageWithCitations = (content: string) => {
    // Pattern: [📄 filename] "quote" or just [📄 filename]
    const citationPattern = /\[📄\s+([^\]]+)\](?:\s+"([^"]+)")?/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = citationPattern.exec(content)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const filename = match[1].trim();
      const quote = match[2] ? match[2].trim() : undefined;

      // Add clickable citation
      parts.push(
        <span
          key={match.index}
          className="inline-flex items-center gap-1 cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
          onClick={() => {
            setViewerFilename(filename);
            setViewerQuote(quote);
            setViewerOpen(true);
          }}
        >
          📄 {filename}
        </span>
      );

      // Add quote text if present
      if (quote) {
        parts.push(` "${quote}"`);
      }

      lastIndex = citationPattern.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="fixed right-4 bottom-4 z-50 shadow-lg"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Timeline Assistant
        </Button>
      )}

      {/* Chat Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-[400px] bg-background border-l border-border shadow-2xl z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <h3 className="font-semibold">Timeline Assistant</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMessages([]);
                  const storageKey = `timeline_chat_${caseId}_${narrativeId}`;
                  localStorage.removeItem(storageKey);
                  toast.success('Chat cleared');
                }}
              >
                Clear Chat
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                <p className="mb-2">Ask me about your timeline:</p>
                <ul className="text-left max-w-xs mx-auto space-y-1">
                  <li>• "What happened in June 2023?"</li>
                  <li>• "Suggest plot points for treatment timeline"</li>
                  <li>• "What timeline gaps should I fill?"</li>
                </ul>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-lg p-3 max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.role === 'assistant' ? renderMessageWithCitations(msg.content) : msg.content}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            {/* File attachment preview */}
            {attachedFile && (
              <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{attachedFile.name}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAttachedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div
              className={`flex gap-2 ${isDragging ? 'ring-2 ring-primary rounded-lg p-2' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach document"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e?.target?.value ?? '')}
                placeholder={attachedFile ? "Add instructions or comments about this document..." : "Ask about your timeline or drop a document..."}
                className="min-h-[60px] max-h-[120px] text-sm"
                onKeyDown={(e) => {
                  if (e?.key === 'Enter' && !e?.shiftKey) {
                    e?.preventDefault?.();
                    sendMessage();
                  }
                }}
                disabled={isLoading}
              />
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for New Plot Point */}
      {pendingSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-muted p-6 rounded-xl border border-border w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold">Confirm Plot Point</h2>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">Title:</span> {pendingSuggestion.title}
              </div>
              <div>
                <span className="font-semibold">Date:</span> {pendingSuggestion.date}
              </div>
              <div>
                <span className="font-semibold">Thread:</span> {pendingSuggestion.thread}
              </div>
              <div>
                <span className="font-semibold">Content:</span>
                <p className="mt-1 text-muted-foreground">{pendingSuggestion.content}</p>
              </div>
              <div>
                <span className="font-semibold">Reason:</span>
                <p className="mt-1 text-muted-foreground">{pendingSuggestion.reason}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setPendingSuggestion(null)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmSuggestion}>
                Confirm & Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Content Addition */}
      {pendingContentAddition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-muted p-6 rounded-xl border border-border w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold">Add Content to Plot Point</h2>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">Plot Point:</span> {pendingContentAddition.plotPointTitle}
              </div>
              <div>
                <span className="font-semibold">Additional Content:</span>
                <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{pendingContentAddition.additionalContent}</p>
              </div>
              <div>
                <span className="font-semibold">Reason:</span>
                <p className="mt-1 text-muted-foreground">{pendingContentAddition.reason}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setPendingContentAddition(null)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmContentAddition}>
                Confirm & Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Suggestions Review Modal */}
      {batchSuggestions.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-background p-6 rounded-xl border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Review Suggested Plot Points ({batchSuggestions.filter(s => s.selected).length} selected)</h2>
              <Button variant="ghost" size="sm" onClick={() => setBatchSuggestions([])}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2 mb-4">
              <Button size="sm" variant="outline" onClick={toggleSelectAll}>
                {batchSuggestions.every(s => s.selected) ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {batchSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className={`p-4 border rounded-lg ${suggestion.selected ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={suggestion.selected}
                      onChange={() => toggleSuggestionSelection(suggestion.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={suggestion.suggestedTitle}
                        onChange={(e) => updateSuggestion(suggestion.id, 'suggestedTitle', e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1 text-sm font-semibold"
                      />
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={suggestion.date || ''}
                          onChange={(e) => updateSuggestion(suggestion.id, 'date', e.target.value || null)}
                          className="bg-background border border-border rounded px-2 py-1 text-xs"
                        />
                        <select
                          value={suggestion.thread}
                          onChange={(e) => updateSuggestion(suggestion.id, 'thread', e.target.value)}
                          className="bg-background border border-border rounded px-2 py-1 text-xs"
                        >
                          {threads.map(t => (
                            <option key={t.id} value={t.title}>{t.title}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={suggestion.content}
                        onChange={(e) => updateSuggestion(suggestion.id, 'content', e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1 text-xs min-h-[60px]"
                      />
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold">Why:</span> {suggestion.reason}
                      </div>
                      {suggestion.crossReference && (
                        <div className="text-xs text-yellow-600 dark:text-yellow-400">
                          ⚠ {suggestion.crossReference}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
              <Button variant="outline" onClick={() => setBatchSuggestions([])}>
                Cancel
              </Button>
              <Button onClick={handleBatchApproval} disabled={isLoading || batchSuggestions.filter(s => s.selected).length === 0}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Approve & Create ${batchSuggestions.filter(s => s.selected).length} Plot Points`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        filename={viewerFilename}
        quote={viewerQuote}
        caseId={caseId}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
