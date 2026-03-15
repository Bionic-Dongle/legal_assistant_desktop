
'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChatTab } from '@/components/ChatTab';
import { EvidenceTab } from '@/components/EvidenceTab';
import { InsightsTab } from '@/components/InsightsTab';
import { SettingsTab } from '@/components/SettingsTab';
import { NarrativeConstructionTab } from '@/components/NarrativeConstructionTab';
import { MessageSquare, FileText, Lightbulb, Scale, CheckSquare, Database, Settings, FolderOpen, ChevronDown, Briefcase, Hammer, Wrench, Shield } from 'lucide-react';
import { ChatRepositoryTab } from '@/components/ChatRepositoryTab';
import { cn } from '@/lib/utils';

export default function Home() {
  const [caseId, setCaseId] = useState('');
  const [baserowEnabled, setBaserowEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    const res = await fetch('/api/cases');
    const data = await res.json();
    setCaseId(data?.cases?.[0]?.id ?? '');

    const settingsRes = await fetch('/api/settings');
    const settingsData = await settingsRes.json();
    setBaserowEnabled(settingsData?.baserow_enabled === 'true');
  };

  const workspaceTabs = ['chat', 'narrative', 'repository'];
  const materialsTabs = ['evidence', 'insights', 'arguments'];
  const utilitiesTabs = ['todos', 'settings', 'baserow'];

  const activeSection =
    workspaceTabs.includes(activeTab) ? 'workspace' :
    materialsTabs.includes(activeTab) ? 'materials' :
    'utilities';

  return (
    <div className="h-screen flex flex-col bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">

        {/* ── Nav bar ── */}
        <TabsList className="w-full rounded-none justify-start gap-0 px-0 h-auto">

          {/* Brand title */}
          <div className="flex items-center px-4 pr-6 border-r border-border h-full shrink-0">
            <span className="title-gradient text-sm font-bold tracking-[0.15em] uppercase select-none">
              LegalMind
            </span>
          </div>

          {/* Workspace */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "gap-2 px-5 py-3 h-auto rounded-none text-sm tracking-wide border-b-2 border-transparent transition-all",
                  activeSection === 'workspace' && "nav-active"
                )}
              >
                <Hammer className="w-3.5 h-3.5" />
                Workspace
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setActiveTab('chat')} className="gap-2 cursor-pointer">
                <MessageSquare className="w-4 h-4" />
                Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab('narrative')} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4" />
                Narrative Construction
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab('repository')} className="gap-2 cursor-pointer">
                <FolderOpen className="w-4 h-4" />
                Chat Repository
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Case Materials */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "gap-2 px-5 py-3 h-auto rounded-none text-sm tracking-wide border-b-2 border-transparent transition-all",
                  activeSection === 'materials' && "nav-active"
                )}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Case Materials
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setActiveTab('evidence')} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4" />
                Evidence
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab('insights')} className="gap-2 cursor-pointer">
                <Lightbulb className="w-4 h-4" />
                Key Insights
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab('arguments')} className="gap-2 cursor-pointer">
                <Scale className="w-4 h-4" />
                Arguments
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Utilities */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "gap-2 px-5 py-3 h-auto rounded-none text-sm tracking-wide border-b-2 border-transparent transition-all",
                  activeSection === 'utilities' && "nav-active"
                )}
              >
                <Wrench className="w-3.5 h-3.5" />
                Utilities
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setActiveTab('todos')} className="gap-2 cursor-pointer">
                <CheckSquare className="w-4 h-4" />
                To-Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab('settings')} className="gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />
                Settings
              </DropdownMenuItem>
              {baserowEnabled && (
                <DropdownMenuItem onClick={() => setActiveTab('baserow')} className="gap-2 cursor-pointer">
                  <Database className="w-4 h-4" />
                  Baserow
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Status badge */}
          <div className="flex items-center px-4 gap-2 shrink-0">
            <Shield className="w-3 h-3 text-neon-green" />
            <span className="text-xs tracking-widest uppercase font-mono badge-green px-2 py-0.5 rounded-sm">
              Local // Secure
            </span>
          </div>
        </TabsList>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="chat" className="h-full m-0">
            <ChatTab caseId={caseId} />
          </TabsContent>

          <TabsContent value="evidence" className="h-full m-0 overflow-y-auto">
            <EvidenceTab caseId={caseId} />
          </TabsContent>

          <TabsContent value="insights" className="h-full m-0 overflow-y-auto">
            <InsightsTab caseId={caseId} category="insight" />
          </TabsContent>

          <TabsContent value="arguments" className="h-full m-0 overflow-y-auto">
            <InsightsTab caseId={caseId} category="argument" />
          </TabsContent>

          <TabsContent value="todos" className="h-full m-0 overflow-y-auto">
            <InsightsTab caseId={caseId} category="todo" />
          </TabsContent>

          {baserowEnabled && (
            <TabsContent value="baserow" className="h-full m-0 overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">Baserow Data</h2>
                <p className="text-muted-foreground">
                  Baserow integration coming soon. Configure in Settings.
                </p>
              </div>
            </TabsContent>
          )}

          <TabsContent value="settings" className="h-full m-0 overflow-y-auto">
            <SettingsTab />
          </TabsContent>

          <TabsContent value="repository" className="h-full m-0 overflow-y-auto">
            <ChatRepositoryTab onOpenChat={() => setActiveTab('chat')} />
          </TabsContent>

          <TabsContent value="narrative" className="h-full m-0">
            <NarrativeConstructionTab caseId={caseId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
