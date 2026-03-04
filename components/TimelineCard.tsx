'use client';

import { useDraggable } from '@dnd-kit/core';
import { Paperclip, X } from 'lucide-react';

interface TimelineCardProps {
  plotPoint: {
    id: string;
    narrative_id: string;
    title: string;
    description?: string | null;
    content: string;
    thread_id: string | null;
    event_date: string | null;
    sort_order: number;
    attachments?: string | null;
  };
  threadColor: string;
  onClick: () => void;
  onDelete?: (plotPointId: string) => void;
}

export function TimelineCard({ plotPoint, threadColor, onClick, onDelete }: TimelineCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: plotPoint.id,
    data: {
      plotPoint,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  // Strip HTML tags for preview
  const getTextPreview = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.length > 60 ? text.substring(0, 60) + '...' : text;
  };

  // Check if there are attachments
  const hasAttachments = plotPoint.attachments && (() => {
    try {
      const parsed = JSON.parse(plotPoint.attachments);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  })();

  const attachmentCount = hasAttachments ? (() => {
    try {
      return JSON.parse(plotPoint.attachments!).length;
    } catch {
      return 0;
    }
  })() : 0;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering onClick
    if (onDelete && confirm(`Delete "${plotPoint.title}"?`)) {
      onDelete(plotPoint.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="group p-3 rounded-md border-2 cursor-pointer hover:shadow-md transition-shadow bg-background relative"
      style={{
        borderColor: threadColor,
        ...style,
      }}
    >
      {/* Delete button - appears on hover */}
      {onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-1 right-1 w-5 h-5 rounded-sm bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive z-10"
          title="Delete plot point"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-semibold text-sm line-clamp-2 flex-1">{plotPoint.title}</div>
        {hasAttachments && (
          <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
            <Paperclip className="w-3 h-3" />
            <span className="text-xs">{attachmentCount}</span>
          </div>
        )}
      </div>
      {plotPoint.description && (
        <div className="text-xs text-foreground/80 mb-1 line-clamp-1">{plotPoint.description}</div>
      )}
      {!plotPoint.description && plotPoint.content && (
        <div className="text-xs text-muted-foreground line-clamp-2">
          {getTextPreview(plotPoint.content)}
        </div>
      )}
    </div>
  );
}
