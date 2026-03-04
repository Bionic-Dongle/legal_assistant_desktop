'use client';

import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Save, X, Paperclip, Link as LinkIcon, Trash2, File, ExternalLink, Lightbulb, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { SelectInsightModal } from './SelectInsightModal';

interface Attachment {
  type: 'file' | 'url' | 'insight' | 'argument';
  name: string;
  path?: string; // For files
  url?: string; // For URLs
  id?: string; // For insights/arguments
  content?: string; // Full content for insights/arguments
  preview?: string; // Snippet for hover tooltip
}

interface PlotPointEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    content: string;
    event_date: string;
    thread_id: string;
    attachments?: string;
  }) => Promise<void>;
  plotPoint: {
    id: string;
    title: string;
    description?: string | null;
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
  caseId: string;
}

export function PlotPointEditModal({
  isOpen,
  onClose,
  onSave,
  plotPoint,
  threads,
  caseId,
}: PlotPointEditModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [threadId, setThreadId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlName, setUrlName] = useState('');
  const [urlAddress, setUrlAddress] = useState('');
  const [showInsightSelect, setShowInsightSelect] = useState(false);
  const [showArgumentSelect, setShowArgumentSelect] = useState(false);
  const [viewingContent, setViewingContent] = useState<{ title: string; content: string } | null>(null);
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
      setDescription(plotPoint.description || '');
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
      setDescription('');
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

  const handleSelectInsight = (item: { id: string; content: string; category: string }) => {
    const preview = item.content.length > 100 ? item.content.substring(0, 100) + '...' : item.content;
    setAttachments([
      ...attachments,
      {
        type: 'insight',
        name: preview,
        id: item.id,
        content: item.content,
        preview: preview,
      },
    ]);
  };

  const handleSelectArgument = (item: { id: string; content: string; category: string }) => {
    const preview = item.content.length > 100 ? item.content.substring(0, 100) + '...' : item.content;
    setAttachments([
      ...attachments,
      {
        type: 'argument',
        name: preview,
        id: item.id,
        content: item.content,
        preview: preview,
      },
    ]);
  };

  const handleSave = async () => {
    if (!title.trim() || !threadId || !eventDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>{plotPoint ? 'Edit Plot Point' : 'New Plot Point'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div>
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter plot point title..."
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description <span className="text-muted-foreground text-xs font-normal">(one line — shown in timeline tooltip)</span></Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of this event..."
              maxLength={160}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="thread">Narrative Thread <span className="text-destructive">*</span></Label>
              <select
                id="thread"
                value={threadId}
                onChange={(e) => setThreadId(e.target.value)}
                className="w-full border border-border rounded-md p-2 bg-background"
                required
              >
                {threads.map((thread) => (
                  <option key={thread.id} value={thread.id}>
                    {thread.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="eventDate">Event Date <span className="text-destructive">*</span></Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
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
                  {attachments.map((attachment, index) => {
                    let Icon = File;
                    if (attachment.type === 'url') Icon = LinkIcon;
                    if (attachment.type === 'insight') Icon = Lightbulb;
                    if (attachment.type === 'argument') Icon = Scale;

                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/30 group relative"
                        title={attachment.preview || attachment.name}
                      >
                        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span
                          className="text-sm flex-1 truncate cursor-pointer"
                          onClick={() => {
                            if (attachment.type === 'insight' || attachment.type === 'argument') {
                              setViewingContent({
                                title: attachment.type === 'insight' ? 'Key Insight' : 'Argument',
                                content: attachment.content || attachment.name,
                              });
                            }
                          }}
                        >
                          {attachment.name}
                        </span>
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
                    );
                  })}
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
              <div className="grid grid-cols-2 gap-2">
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
                  title="Attach files from your computer"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  Attach Files
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUrlInput(true)}
                  disabled={showUrlInput}
                  title="Add a web link or reference URL"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Add Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowInsightSelect(true)}
                  title="Attach a saved key insight to this plot point"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Add Insight
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowArgumentSelect(true)}
                  title="Attach a saved argument to this plot point"
                >
                  <Scale className="w-4 h-4 mr-2" />
                  Add Argument
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0 bg-background">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim() || !threadId || !eventDate}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Select Insight Modal */}
      <SelectInsightModal
        isOpen={showInsightSelect}
        onClose={() => setShowInsightSelect(false)}
        onSelect={handleSelectInsight}
        category="insight"
        caseId={caseId}
      />

      {/* Select Argument Modal */}
      <SelectInsightModal
        isOpen={showArgumentSelect}
        onClose={() => setShowArgumentSelect(false)}
        onSelect={handleSelectArgument}
        category="argument"
        caseId={caseId}
      />

      {/* View Content Modal */}
      {viewingContent && (
        <Dialog open={!!viewingContent} onOpenChange={() => setViewingContent(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{viewingContent.title}</DialogTitle>
            </DialogHeader>
            <div className="p-6">
              <p className="whitespace-pre-wrap text-sm">{viewingContent.content}</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setViewingContent(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
