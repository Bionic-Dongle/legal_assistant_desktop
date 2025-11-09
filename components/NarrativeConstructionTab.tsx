'use client';

import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Send, Loader2, Save, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { InputModal } from './InputModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function NarrativeConstructionTab({ caseId }: { caseId: string }) {
  const [mainNarrativeId, setMainNarrativeId] = useState<string>('');
  const [plotPoints, setPlotPoints] = useState<any[]>([]);
  const [activePlotPointId, setActivePlotPointId] = useState<string>('');
  const [plotPointTitle, setPlotPointTitle] = useState('');
  const [subNarratives, setSubNarratives] = useState<any[]>([]);
  const [activeSubNarrativeId, setActiveSubNarrativeId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPlotPointModal, setShowPlotPointModal] = useState(false);
  const [showSubNarrativeModal, setShowSubNarrativeModal] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your narrative section...',
      }),
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4',
      },
    },
  });

  useEffect(() => {
    if (caseId) {
      loadMainNarrative();
    }
  }, [caseId]);

  const loadMainNarrative = async () => {
    try {
      const res = await fetch(`/api/narratives?case_id=${caseId}`);
      const data = await res.json();
      const mainNarrative = data?.narratives?.find((n: any) => n.narrative_type === 'main');

      if (mainNarrative) {
        setMainNarrativeId(mainNarrative.id);
        loadPlotPoints(mainNarrative.id);
      }
    } catch (error) {
      console.error('Failed to load main narrative:', error);
    }
  };

  const loadPlotPoints = async (narrativeId: string) => {
    try {
      const res = await fetch(`/api/narratives/${narrativeId}/plot-points`);
      const data = await res.json();
      setPlotPoints(data?.plotPoints ?? []);

      // Auto-select first plot point if available
      if (data?.plotPoints?.length > 0 && !activePlotPointId) {
        selectPlotPoint(data.plotPoints[0]);
      }
    } catch (error) {
      console.error('Failed to load plot points:', error);
    }
  };

  const selectPlotPoint = (plotPoint: any) => {
    setActivePlotPointId(plotPoint.id);
    setPlotPointTitle(plotPoint.title);
    editor?.commands.setContent(plotPoint.content);
    loadSubNarratives(plotPoint.id);
    setActiveSubNarrativeId(''); // Reset sub-narrative when changing plot points
  };

  const loadSubNarratives = async (plotPointId: string) => {
    try {
      const res = await fetch(`/api/plot-points/${plotPointId}/sub-narratives`);
      const data = await res.json();
      setSubNarratives(data?.subNarratives ?? []);
    } catch (error) {
      console.error('Failed to load sub-narratives:', error);
    }
  };

  const handleCreatePlotPoint = async (title: string) => {
    if (!mainNarrativeId) {
      toast.error('Main narrative not loaded');
      return;
    }

    try {
      const res = await fetch(`/api/narratives/${mainNarrativeId}/plot-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: '',
          sort_order: plotPoints.length,
        }),
      });
      const data = await res.json();
      toast.success('Plot point created');
      loadPlotPoints(mainNarrativeId);
    } catch (error) {
      toast.error('Failed to create plot point');
    }
  };

  const handleCreateSubNarrative = async (title: string) => {
    if (!activePlotPointId) {
      toast.error('Please select a plot point first');
      return;
    }

    try {
      const res = await fetch('/api/narratives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          title,
          narrative_type: 'sub',
          plot_point_id: activePlotPointId,
        }),
      });
      const data = await res.json();
      toast.success('Sub-narrative created');
      loadSubNarratives(activePlotPointId);
    } catch (error) {
      toast.error('Failed to create sub-narrative');
    }
  };

  const savePlotPoint = async () => {
    if (!activePlotPointId) {
      toast.error('No plot point selected');
      return;
    }

    try {
      const content = editor?.getHTML() ?? '';
      await fetch(`/api/narratives/${mainNarrativeId}/plot-points/${activePlotPointId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: plotPointTitle,
          content,
        }),
      });
      toast.success('Plot point saved');
      loadPlotPoints(mainNarrativeId);
    } catch (error) {
      toast.error('Failed to save plot point');
    }
  };

  const sendNarrativeMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/narrative-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          narrative_id: mainNarrativeId,
          plot_point_id: activePlotPointId,
          sub_narrative_id: activeSubNarrativeId,
          message: input,
          messages: messages.slice(-6),
        }),
      });

      const data = await res.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data?.reply ?? 'No response received',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex">
      {/* Left Panel: Editor */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Toolbar */}
        <div className="border-b border-border p-4 space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowPlotPointModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Plot Point
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowSubNarrativeModal(true)} disabled={!activePlotPointId}>
              <Plus className="w-4 h-4 mr-1" />
              Sub-Narrative
            </Button>
            <Button size="sm" variant="default" onClick={savePlotPoint} disabled={!activePlotPointId}>
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>

          {/* Plot Point Selector */}
          <div className="flex gap-2">
            <select
              className="flex-1 border border-border rounded-md p-2 bg-background"
              value={activePlotPointId}
              onChange={(e) => {
                const plotPoint = plotPoints.find((p) => p.id === e.target.value);
                if (plotPoint) {
                  selectPlotPoint(plotPoint);
                }
              }}
            >
              <option value="">Select Plot Point...</option>
              {plotPoints.map((p) => (
                <option key={p.id} value={p.id}>
                  📍 {p.title}
                </option>
              ))}
            </select>

            {/* Sub-Narrative Selector (Optional) */}
            <select
              className="flex-1 border border-border rounded-md p-2 bg-background"
              value={activeSubNarrativeId}
              onChange={(e) => setActiveSubNarrativeId(e.target.value)}
              disabled={!activePlotPointId || subNarratives.length === 0}
            >
              <option value="">Main Plot Point Content</option>
              {subNarratives.map((sn) => (
                <option key={sn.id} value={sn.id}>
                  📙 {sn.title}
                </option>
              ))}
            </select>
          </div>

          {/* Plot Point Title */}
          {activePlotPointId && !activeSubNarrativeId && (
            <Input
              placeholder="Plot point title..."
              value={plotPointTitle}
              onChange={(e) => setPlotPointTitle(e.target.value)}
            />
          )}

          {activeSubNarrativeId && (
            <div className="text-sm text-muted-foreground p-2 bg-muted/30 rounded">
              Editing sub-narrative: {subNarratives.find(s => s.id === activeSubNarrativeId)?.title}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Right Panel: Narrative Chat */}
      <div className="w-96 flex flex-col">
        <div className="border-b border-border p-4">
          <h3 className="font-semibold">Narrative Assistant</h3>
          <p className="text-sm text-muted-foreground">
            Ask questions about your narrative
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block p-3 rounded-lg max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="text-left">
              <div className="inline-block p-3 rounded-lg bg-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Ask about narrative..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendNarrativeMessage();
                }
              }}
              className="resize-none"
              rows={2}
            />
            <Button
              onClick={sendNarrativeMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <InputModal
        isOpen={showPlotPointModal}
        onClose={() => setShowPlotPointModal(false)}
        onConfirm={handleCreatePlotPoint}
        title="Create Plot Point"
        placeholder="Enter plot point title..."
      />
      <InputModal
        isOpen={showSubNarrativeModal}
        onClose={() => setShowSubNarrativeModal(false)}
        onConfirm={handleCreateSubNarrative}
        title="Create Sub-Narrative"
        placeholder="Enter sub-narrative title..."
      />
    </div>
  );
}
