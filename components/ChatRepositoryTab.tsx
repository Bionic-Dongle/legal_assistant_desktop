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

export function ChatRepositoryTab() {
  const [chats, setChats] = useState<SavedChatFile[]>([]);
  const [search, setSearch] = useState('');

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
    <div className="p-6 h-full overflow-y-auto space-y-6">
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

      <div className="space-y-3">
        {filtered.length === 0 && <p>No saved chats found.</p>}
        {filtered.map((chat) => (
          <div
            key={chat.name}
            className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition"
          >
            <span>{chat.name}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(chat.content, null, 2))}
              >
                Copy JSON
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={async () => {
                  const result = await window.electronAPI.archiveChat(chat.name);
                  if (result?.success) {
                    toast.success("Chat archived");
                    setChats((prev) => prev.filter((c) => c.name !== chat.name));
                  } else {
                    toast.error(result?.error || "Failed to archive chat");
                  }
                }}
              >
                Archive
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const loaded = await window.electronAPI.loadChat(chat.name);
                  if (loaded?.messages) {
                    localStorage.setItem("activeChat", JSON.stringify(loaded.messages));
                    localStorage.setItem("activeSessionId", loaded.sessionId || chat.name);
                    toast.success(`Opened ${chat.name}`);
                    window.dispatchEvent(new CustomEvent("chat-loaded", { detail: loaded.messages }));
                  } else {
                    toast.error("Failed to open chat");
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