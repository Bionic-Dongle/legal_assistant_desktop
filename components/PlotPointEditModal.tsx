'use client';

import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Save, X, Paperclip, Link as LinkIcon, Trash2, File, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Attachment {
  type: 'file' | 'url';
  name: string;
  path?: string; // For files
  url?: string; // For URLs
}

interface PlotPointEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    content: string;
    event_date: string;
    thread_id: string;
    attachments?: string;
  }) => Promise<void>;
  plotPoint: {
    id: string;
    title: string;
    content: string;
    event_date: string | null;
    thread_id: string | null;
    attachments?: string | null;
  } | null;
  threads: Array<{
    id: string;
    title: string;
    color: string;
  }>;
}

export function PlotPointEditModal({
  isOpen,
  onClose,
  onSave,
  plotPoint,
  threads,
}: PlotPointEditModalProps) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [threadId, setThreadId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlName, setUrlName] = useState('');
  const [urlAddress, setUrlAddress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write your plot point content here...',
      }),
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4 border border-border rounded-md',
      },
    },
  });

  useEffect(() => {
    if (plotPoint) {
      setTitle(plotPoint.title);
      setEventDate(plotPoint.event_date || '');
      setThreadId(plotPoint.thread_id || threads[0]?.id || '');
      editor?.commands.setContent(plotPoint.content || '');

      // Parse attachments
      if (plotPoint.attachments) {
        try {
          const parsed = JSON.parse(plotPoint.attachments);
          setAttachments(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          setAttachments([]);
        }
      } else {
        setAttachments([]);
      }
    } else {
      setTitle('');
      setEventDate('');
      setThreadId(threads[0]?.id || '');
      editor?.commands.setContent('');
      setAttachments([]);
    }
  }, [plotPoint, threads, editor]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newAttachments.push({
        type: 'file',
        name: file.name,
        path: file.name, // Will be handled by file upload logic
      });
    }

    setAttachments([...attachments, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = () => {
    if (!urlName.trim() || !urlAddress.trim()) {
      toast.error('Please provide both name and URL');
      return;
    }

    setAttachments([
      ...attachments,
      {
        type: 'url',
        name: urlName.trim(),
        url: urlAddress.trim(),
      },
    ]);

    setUrlName('');
    setUrlAddress('');
    setShowUrlInput(false);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim() || !threadId) return;

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        content: editor?.getHTML() || '',
        event_date: eventDate,
        thread_id: threadId,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save plot point:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plotPoint ? 'Edit Plot Point' : 'New Plot Point'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter plot point title..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="thread">Narrative Thread</Label>
              <select
                id="thread"
                value={threadId}
                onChange={(e) => setThreadId(e.target.value)}
                className="w-full border border-border rounded-md p-2 bg-background"
              >
                {threads.map((thread) => (
                  <option key={thread.id} value={thread.id}>
                    {thread.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="eventDate">Event Date (optional)</Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Content</Label>
            <EditorContent editor={editor} />
          </div>

          {/* Attachments Section */}
          <div>
            <Label>Attachments</Label>
            <div className="space-y-2 mt-2">
              {/* Existing attachments */}
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/30"
                    >
                      {attachment.type === 'file' ? (
                        <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm flex-1 truncate">{attachment.name}</span>
                      {attachment.type === 'url' && attachment.url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => window.open(attachment.url, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add URL Input */}
              {showUrlInput && (
                <div className="p-3 border border-border rounded-md space-y-2 bg-background">
                  <div>
                    <Label htmlFor="urlName" className="text-xs">
                      Link Name
                    </Label>
                    <Input
                      id="urlName"
                      value={urlName}
                      onChange={(e) => setUrlName(e.target.value)}
                      placeholder="e.g., Evidence Photo"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="urlAddress" className="text-xs">
                      URL
                    </Label>
                    <Input
                      id="urlAddress"
                      value={urlAddress}
                      onChange={(e) => setUrlAddress(e.target.value)}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddUrl} className="flex-1">
                      Add Link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowUrlInput(false);
                        setUrlName('');
                        setUrlAddress('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Attachment Actions */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  Attach Files
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUrlInput(true)}
                  disabled={showUrlInput}
                  className="flex-1"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Add Link
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim() || !threadId}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
