
'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Insight {
  id: string;
  content: string;
  category: string;
  tags: string;
  created_at: string;
  completed: number;
}

export function InsightsTab({ caseId, category }: { caseId: string; category: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    loadInsights();
  }, [caseId, category]);

  const loadInsights = async () => {
    try {
      const res = await fetch(`/api/insights?caseId=${caseId}&category=${category}`);
      const data = await res.json();
      setInsights(data?.insights ?? []);
    } catch (error) {
      console.error('Failed to load insights:', error);
    }
  };

  const addInsight = async () => {
    if (!newContent?.trim()) return;

    try {
      await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, content: newContent, category }),
      });
      setNewContent('');
      toast.success('Added successfully');
      loadInsights();
    } catch (error) {
      toast.error('Failed to add');
    }
  };

  const deleteInsight = async (id: string) => {
    try {
      await fetch(`/api/insights?id=${id}`, { method: 'DELETE' });
      toast.success('Deleted');
      loadInsights();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const toggleComplete = async (id: string, completed: number) => {
    try {
      await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completed: completed ? 0 : 1 }),
      });
      loadInsights();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">
          Add New {category === 'insight' ? 'Insight' : category === 'argument' ? 'Argument' : 'To-Do'}
        </h3>
        <div className="flex gap-3">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e?.target?.value ?? '')}
            placeholder={`Enter ${category}...`}
            className="flex-1"
          />
          <Button onClick={addInsight} disabled={!newContent?.trim()}>
            <Plus className="w-5 h-5 mr-2" />
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {insights?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No {category}s saved yet</p>
            <p className="text-sm mt-2">
              {category === 'todo' 
                ? 'Add tasks to keep track of what needs to be done'
                : 'Save important points from your conversations'}
            </p>
          </div>
        ) : (
          insights?.map?.((item) => (
            <div
              key={item?.id}
              className="border border-border rounded-lg p-5 bg-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className={`text-base ${item?.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {item?.content}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {new Date(item?.created_at ?? '').toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {category === 'todo' && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleComplete(item?.id ?? '', item?.completed ?? 0)}
                    >
                      <CheckCircle2
                        className={`w-5 h-5 ${item?.completed ? 'text-green-500' : 'text-muted-foreground'}`}
                      />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteInsight(item?.id ?? '')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
