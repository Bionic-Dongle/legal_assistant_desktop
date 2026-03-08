'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface Thread {
  id: string;
  title: string;
  color: string;
}

interface AutoPlotSuggestion {
  evidenceId: string;
  filename: string;
  memory_type: string;
  suggestedTitle: string;
  date: string | null;
  undated: boolean;
  content: string;
  document_type: string;
  legal_significance: string | null;
  // UI state
  selected: boolean;
  editTitle: string;
  editDate: string;
  editThread: string;
}

interface AutoPlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  narrativeId: string;
  threads: Thread[];
  currentPlotPointCount: number;
  onRefreshTimeline: () => void;
}

export function AutoPlotModal({
  isOpen,
  onClose,
  caseId,
  narrativeId,
  threads,
  currentPlotPointCount,
  onRefreshTimeline,
}: AutoPlotModalProps) {
  const [suggestions, setSuggestions] = useState<AutoPlotSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
  }, [isOpen]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/evidence/auto-plot?case_id=${caseId}`);
      const data = await res.json();
      const defaultThread = threads[0]?.title ?? '';

      const items: AutoPlotSuggestion[] = (data.suggestions ?? []).map((s: any) => ({
        ...s,
        // dated items selected by default; undated items require the user to opt-in
        selected: !s.undated,
        editTitle: s.suggestedTitle,
        editDate: s.date ?? '',
        editThread: defaultThread,
      }));

      setSuggestions(items);
    } catch {
      toast.error('Failed to load evidence suggestions');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (evidenceId: string) =>
    setSuggestions((prev) =>
      prev.map((s) => (s.evidenceId === evidenceId ? { ...s, selected: !s.selected } : s))
    );

  const toggleAll = () => {
    const allSelected = suggestions.every((s) => s.selected);
    setSuggestions((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  };

  const updateField = (evidenceId: string, field: keyof AutoPlotSuggestion, value: any) =>
    setSuggestions((prev) =>
      prev.map((s) => (s.evidenceId === evidenceId ? { ...s, [field]: value } : s))
    );

  const handleCreate = async () => {
    const selected = suggestions.filter((s) => s.selected);
    if (selected.length === 0) {
      toast.error('No items selected');
      return;
    }

    setCreating(true);
    const successIds: string[] = [];

    try {
      let offset = currentPlotPointCount;

      for (const s of selected) {
        const thread = threads.find((t) => t.title === s.editThread) ?? threads[0];
        const attachment = JSON.stringify([
          { type: 'file', name: s.filename, path: s.filename },
        ]);

        await fetch(`/api/narratives/${narrativeId}/plot-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: s.editTitle,
            content: s.content,
            event_date: s.editDate || null,
            thread_id: thread?.id ?? null,
            sort_order: offset++,
            attachments: attachment,
          }),
        });

        successIds.push(s.evidenceId);
      }

      // Mark evidence items as plotted so they don't show again
      await fetch('/api/evidence/auto-plot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceIds: successIds }),
      });

      toast.success(`Created ${successIds.length} plot point${successIds.length !== 1 ? 's' : ''}`);
      onRefreshTimeline();
      onClose();
    } catch (error) {
      console.error('Auto-plot error:', error);
      toast.error('Failed to create some plot points');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const dated = suggestions.filter((s) => !s.undated);
  const undated = suggestions.filter((s) => s.undated);
  const selectedCount = suggestions.filter((s) => s.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Auto-Plot Evidence</h2>
            {!loading && (
              <span className="text-sm text-muted-foreground ml-1">
                ({selectedCount} of {suggestions.length} selected)
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading evidence...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium">All evidence has been plotted</p>
              <p className="text-sm mt-1">Import more evidence via Cowork to see new suggestions here.</p>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="flex items-center gap-3 mb-5">
                <Button size="sm" variant="outline" onClick={toggleAll}>
                  {suggestions.every((s) => s.selected) ? 'Deselect All' : 'Select All'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Adjust titles, dates and threads before creating. Uncheck anything you don't want on the timeline.
                </span>
              </div>

              {/* Dated items */}
              {dated.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Dated — {dated.length} item{dated.length !== 1 ? 's' : ''}
                  </h3>
                  <div className="space-y-2">
                    {dated.map((s) => (
                      <SuggestionRow
                        key={s.evidenceId}
                        s={s}
                        threads={threads}
                        onToggle={() => toggle(s.evidenceId)}
                        onUpdate={(field, value) => updateField(s.evidenceId, field, value)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Undated items */}
              {undated.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Needs Dating — {undated.length} item{undated.length !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    No date found in these items. Enter a date to include them on the timeline, or leave them unchecked to skip for now.
                  </p>
                  <div className="space-y-2">
                    {undated.map((s) => (
                      <SuggestionRow
                        key={s.evidenceId}
                        s={s}
                        threads={threads}
                        onToggle={() => toggle(s.evidenceId)}
                        onUpdate={(field, value) => updateField(s.evidenceId, field, value)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {suggestions.length > 0 && (
          <div className="flex items-center justify-between p-5 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Already-plotted evidence won't show here again.
            </span>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || selectedCount === 0}>
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Create ${selectedCount} Plot Point${selectedCount !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Row sub-component ───────────────────────────────────────────────────────

interface SuggestionRowProps {
  s: AutoPlotSuggestion;
  threads: Thread[];
  onToggle: () => void;
  onUpdate: (field: keyof AutoPlotSuggestion, value: any) => void;
}

function SuggestionRow({ s, threads, onToggle, onUpdate }: SuggestionRowProps) {
  const memoryBadge: Record<string, string> = {
    plaintiff: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    opposition: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <div
      className={`p-3 border rounded-lg transition-colors ${
        s.selected ? 'border-primary bg-primary/5' : 'border-border opacity-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={s.selected}
          onChange={onToggle}
          className="mt-1 cursor-pointer"
        />
        <div className="flex-1 space-y-2">
          {/* Title + memory_type badge */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={s.editTitle}
              onChange={(e) => onUpdate('editTitle', e.target.value)}
              className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm font-medium"
              disabled={!s.selected}
            />
            <span
              className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                memoryBadge[s.memory_type] ?? memoryBadge.neutral
              }`}
            >
              {s.memory_type}
            </span>
          </div>

          {/* Date + Thread */}
          <div className="flex gap-2">
            <input
              type="date"
              value={s.editDate}
              onChange={(e) => onUpdate('editDate', e.target.value)}
              className="bg-background border border-border rounded px-2 py-1 text-xs"
              disabled={!s.selected}
            />
            <select
              value={s.editThread}
              onChange={(e) => onUpdate('editThread', e.target.value)}
              className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs"
              disabled={!s.selected}
            >
              {threads.map((t) => (
                <option key={t.id} value={t.title}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Legal significance preview */}
          {s.legal_significance && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {s.legal_significance}
            </p>
          )}

          {/* Filename + type */}
          <p className="text-xs text-muted-foreground/60">
            {s.document_type} · {s.filename}
          </p>
        </div>
      </div>
    </div>
  );
}
