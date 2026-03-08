'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { FolderOpen, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

interface SavedChatFile {
  name: string;
  content: any;
}

export function ChatRepositoryTab({ onOpenChat }: { onOpenChat?: () => void }) {
  const [chats, setChats] = useState<SavedChatFile[]>([]);
  const [search, setSearch] = useState('');
  const [selectedChat, setSelectedChat] = useState<SavedChatFile | null>(null);

  useEffect(() => {
    loadLocalChats();
  }, []);

  const loadLocalChats = async () => {
    try {
      const saved = await window.electronAPI.getSavedChats();
      const loaded: SavedChatFile[] = [];
      for (const file of saved) {
        try {
          const content = await window.electronAPI.loadChat(file.name);
          loaded.push({ name: file.name, content });
        } catch {}
      }
      setChats(loaded);
      toast.success('Loaded saved chats');
    } catch (err) {
      console.error('Failed to load chats:', err);
      toast.error('Error loading saved chats');
    }
  };

  const filtered = chats.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="p-4 h-full overflow-y-auto space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button
          onClick={loadLocalChats}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCcw className="w-4 h-4" />
          Reload
        </Button>
      </div>

      <div className="space-y-1.5">
        {filtered.length === 0 && <p>No saved chats found.</p>}
        {filtered.map((chat) => (
          <div
            key={chat.name}
            className="flex items-center justify-between px-3 py-1.5 rounded-md border bg-muted/30 hover:bg-muted/60 transition"
            title={chat.content?.description || 'No description available'}
          >
            <span className="text-sm truncate flex-1 min-w-0 mr-3">{chat.name}</span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0 mr-2 whitespace-nowrap">
              {chat.content?.messages?.length ?? 0} msgs
            </span>
            <div className="flex gap-1.5 flex-shrink-0">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs px-2"
                onClick={async () => {
                  const result = await window.electronAPI.archiveChat(chat.name);
                  if (result?.success) {
                    toast.success('Chat archived');
                    setChats((prev) => prev.filter((c) => c.name !== chat.name));
                  } else {
                    toast.error(result?.error || 'Failed to archive chat');
                  }
                }}
              >
                Archive
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2"
                onClick={async () => {
                  const loaded = await window.electronAPI.loadChat(chat.name);
                  if (loaded?.messages) {
                    localStorage.removeItem('activeChat');
                    localStorage.removeItem('activeSessionId');
                    window.dispatchEvent(new CustomEvent('chat-loaded', { detail: loaded.messages }));
                    onOpenChat?.();
                    toast.success(`Opened: ${chat.name}`);
                  } else {
                    toast.error('Failed to open chat');
                  }
                }}
              >
                Open Chat
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
