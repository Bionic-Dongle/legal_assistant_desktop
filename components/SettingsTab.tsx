
'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { toast } from 'sonner';

export function SettingsTab() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [baserowEnabled, setBaserowEnabled] = useState(false);
  const [baserowUrl, setBaserowUrl] = useState('http://localhost:8000');
  const [baserowToken, setBaserowToken] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setOpenaiKey(data?.openai_key ?? '');
      setBaserowEnabled(data?.baserow_enabled === 'true');
      setBaserowUrl(data?.baserow_url ?? 'http://localhost:8000');
      setBaserowToken(data?.baserow_token ?? '');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };


    // New state for custom system prompt
    const [customPrompt, setCustomPrompt] = useState('');
  
    useEffect(() => {
      // Fetch current settings for custom prompt, if available
      const loadCustomPrompt = async () => {
        try {
          const res = await fetch('/api/settings');
          const data = await res.json();
          setCustomPrompt(data?.custom_system_prompt ?? '');
        } catch (error) {
          console.error('Failed to load custom prompt:', error);
        }
      };
      loadCustomPrompt();
    }, []);
  const saveSettings = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openai_key: openaiKey,
          baserow_enabled: baserowEnabled.toString(),
          baserow_url: baserowUrl,
          baserow_token: baserowToken,
          custom_system_prompt: customPrompt,
        }),
      });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const testBaserow = async () => {
    try {
      const res = await fetch('/api/baserow/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: baserowUrl, token: baserowToken }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success('Baserow connection successful!');
      } else {
        toast.error('Baserow connection failed: ' + (data?.error ?? 'Unknown error'));
      }
    } catch (error) {
      toast.error('Failed to test connection');
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-8">
        {/* OpenAI Settings */}
        <div className="border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">OpenAI Configuration</h3>
          <div className="space-y-2">
            <Label htmlFor="openai-key">API Key</Label>
            <Input
              id="openai-key"
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e?.target?.value ?? '')}
              placeholder="sk-..."
            />
            <p className="text-sm text-muted-foreground">
              Your OpenAI API key for AI-powered analysis. Get one at{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                platform.openai.com
              </a>
            </p>
          </div>
  
          {/* Custom System Prompt */}
          <div className="border border-border rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">Custom System Prompt</h3>
            <p className="text-sm text-muted-foreground">
              Modify LegalMind’s core identity and behavior by providing a personal system prompt addition below.
              This overlay merges with the backend cognitive base.
            </p>
            <textarea
              className="w-full min-h-[150px] border border-border rounded-md p-3 text-sm font-mono bg-background text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e?.target?.value ?? '')}
              placeholder={"Example: You are my private legal strategist. Speak informally and focus on risk analysis."}
            />
          </div>
        </div>

        {/* Baserow Settings */}
        <div className="border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Baserow Integration</h3>
            <Switch
              checked={baserowEnabled}
              onCheckedChange={setBaserowEnabled}
            />
          </div>

          {baserowEnabled && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baserow-url">Baserow URL</Label>
                <Input
                  id="baserow-url"
                  value={baserowUrl}
                  onChange={(e) => setBaserowUrl(e?.target?.value ?? '')}
                  placeholder="http://localhost:8000"
                />
                <p className="text-sm text-muted-foreground">
                  The URL where your local Baserow instance is running
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baserow-token">API Token</Label>
                <Input
                  id="baserow-token"
                  type="password"
                  value={baserowToken}
                  onChange={(e) => setBaserowToken(e?.target?.value ?? '')}
                  placeholder="Your Baserow API token"
                />
              </div>

              <Button variant="outline" onClick={testBaserow}>
                Test Connection
              </Button>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Enable Baserow to store structured case data in tables. Requires Docker Desktop to be running.
          </p>
        </div>

        {/* Storage Info */}
        <div className="border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">Local Storage</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Database:</span>
              <span className="font-mono">./data/legal_assistant.db</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vector Store:</span>
              <span className="font-mono">./data/chroma_data/</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Evidence Files:</span>
              <span className="font-mono">./data/evidence/</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            All data is stored locally on your machine. No cloud storage.
          </p>
        </div>

        <Button onClick={saveSettings} size="lg" className="w-full">
          Save Settings
        </Button>
      </div>
    </div>
  );
}
