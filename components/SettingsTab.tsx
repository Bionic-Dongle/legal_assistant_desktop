
'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select } from './ui/select';
import { toast } from 'sonner';

interface ModelOption {
  value: string;
  label: string;
  group?: string;
}

export function SettingsTab() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [mainChatProvider, setMainChatProvider] = useState('openai');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [openrouterModel, setOpenrouterModel] = useState('anthropic/claude-3.7-sonnet');
  const [baserowEnabled, setBaserowEnabled] = useState(false);
  const [baserowUrl, setBaserowUrl] = useState('http://localhost:8000');
  const [baserowToken, setBaserowToken] = useState('');
  const [systemPromptMain, setSystemPromptMain] = useState('');
  const [systemPromptNarrative, setSystemPromptNarrative] = useState('');
  const [systemPromptTimeline, setSystemPromptTimeline] = useState('');
  const [globalRules, setGlobalRules] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-3-7-sonnet-20250219');
  const [timelineApiPreference, setTimelineApiPreference] = useState('openai');

  const [openrouterModels, setOpenrouterModels] = useState<ModelOption[]>([]);
  const [openaiModels, setOpenaiModels] = useState<ModelOption[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    provider: true,
    openai: false,
    openrouter: false,
    claude: false,
    timeline: false,
    prompts: false,
    baserow: false,
    storage: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    loadSettings();
    fetchModels();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setOpenaiKey(data?.openai_key ?? '');
      setOpenaiModel(data?.openai_model ?? 'gpt-4o-mini');
      setMainChatProvider(data?.main_chat_provider ?? 'openai');
      setOpenrouterKey(data?.openrouter_key ?? '');
      setOpenrouterModel(data?.openrouter_model ?? 'anthropic/claude-3.7-sonnet');
      setBaserowEnabled(data?.baserow_enabled === 'true');
      setBaserowUrl(data?.baserow_url ?? 'http://localhost:8000');
      setBaserowToken(data?.baserow_token ?? '');
      setSystemPromptMain(data?.main_chat_system_prompt ?? data?.system_prompt_main ?? data?.custom_system_prompt ?? '');
      setSystemPromptNarrative(data?.system_prompt_narrative ?? '');
      setSystemPromptTimeline(data?.system_prompt_timeline ?? '');
      setGlobalRules(data?.global_rules ?? '');
      setAnthropicKey(data?.anthropic_api_key ?? '');
      setClaudeModel(data?.claude_model ?? 'claude-3-7-sonnet-20250219');
      setTimelineApiPreference(data?.timeline_api_preference ?? 'openai');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const fetchModels = async () => {
    setFetchingModels(true);
    try {
      const [orRes, oaiRes] = await Promise.allSettled([
        fetch('/api/models/openrouter'),
        fetch('/api/models/openai'),
      ]);

      if (orRes.status === 'fulfilled' && orRes.value.ok) {
        const orData = await orRes.value.json();
        const providerNames: Record<string, string> = {
          anthropic: 'Anthropic Claude',
          openai: 'OpenAI',
          google: 'Google',
          'meta-llama': 'Meta Llama',
          deepseek: 'DeepSeek',
          mistralai: 'Mistral',
          qwen: 'Qwen / Alibaba',
          microsoft: 'Microsoft',
          cohere: 'Cohere',
          perplexity: 'Perplexity',
          'x-ai': 'xAI / Grok',
          nvidia: 'NVIDIA',
        };
        const models: ModelOption[] = (orData.data || []).map((m: { id: string; name?: string }) => {
          const provider = m.id.split('/')[0];
          return {
            value: m.id,
            label: m.name || m.id,
            group: providerNames[provider] ?? provider,
          };
        });
        models.sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label));
        setOpenrouterModels(models);
      }

      if (oaiRes.status === 'fulfilled' && oaiRes.value.ok) {
        const oaiData = await oaiRes.value.json();
        const models: ModelOption[] = (oaiData.data || []).map((m: { id: string }) => {
          let group = 'GPT-4 Series';
          if (m.id.startsWith('gpt-4.1')) group = 'GPT-4.1 Series';
          else if (/^o[1-9]/.test(m.id)) group = 'Reasoning (o-series)';
          else if (m.id.startsWith('gpt-3.5')) group = 'GPT-3.5 (older)';
          return { value: m.id, label: m.id, group };
        });
        setOpenaiModels(models);
      }
    } catch (e) {
      console.error('Failed to fetch models:', e);
    } finally {
      setFetchingModels(false);
    }
  };

  const saveSettings = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openai_key: openaiKey,
          openai_model: openaiModel,
          main_chat_provider: mainChatProvider,
          openrouter_key: openrouterKey,
          openrouter_model: openrouterModel,
          baserow_enabled: baserowEnabled.toString(),
          baserow_url: baserowUrl,
          baserow_token: baserowToken,
          main_chat_system_prompt: systemPromptMain,
          system_prompt_narrative: systemPromptNarrative,
          system_prompt_timeline: systemPromptTimeline,
          global_rules: globalRules,
          anthropic_api_key: anthropicKey,
          claude_model: claudeModel,
          timeline_api_preference: timelineApiPreference,
        }),
      });

      if (openaiKey && openaiKey.startsWith('sk-')) {
        await fetch('/api/env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'OPENAI_API_KEY', value: openaiKey }),
        });
      }

      if (anthropicKey && anthropicKey.startsWith('sk-')) {
        await fetch('/api/env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'ANTHROPIC_API_KEY', value: anthropicKey }),
        });
      }

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

  // Reusable section header
  function SectionHeader({ sectionKey, title, summary }: { sectionKey: string; title: string; summary?: string }) {
    return (
      <button
        type="button"
        onClick={() => toggleSection(sectionKey)}
        className="flex w-full items-center justify-between p-5 text-left hover:bg-muted/40 transition-colors"
      >
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {summary && <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>}
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${openSections[sectionKey] ? 'rotate-180' : ''}`}
        />
      </button>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-3">

        {/* OpenAI Configuration */}
        <div className="border border-border rounded-lg overflow-hidden">
          <SectionHeader
            sectionKey="openai"
            title="OpenAI Configuration"
            summary={openaiKey ? `Key set · ${openaiModel}` : 'No key set'}
          />
          {openSections.openai && (
            <div className="px-5 pb-5 space-y-4 border-t border-border">
              <div className="space-y-2 pt-4">
                <Label htmlFor="openai-key">API Key</Label>
                <Input
                  id="openai-key"
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e?.target?.value ?? '')}
                  placeholder="sk-..."
                />
                <p className="text-sm text-muted-foreground">
                  Get one at{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    platform.openai.com
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="openai-model">Model</Label>
                  <Button variant="ghost" size="sm" onClick={fetchModels} disabled={fetchingModels} className="h-6 text-xs px-2">
                    {fetchingModels ? 'Loading…' : '↻ Refresh'}
                  </Button>
                </div>
                <Select
                  id="openai-model"
                  value={openaiModel}
                  onValueChange={setOpenaiModel}
                  options={openaiModels.length > 0 ? openaiModels : [
                    { value: 'gpt-4o-mini', label: 'gpt-4o-mini (default — refresh to load full list)' },
                  ]}
                />
                <p className="text-sm text-muted-foreground">
                  Only applies when Main Chat Provider is set to OpenAI.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* OpenRouter Configuration */}
        <div className="border border-border rounded-lg overflow-hidden">
          <SectionHeader
            sectionKey="openrouter"
            title="OpenRouter Configuration"
            summary={openrouterKey ? `Key set · ${openrouterModel}` : 'No key set'}
          />
          {openSections.openrouter && (
            <div className="px-5 pb-5 space-y-4 border-t border-border">
              <div className="space-y-2 pt-4">
                <Label htmlFor="openrouter-key">API Key</Label>
                <Input
                  id="openrouter-key"
                  type="password"
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e?.target?.value ?? '')}
                  placeholder="sk-or-..."
                />
                <p className="text-sm text-muted-foreground">
                  Get one at{' '}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    openrouter.ai/keys
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="openrouter-model">Model</Label>
                  <Button variant="ghost" size="sm" onClick={fetchModels} disabled={fetchingModels} className="h-6 text-xs px-2">
                    {fetchingModels ? 'Loading…' : `↻ Refresh${openrouterModels.length > 0 ? ` (${openrouterModels.length})` : ''}`}
                  </Button>
                </div>
                <Select
                  id="openrouter-model"
                  value={openrouterModel}
                  onValueChange={setOpenrouterModel}
                  options={openrouterModels.length > 0 ? openrouterModels : [
                    { value: 'anthropic/claude-3.7-sonnet', label: 'anthropic/claude-3.7-sonnet (default — refresh to load full list)' },
                  ]}
                />
                <p className="text-sm text-muted-foreground">
                  {openrouterModels.length > 0
                    ? `${openrouterModels.length} models loaded from OpenRouter.`
                    : 'Hit Refresh to load the full model list from OpenRouter.'}{' '}
                  Browse at{' '}
                  <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    openrouter.ai/models
                  </a>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Claude / Anthropic Configuration */}
        <div className="border border-border rounded-lg overflow-hidden">
          <SectionHeader
            sectionKey="claude"
            title="Claude (Anthropic) Configuration"
            summary={anthropicKey ? `Key set · ${claudeModel}` : 'No key set'}
          />
          {openSections.claude && (
            <div className="px-5 pb-5 space-y-4 border-t border-border">
              <div className="space-y-2 pt-4">
                <Label htmlFor="anthropic-key">API Key</Label>
                <Input
                  id="anthropic-key"
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e?.target?.value ?? '')}
                  placeholder="sk-ant-..."
                />
                <p className="text-sm text-muted-foreground">
                  Get one at{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    console.anthropic.com
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="claude-model">Model</Label>
                <Select
                  id="claude-model"
                  value={claudeModel}
                  onValueChange={setClaudeModel}
                  options={[
                    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Latest, recommended)' },
                    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
                    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
                    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Most powerful)' },
                  ]}
                />
                <p className="text-sm text-muted-foreground">
                  Used for Timeline Chat when provider is set to Claude.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Main Chat Provider */}
        <div className="border border-border rounded-lg overflow-hidden">
          <SectionHeader
            sectionKey="provider"
            title="Main Chat — Provider"
            summary={mainChatProvider === 'openai' ? 'Using OpenAI' : 'Using OpenRouter'}
          />
          {openSections.provider && (
            <div className="px-5 pb-5 space-y-4 border-t border-border">
              <div className="space-y-2 pt-4">
                <Label htmlFor="main-provider">AI Provider for Main Chat</Label>
                <Select
                  id="main-provider"
                  value={mainChatProvider}
                  onValueChange={setMainChatProvider}
                  options={[
                    { value: 'openai', label: 'OpenAI (uses OpenAI key + model above)' },
                    { value: 'openrouter', label: 'OpenRouter (access 200+ models via one key)' },
                  ]}
                />
                <p className="text-sm text-muted-foreground">
                  OpenRouter lets you use Claude, Gemini, Llama, Mistral and more — all through a single API key.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Timeline Chat Preferences */}
        <div className="border border-border rounded-lg overflow-hidden">
          <SectionHeader
            sectionKey="timeline"
            title="Timeline Chat — Provider"
            summary={timelineApiPreference === 'openai' ? 'Using OpenAI' : 'Using Claude'}
          />
          {openSections.timeline && (
            <div className="px-5 pb-5 space-y-4 border-t border-border">
              <div className="space-y-2 pt-4">
                <Label htmlFor="timeline-api">Preferred AI Provider</Label>
                <Select
                  id="timeline-api"
                  value={timelineApiPreference}
                  onValueChange={setTimelineApiPreference}
                  options={[
                    { value: 'openai', label: 'OpenAI (GPT)' },
                    { value: 'claude', label: 'Claude (Anthropic)' },
                  ]}
                />
                <p className="text-sm text-muted-foreground">
                  Which AI runs the Timeline Assistant chat.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* System Prompts */}
        <div className="border border-border rounded-lg overflow-hidden">
          <SectionHeader
            sectionKey="prompts"
            title="System Prompts"
            summary={
              [systemPromptMain, systemPromptNarrative, systemPromptTimeline, globalRules].filter(Boolean).length > 0
                ? `${[systemPromptMain, systemPromptNarrative, systemPromptTimeline, globalRules].filter(Boolean).length} prompt(s) configured`
                : 'None set — using defaults'
            }
          />
          {openSections.prompts && (
            <div className="px-5 pb-5 space-y-5 border-t border-border">
              <p className="text-sm text-muted-foreground pt-4">
                These overlay the default AI behaviour for each chat type.
              </p>

              <div className="space-y-2">
                <Label htmlFor="prompt-main" className="font-medium">Main Chat</Label>
                <textarea
                  id="prompt-main"
                  className="w-full min-h-[100px] border border-border rounded-md p-3 text-sm font-mono bg-background text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  value={systemPromptMain}
                  onChange={(e) => setSystemPromptMain(e?.target?.value ?? '')}
                  placeholder="e.g. You are my strategic legal advisor. Focus on risk analysis."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt-narrative" className="font-medium">Narrative Chat</Label>
                <textarea
                  id="prompt-narrative"
                  className="w-full min-h-[100px] border border-border rounded-md p-3 text-sm font-mono bg-background text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  value={systemPromptNarrative}
                  onChange={(e) => setSystemPromptNarrative(e?.target?.value ?? '')}
                  placeholder="e.g. Help me craft compelling narratives backed by evidence."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt-timeline" className="font-medium">Timeline Chat</Label>
                <textarea
                  id="prompt-timeline"
                  className="w-full min-h-[100px] border border-border rounded-md p-3 text-sm font-mono bg-background text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  value={systemPromptTimeline}
                  onChange={(e) => setSystemPromptTimeline(e?.target?.value ?? '')}
                  placeholder="Leave empty to use default timeline assistant behaviour."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="global-rules" className="font-medium">Global Rules</Label>
                <p className="text-xs text-muted-foreground">Prepended to every prompt across all chats.</p>
                <textarea
                  id="global-rules"
                  className="w-full min-h-[100px] border border-border rounded-md p-3 text-sm font-mono bg-background text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  value={globalRules}
                  onChange={(e) => setGlobalRules(e?.target?.value ?? '')}
                  placeholder="e.g. Always cite sources. Be concise. Use formal legal language."
                />
              </div>
            </div>
          )}
        </div>

        {/* Baserow Integration */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('baserow')}
            className="flex w-full items-center justify-between p-5 text-left hover:bg-muted/40 transition-colors"
          >
            <div>
              <h3 className="text-base font-semibold">Baserow Integration</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{baserowEnabled ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div className="flex items-center gap-3">
              <span onClick={(e) => e.stopPropagation()}>
                <Switch checked={baserowEnabled} onCheckedChange={setBaserowEnabled} />
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${openSections.baserow ? 'rotate-180' : ''}`}
              />
            </div>
          </button>
          {openSections.baserow && (
            <div className="px-5 pb-5 space-y-4 border-t border-border">
              <p className="text-sm text-muted-foreground pt-4">
                Store structured case data in Baserow tables. Requires Docker Desktop running locally.
              </p>
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
            </div>
          )}
        </div>

        {/* Local Storage */}
        <div className="border border-border rounded-lg overflow-hidden">
          <SectionHeader
            sectionKey="storage"
            title="Local Storage"
            summary="All data stored on your machine — no cloud"
          />
          {openSections.storage && (
            <div className="px-5 pb-5 border-t border-border">
              <div className="space-y-2 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Database:</span>
                  <span className="font-mono text-xs">%APPDATA%\LegalMind\data\legal_assistant.db</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vector Store:</span>
                  <span className="font-mono text-xs">%APPDATA%\LegalMind\data\vectors\</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Evidence Files:</span>
                  <span className="font-mono text-xs">%APPDATA%\LegalMind\data\evidence\</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Chat History:</span>
                  <span className="font-mono text-xs">%APPDATA%\legal_assistant_desktop\chats\</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <Button onClick={saveSettings} size="lg" className="w-full">
          Save Settings
        </Button>
      </div>
    </div>
  );
}
