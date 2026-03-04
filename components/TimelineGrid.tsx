'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, closestCenter, closestCorners, PointerSensor, useSensor, useSensors, DragOverEvent } from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, addWeeks, addMonths, addQuarters, addYears } from 'date-fns';
import { TimelineCard } from './TimelineCard';
import { GripVertical, ChevronRight, ChevronDown, Eye, EyeOff, Paperclip } from 'lucide-react';

interface PlotPoint {
  id: string;
  narrative_id: string;
  title: string;
  description?: string | null;
  content: string;
  thread_id: string | null;
  event_date: string | null;
  sort_order: number;
  attachments?: string | null;
}

interface Thread {
  id: string;
  title: string;
  color: string;
  sort_order: number;
  is_visible: boolean;
}

interface TimelineGridProps {
  plotPoints: PlotPoint[];
  threads: Thread[];
  onPlotPointClick: (plotPoint: PlotPoint) => void;
  onPlotPointMove: (plotPointId: string, newThreadId: string, newEventDate: string | null) => void;
  onPlotPointDelete: (plotPointId: string) => void;
  onThreadReorder: (activeThreadId: string, overThreadId: string) => void;
  onThreadVisibilityToggle: (threadId: string, isVisible: boolean) => void;
  zoomLevel: 'year' | 'quarter' | 'month' | 'week';
  dateRange: { start: string; end: string };
}

interface TimePeriod {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

function SortableThreadRow({
  thread,
  children,
  onToggleVisibility,
  isOver,
  isDraggingAnyThread
}: {
  thread: Thread;
  children: React.ReactNode;
  onToggleVisibility?: (threadId: string) => void;
  isOver?: boolean;
  isDraggingAnyThread?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver: isSortableOver
  } = useSortable({
    id: thread.id,
    transition: null, // Disable transform animations
  });

  // Use the built-in isOver from useSortable instead of our prop
  const showDropIndicator = isSortableOver && isDraggingAnyThread && !isDragging;

  return (
    <>
      {/* Full-width insertion indicator that appears before this thread */}
      {showDropIndicator && (
        <div
          className="h-0.5 bg-blue-500 z-30 pointer-events-none"
          style={{
            gridColumn: '1 / -1',
          }}
        />
      )}

      {/* Thread label cell - this is the droppable/sortable target */}
      <div
        ref={setNodeRef}
        style={{
          borderLeftColor: thread.color,
          borderLeftWidth: '4px',
        }}
        className={`sticky left-0 z-10 bg-background border-b border-r border-border p-2 flex items-center gap-2 transition-opacity ${
          isDragging ? 'opacity-30' : 'opacity-100'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility?.(thread.id);
          }}
          className="hover:bg-accent p-1 rounded"
          title={thread.is_visible ? 'Hide thread' : 'Show thread'}
        >
          {thread.is_visible ? (
            <Eye className="w-4 h-4 text-muted-foreground" />
          ) : (
            <EyeOff className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <span className="font-medium text-sm flex-1">{thread.title}</span>
      </div>

      {/* Grid cells for this thread */}
      {children}
    </>
  );
}

function TimelineDot({
  plotPoint,
  threadColor,
  onClick,
}: {
  plotPoint: PlotPoint;
  threadColor: string;
  onClick: (pp: PlotPoint) => void;
}) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: plotPoint.id,
    data: { plotPoint },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.3 : 1 }
    : undefined;

  const getTextPreview = (html: string) => {
    if (typeof document === 'undefined') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.length > 120 ? text.substring(0, 120) + '...' : text;
  };

  const attachmentCount = (() => {
    if (!plotPoint.attachments) return 0;
    try {
      const parsed = JSON.parse(plotPoint.attachments);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch { return 0; }
  })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex-shrink-0 cursor-pointer"
      onMouseEnter={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setTooltipPos(null)}
      onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
      onClick={() => { if (!isDragging) onClick(plotPoint); }}
    >
      <div
        {...attributes}
        {...listeners}
        className="w-3 h-3 rounded-full transition-transform hover:scale-[1.6] border-2 border-background shadow-sm"
        style={{ backgroundColor: threadColor }}
      />

      {tooltipPos && !isDragging && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: Math.min(tooltipPos.x + 14, window.innerWidth - 270),
            top: tooltipPos.y > 200
              ? tooltipPos.y - 8
              : tooltipPos.y + 20,
            transform: tooltipPos.y > 200 ? 'translateY(-100%)' : 'none',
            zIndex: 9999,
          }}
          className="w-64 bg-popover border border-border rounded-md shadow-xl p-3 pointer-events-none"
        >
          <div className="font-semibold text-sm text-foreground">{plotPoint.title}</div>
          {plotPoint.description && (
            <div className="text-xs text-foreground/80 mt-0.5">{plotPoint.description}</div>
          )}
          {plotPoint.event_date && (
            <div className="text-xs text-muted-foreground mt-1.5">
              {format(parseISO(plotPoint.event_date), 'MMMM d, yyyy')}
            </div>
          )}
          {!plotPoint.description && plotPoint.content && (
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {getTextPreview(plotPoint.content)}
            </div>
          )}
          {attachmentCount > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Paperclip className="w-3 h-3" />
              <span>{attachmentCount} attachment{attachmentCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="text-xs text-primary/70 mt-2 font-medium">Click to open ↗</div>
        </div>,
        document.body
      )}
    </div>
  );
}

function GridCell({
  threadId,
  period,
  plotPoints,
  threadColor,
  onPlotPointClick,
  onPlotPointDelete,
}: {
  threadId: string;
  period: TimePeriod;
  plotPoints: PlotPoint[];
  threadColor: string;
  onPlotPointClick: (plotPoint: PlotPoint) => void;
  onPlotPointDelete: (plotPointId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${threadId}-${period.id}`,
    data: {
      threadId,
      periodId: period.id,
      periodStartDate: period.startDate,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[48px] border-b border-r border-border relative flex items-center justify-center transition-colors ${
        isOver ? 'bg-accent/20' : ''
      }`}
    >
      {/* Thread colour line */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{ height: '2px', backgroundColor: threadColor, opacity: 0.4 }}
      />
      {/* Dots */}
      {plotPoints.length > 0 && (
        <div className="relative z-10 flex items-center gap-1.5 flex-wrap justify-center px-2 py-1">
          {plotPoints.map((pp) => (
            <TimelineDot
              key={pp.id}
              plotPoint={pp}
              threadColor={threadColor}
              onClick={onPlotPointClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UndatedPlotPointsSection({
  thread,
  plotPoints,
  onPlotPointClick,
  onPlotPointDelete,
  isExpanded,
  onToggle,
}: {
  thread: Thread;
  plotPoints: PlotPoint[];
  onPlotPointClick: (plotPoint: PlotPoint) => void;
  onPlotPointDelete: (plotPointId: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (plotPoints.length === 0) return null;

  return (
    <>
      <div
        className="sticky left-0 z-10 bg-muted/50 border-b border-r border-border p-2 flex items-center gap-2 cursor-pointer hover:bg-muted"
        onClick={onToggle}
        style={{
          borderLeftColor: thread.color,
          borderLeftWidth: '4px',
        }}
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span className="font-medium text-sm flex-1">{thread.title} - Unscheduled ({plotPoints.length})</span>
      </div>
      {isExpanded && (
        <div className="border-b border-r border-border p-2 space-y-2 bg-muted/20 col-span-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {plotPoints.map((pp) => (
              <TimelineCard
                key={pp.id}
                plotPoint={pp}
                threadColor={thread.color}
                onClick={() => onPlotPointClick(pp)}
                onDelete={onPlotPointDelete}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function TimelineGrid({
  plotPoints,
  threads,
  onPlotPointClick,
  onPlotPointMove,
  onPlotPointDelete,
  onThreadReorder,
  onThreadVisibilityToggle,
  zoomLevel,
  dateRange,
}: TimelineGridProps) {
  const [activePlotPoint, setActivePlotPoint] = useState<PlotPoint | null>(null);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [expandedUndatedSections, setExpandedUndatedSections] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Generate time periods based on zoom level and date range
  const timePeriods = useMemo<TimePeriod[]>(() => {
    const datedPlotPoints = plotPoints.filter((pp) => pp.event_date);

    if (datedPlotPoints.length === 0) {
      return [];
    }

    const dates = datedPlotPoints.map((pp) => parseISO(pp.event_date!));
    let earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));
    let latestDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Apply date range filter if set
    if (dateRange.start) {
      earliestDate = parseISO(dateRange.start);
    }
    if (dateRange.end) {
      latestDate = parseISO(dateRange.end);
    }

    const periods: TimePeriod[] = [];

    switch (zoomLevel) {
      case 'week': {
        let currentDate = startOfWeek(earliestDate);
        while (currentDate <= latestDate) {
          const weekEnd = endOfWeek(currentDate);
          periods.push({
            id: format(currentDate, 'yyyy-MM-dd'),
            label: `${format(currentDate, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`,
            startDate: new Date(currentDate),
            endDate: weekEnd,
          });
          currentDate = addWeeks(currentDate, 1);
        }
        break;
      }
      case 'month': {
        let currentDate = startOfMonth(earliestDate);
        while (currentDate <= latestDate) {
          const monthEnd = endOfMonth(currentDate);
          periods.push({
            id: format(currentDate, 'yyyy-MM'),
            label: format(currentDate, 'MMMM yyyy'),
            startDate: new Date(currentDate),
            endDate: monthEnd,
          });
          currentDate = addMonths(currentDate, 1);
        }
        break;
      }
      case 'quarter': {
        let currentDate = startOfQuarter(earliestDate);
        while (currentDate <= latestDate) {
          const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
          const quarterEnd = endOfQuarter(currentDate);
          periods.push({
            id: `${currentDate.getFullYear()}-Q${quarter}`,
            label: `Q${quarter} ${currentDate.getFullYear()}`,
            startDate: new Date(currentDate),
            endDate: quarterEnd,
          });
          currentDate = addQuarters(currentDate, 1);
        }
        break;
      }
      case 'year': {
        let currentDate = startOfYear(earliestDate);
        while (currentDate <= latestDate) {
          const yearEnd = endOfYear(currentDate);
          periods.push({
            id: currentDate.getFullYear().toString(),
            label: currentDate.getFullYear().toString(),
            startDate: new Date(currentDate),
            endDate: yearEnd,
          });
          currentDate = addYears(currentDate, 1);
        }
        break;
      }
    }

    return periods;
  }, [plotPoints, zoomLevel, dateRange]);

  // Group plot points by thread and period
  const groupedPlotPoints = useMemo(() => {
    const groups: Record<string, Record<string, PlotPoint[]>> = {};
    const undated: Record<string, PlotPoint[]> = {};

    threads.forEach((thread) => {
      groups[thread.id] = {};
      undated[thread.id] = [];
      timePeriods.forEach((period) => {
        groups[thread.id][period.id] = [];
      });
    });

    plotPoints.forEach((pp) => {
      if (!pp.thread_id) return;

      if (!pp.event_date) {
        // Undated plot points
        undated[pp.thread_id]?.push(pp);
      } else {
        const ppDate = parseISO(pp.event_date);
        const period = timePeriods.find((p) => {
          return ppDate >= p.startDate && ppDate <= p.endDate;
        });

        if (period && groups[pp.thread_id]) {
          groups[pp.thread_id][period.id]?.push(pp);
        }
      }
    });

    return { dated: groups, undated };
  }, [plotPoints, threads, timePeriods]);

  const { visibleThreads, hiddenThreads } = useMemo(() => {
    const sorted = threads.sort((a, b) => a.sort_order - b.sort_order);
    return {
      visibleThreads: sorted.filter(t => t.is_visible),
      hiddenThreads: sorted.filter(t => !t.is_visible),
    };
  }, [threads]);

  const handleDragStart = (event: any) => {
    // Check if dragging a thread or plot point
    if (event.active.data.current?.plotPoint) {
      const plotPoint = event.active.data.current.plotPoint;
      setActivePlotPoint(plotPoint);
    } else if (threads.find(t => t.id === event.active.id)) {
      const thread = threads.find(t => t.id === event.active.id);
      setActiveThread(thread || null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id as string : null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    setOverId(null);

    if (!over) {
      setActivePlotPoint(null);
      setActiveThread(null);
      return;
    }

    // Handle thread reordering
    if (threads.find(t => t.id === active.id)) {
      const activeThreadObj = threads.find(t => t.id === active.id);
      const overThreadObj = threads.find(t => t.id === over.id);

      if (activeThreadObj && overThreadObj && activeThreadObj.id !== overThreadObj.id) {
        onThreadReorder(activeThreadObj.id, overThreadObj.id);
      }
      setActiveThread(null);
      return;
    }

    // Handle plot point movement
    if (!over.data.current) {
      setActivePlotPoint(null);
      return;
    }

    const plotPointId = active.id;
    const { threadId, periodStartDate } = over.data.current;

    // Calculate new event_date
    let newEventDate: string | null = null;
    if (periodStartDate) {
      newEventDate = format(periodStartDate, 'yyyy-MM-dd');
    }

    onPlotPointMove(plotPointId, threadId, newEventDate);
    setActivePlotPoint(null);
  };

  const handleDragCancel = () => {
    setActivePlotPoint(null);
    setActiveThread(null);
    setOverId(null);
  };

  const toggleUndatedSection = (threadId: string) => {
    setExpandedUndatedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  };

  if (timePeriods.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center p-8">
        <div>
          <h3 className="text-lg font-semibold mb-2">No dated plot points</h3>
          <p className="text-muted-foreground">
            Add plot points with dates to see the timeline view
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="overflow-auto h-full">
        <div className="inline-grid gap-0 border border-border" style={{
          gridTemplateColumns: `200px repeat(${timePeriods.length}, minmax(150px, 1fr))`,
        }}>
          {/* Header row */}
          <div className="sticky left-0 z-20 bg-muted border-b border-r border-border p-2 font-semibold">
            Threads
          </div>
          {timePeriods.map((period) => (
            <div
              key={period.id}
              className="bg-muted border-b border-r border-border p-2 font-semibold text-center text-sm"
            >
              {period.label}
            </div>
          ))}

          {/* Thread rows with sortable */}
          <SortableContext items={visibleThreads.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {visibleThreads.map((thread) => (
              <SortableThreadRow
                key={thread.id}
                thread={thread}
                onToggleVisibility={(threadId) => onThreadVisibilityToggle(threadId, false)}
                isOver={activeThread !== null && overId === thread.id && activeThread.id !== thread.id}
                isDraggingAnyThread={activeThread !== null}
              >
                {timePeriods.map((period) => (
                  <GridCell
                    key={`${thread.id}-${period.id}`}
                    threadId={thread.id}
                    period={period}
                    plotPoints={groupedPlotPoints.dated[thread.id]?.[period.id] || []}
                    threadColor={thread.color}
                    onPlotPointClick={onPlotPointClick}
                    onPlotPointDelete={onPlotPointDelete}
                  />
                ))}
              </SortableThreadRow>
            ))}
          </SortableContext>

          {/* Hidden threads (shown as thin lines) */}
          {hiddenThreads.map((thread) => (
            <React.Fragment key={`hidden-${thread.id}`}>
              <div
                style={{
                  borderLeftColor: thread.color,
                  borderLeftWidth: '4px',
                }}
                className="sticky left-0 z-10 bg-background border-b border-r border-border p-1 flex items-center gap-2"
              >
                <button
                  onClick={() => onThreadVisibilityToggle(thread.id, true)}
                  className="hover:bg-accent p-1 rounded"
                  title="Show thread"
                >
                  <EyeOff className="w-3 h-3 text-muted-foreground" />
                </button>
                <span className="font-medium text-xs text-muted-foreground flex-1">{thread.title}</span>
              </div>
              {timePeriods.map((period) => {
                const plotPointsInPeriod = groupedPlotPoints.dated[thread.id]?.[period.id] || [];
                const hasPlotPoints = plotPointsInPeriod.length > 0;

                return (
                  <div
                    key={`${thread.id}-${period.id}-hidden`}
                    className="border-b border-r border-border bg-muted/20 relative flex items-center justify-center"
                    style={{
                      height: '8px',
                      borderTopWidth: '2px',
                      borderTopColor: thread.color,
                    }}
                  >
                    {hasPlotPoints && (
                      <div
                        className="absolute rounded-full"
                        style={{
                          width: '6px',
                          height: '6px',
                          backgroundColor: thread.color,
                        }}
                        title={`${plotPointsInPeriod.length} plot point${plotPointsInPeriod.length > 1 ? 's' : ''}`}
                      />
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          {/* Undated plot points sections */}
          {visibleThreads.map((thread) => (
            <UndatedPlotPointsSection
              key={`undated-${thread.id}`}
              thread={thread}
              plotPoints={groupedPlotPoints.undated[thread.id] || []}
              onPlotPointClick={onPlotPointClick}
              onPlotPointDelete={onPlotPointDelete}
              isExpanded={expandedUndatedSections.has(thread.id)}
              onToggle={() => toggleUndatedSection(thread.id)}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activePlotPoint ? (
          <div className="p-3 rounded-md border-2 bg-card shadow-xl opacity-95 cursor-grabbing">
            <div className="font-semibold text-sm">{activePlotPoint.title}</div>
          </div>
        ) : activeThread ? (
          <div
            className="bg-primary text-primary-foreground shadow-xl cursor-grabbing flex items-center gap-2 px-3 py-2 rounded border-2 border-primary"
            style={{
              minWidth: '200px',
              borderLeftColor: activeThread.color,
              borderLeftWidth: '4px',
            }}
          >
            <GripVertical className="w-4 h-4" />
            <div className="font-semibold text-sm">{activeThread.title}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
