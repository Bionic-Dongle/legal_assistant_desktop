'use client';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ZoomIn, ZoomOut, Calendar, Eye, EyeOff } from 'lucide-react';

interface TimelineToolbarProps {
  zoomLevel: 'year' | 'quarter' | 'month' | 'week';
  onZoomChange: (level: 'year' | 'quarter' | 'month' | 'week') => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  threads: Array<{ id: string; title: string; is_visible: boolean }>;
  onToggleThreadVisibility: (threadId: string) => void;
}

export function TimelineToolbar({
  zoomLevel,
  onZoomChange,
  dateRange,
  onDateRangeChange,
  threads,
  onToggleThreadVisibility,
}: TimelineToolbarProps) {
  const zoomLevels: Array<'year' | 'quarter' | 'month' | 'week'> = ['year', 'quarter', 'month', 'week'];
  const currentIndex = zoomLevels.indexOf(zoomLevel);

  const handleZoomIn = () => {
    if (currentIndex < zoomLevels.length - 1) {
      onZoomChange(zoomLevels[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    if (currentIndex > 0) {
      onZoomChange(zoomLevels[currentIndex - 1]);
    }
  };

  return (
    <div className="border-b border-border p-3 space-y-3">
      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold">Zoom:</Label>
        <Button
          size="sm"
          variant="outline"
          onClick={handleZoomOut}
          disabled={currentIndex === 0}
          title="Zoom out (broader time periods)"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <div className="flex gap-1">
          {zoomLevels.map((level) => (
            <Button
              key={level}
              size="sm"
              variant={zoomLevel === level ? 'default' : 'outline'}
              onClick={() => onZoomChange(level)}
              className="min-w-[60px]"
            >
              {level}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleZoomIn}
          disabled={currentIndex === zoomLevels.length - 1}
          title="Zoom in (finer time periods)"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold">
          <Calendar className="w-3 h-3 inline mr-1" />
          Focus Range:
        </Label>
        <Input
          type="date"
          value={dateRange.start}
          onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
          className="w-40"
          size={1}
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={dateRange.end}
          onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
          className="w-40"
          size={1}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDateRangeChange({ start: '', end: '' })}
        >
          Clear
        </Button>
      </div>

      {/* Thread Visibility Toggles */}
      <div className="flex items-start gap-2">
        <Label className="text-xs font-semibold pt-2 whitespace-nowrap">Threads:</Label>
        <div className="flex gap-2 flex-wrap">
          {threads.map((thread) => (
            <Button
              key={thread.id}
              size="sm"
              variant={thread.is_visible ? 'default' : 'outline'}
              onClick={() => onToggleThreadVisibility(thread.id)}
              className="text-xs"
            >
              {thread.is_visible ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
              {thread.title}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
