'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

interface SaveChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCaseId: string;
  messages: any[];
  onSaved: () => void;
}

export function SaveChatModal({
  isOpen,
  onClose,
  currentCaseId,
  messages,
  onSaved,
}: SaveChatModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setSaving(true);
    try {
      const result = await window.electronAPI.saveChat({
        caseId: currentCaseId,
        name,
        description,
        messages,
      });
      if (result?.success) {
        toast.success('Chat saved');
        onSaved();
        onClose();
      } else {
        toast.error('Failed to save chat');
      }
    } catch (err) {
      toast.error('Error saving chat');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <div className="p-6 bg-secondary border border-border rounded-xl w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold">Name Chat</h2>
        <div className="space-y-3">
          <Input
            placeholder="Chat name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder="Short description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}