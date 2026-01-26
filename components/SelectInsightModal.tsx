'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Lightbulb, Scale, Search } from 'lucide-react';

interface SelectInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: { id: string; content: string; category: string }) => void;
  category: 'insight' | 'argument';
  caseId: string;
}

interface InsightItem {
  id: string;
  content: string;
  category: string;
  created_at: string;
}

export function SelectInsightModal({
  isOpen,
  onClose,
  onSelect,
  category,
  caseId,
}: SelectInsightModalProps) {
  const [items, setItems] = useState<InsightItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, category, caseId]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/insights?caseId=${caseId}&category=${category}`);
      if (!response.ok) throw new Error('Failed to load items');
      const data = await response.json();
      setItems(data.insights || []);
    } catch (error) {
      console.error('Error loading insights/arguments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = items.filter((item) =>
    item.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (item: InsightItem) => {
    onSelect(item);
    onClose();
  };

  const Icon = category === 'insight' ? Lightbulb : Scale;
  const title = category === 'insight' ? 'Select Key Insight' : 'Select Argument';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-9"
            />
          </div>

          {/* Items List */}
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No {category === 'insight' ? 'insights' : 'arguments'} found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full text-left p-4 border border-border rounded-md hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5 group-hover:text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-3">{item.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
