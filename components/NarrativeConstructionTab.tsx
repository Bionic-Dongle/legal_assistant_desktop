'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Plus, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { InputModal } from './InputModal';
import { TimelineGrid } from './TimelineGrid';
import { TimelineToolbar } from './TimelineToolbar';
import { PlotPointEditModal } from './PlotPointEditModal';

interface Thread {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  color: string;
  sort_order: number;
  is_visible: boolean;
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

export function NarrativeConstructionTab({ caseId }: { caseId: string }) {
  const [mainNarrativeId, setMainNarrativeId] = useState<string>('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [plotPoints, setPlotPoints] = useState<PlotPoint[]>([]);
  const [selectedPlotPoint, setSelectedPlotPoint] = useState<PlotPoint | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showThreadModal, setShowThreadModal] = useState(false);

  // Timeline controls
  const [zoomLevel, setZoomLevel] = useState<'year' | 'quarter' | 'month' | 'week'>('month');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  useEffect(() => {
    if (caseId) {
      loadMainNarrative();
      loadThreads();
    }
  }, [caseId]);

  useEffect(() => {
    if (mainNarrativeId) {
      loadPlotPoints();
    }
  }, [mainNarrativeId]);

  const loadMainNarrative = async () => {
    try {
      const res = await fetch(`/api/narratives?case_id=${caseId}`);
      const data = await res.json();
      const mainNarrative = data?.narratives?.find((n: any) => n.narrative_type === 'main');

      if (mainNarrative) {
        setMainNarrativeId(mainNarrative.id);
      }
    } catch (error) {
      console.error('Failed to load main narrative:', error);
      toast.error('Failed to load narrative');
    }
  };

  const loadThreads = async () => {
    try {
      const res = await fetch(`/api/narrative-threads?case_id=${caseId}`);
      const data = await res.json();
      setThreads(data?.threads ?? []);
    } catch (error) {
      console.error('Failed to load threads:', error);
      toast.error('Failed to load narrative threads');
    }
  };

  const loadPlotPoints = async () => {
    try {
      const res = await fetch(`/api/narratives/${mainNarrativeId}/plot-points`);
      const data = await res.json();
      setPlotPoints(data?.plotPoints ?? []);
    } catch (error) {
      console.error('Failed to load plot points:', error);
      toast.error('Failed to load plot points');
    }
  };

  const handleCreateThread = async (title: string) => {
    try {
      const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];
      const randomColor = colors[threads.length % colors.length];

      await fetch('/api/narrative-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          title,
          description: '',
          color: randomColor,
          sort_order: threads.length,
        }),
      });

      toast.success('Thread created');
      loadThreads();
    } catch (error) {
      toast.error('Failed to create thread');
    }
  };

  const handleCreatePlotPoint = async () => {
    if (threads.length === 0) {
      toast.error('Please create at least one narrative thread first');
      return;
    }
    setSelectedPlotPoint(null);
    setIsEditModalOpen(true);
  };

  const handleEditPlotPoint = (plotPoint: PlotPoint) => {
    setSelectedPlotPoint(plotPoint);
    setIsEditModalOpen(true);
  };

  const handleSavePlotPoint = async (data: {
    title: string;
    content: string;
    event_date: string;
    thread_id: string;
  }) => {
    try {
      if (selectedPlotPoint) {
        // Update existing plot point
        await fetch(`/api/narratives/${mainNarrativeId}/plot-points/${selectedPlotPoint.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        toast.success('Plot point updated');
      } else {
        // Create new plot point
        await fetch(`/api/narratives/${mainNarrativeId}/plot-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            sort_order: plotPoints.length,
          }),
        });
        toast.success('Plot point created');
      }

      await loadPlotPoints();
    } catch (error) {
      console.error('Failed to save plot point:', error);
      toast.error('Failed to save plot point');
      throw error;
    }
  };

  const handlePlotPointMove = async (
    plotPointId: string,
    newThreadId: string,
    newEventDate: string | null
  ) => {
    try {
      await fetch(`/api/narratives/${mainNarrativeId}/plot-points/${plotPointId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: newThreadId,
          event_date: newEventDate,
        }),
      });

      toast.success('Plot point moved');
      loadPlotPoints();
    } catch (error) {
      toast.error('Failed to move plot point');
    }
  };

  const handleThreadReorder = async (activeThreadId: string, overThreadId: string) => {
    try {
      // Find the threads
      const activeThread = threads.find(t => t.id === activeThreadId);
      const overThread = threads.find(t => t.id === overThreadId);

      if (!activeThread || !overThread) return;

      // Create a new sorted array with the active thread moved to the over position
      const sortedThreads = [...threads].sort((a, b) => a.sort_order - b.sort_order);
      const activeIndex = sortedThreads.findIndex(t => t.id === activeThreadId);
      const overIndex = sortedThreads.findIndex(t => t.id === overThreadId);

      // Remove active thread from its current position
      const [movedThread] = sortedThreads.splice(activeIndex, 1);

      // Insert it at the new position
      sortedThreads.splice(overIndex, 0, movedThread);

      // Renumber all threads sequentially
      const updates = sortedThreads.map((thread, index) =>
        fetch(`/api/narrative-threads/${thread.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: index }),
        })
      );

      await Promise.all(updates);
      loadThreads();
    } catch (error) {
      toast.error('Failed to reorder thread');
    }
  };

  const handleToggleThreadVisibility = async (threadId: string, isVisible: boolean) => {
    try {
      await fetch(`/api/narrative-threads/${threadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_visible: isVisible,
        }),
      });

      await loadThreads();
      await loadPlotPoints();
    } catch (error) {
      toast.error('Failed to toggle thread visibility');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-border p-4 flex gap-2 items-center">
        <Button size="sm" variant="outline" onClick={() => setShowThreadModal(true)}>
          <ListPlus className="w-4 h-4 mr-1" />
          New Thread
        </Button>
        <Button size="sm" variant="default" onClick={handleCreatePlotPoint}>
          <Plus className="w-4 h-4 mr-1" />
          New Plot Point
        </Button>

        {/* Zoom Controls */}
        {threads.length > 0 && (
          <>
            <div className="border-l border-border h-6 mx-2" />
            <span className="text-xs text-muted-foreground">Zoom:</span>
            <div className="flex gap-1">
              {(['year', 'quarter', 'month', 'week'] as const).map((level) => (
                <Button
                  key={level}
                  size="sm"
                  variant={zoomLevel === level ? 'default' : 'ghost'}
                  onClick={() => setZoomLevel(level)}
                  className="h-7 px-2 text-xs"
                >
                  {level}
                </Button>
              ))}
            </div>
          </>
        )}

        <div className="flex-1" />
        <div className="text-sm text-muted-foreground flex items-center">
          {plotPoints.length} plot points across {threads.length} threads
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="flex-1 overflow-hidden">
        {threads.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <h3 className="text-lg font-semibold mb-2">No narrative threads yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first narrative thread to get started organizing your case timeline
              </p>
              <Button onClick={() => setShowThreadModal(true)}>
                <ListPlus className="w-4 h-4 mr-2" />
                Create First Thread
              </Button>
            </div>
          </div>
        ) : (
          <TimelineGrid
            plotPoints={plotPoints}
            threads={threads}
            onPlotPointClick={handleEditPlotPoint}
            onPlotPointMove={handlePlotPointMove}
            onThreadReorder={handleThreadReorder}
            onThreadVisibilityToggle={handleToggleThreadVisibility}
            zoomLevel={zoomLevel}
            dateRange={dateRange}
          />
        )}
      </div>

      {/* Modals */}
      <InputModal
        isOpen={showThreadModal}
        onClose={() => setShowThreadModal(false)}
        onConfirm={handleCreateThread}
        title="Create Narrative Thread"
        placeholder="Enter thread title (e.g., 'Liability Theory', 'Witness Timeline')..."
      />

      <PlotPointEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedPlotPoint(null);
        }}
        onSave={handleSavePlotPoint}
        plotPoint={selectedPlotPoint}
        threads={threads}
        caseId={caseId}
      />
    </div>
  );
}
