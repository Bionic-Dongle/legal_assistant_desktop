
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
import { MessageSquare, FileText, Lightbulb, Scale, CheckSquare, Database, Settings, FolderOpen, ChevronDown, Briefcase, Hammer, Wrench } from 'lucide-react';
import { ChatRepositoryTab } from '@/components/ChatRepositoryTab';

export default function Home() {
  const [caseId, setCaseId] = useState('');
  const [baserowEnabled, setBaserowEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    // Get first case ID
    const res = await fetch('/api/cases');
    const data = await res.json();
    setCaseId(data?.cases?.[0]?.id ?? '');

    // Check baserow setting
    const settingsRes = await fetch('/api/settings');
    const settingsData = await settingsRes.json();
    setBaserowEnabled(settingsData?.baserow_enabled === 'true');
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full rounded-none justify-start">
          {/* Workspace Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-6 py-2 h-auto">
                <Hammer className="w-4 h-4" />
                Workspace
                <ChevronDown className="w-3 h-3" />
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

          {/* Case Materials Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-6 py-2 h-auto">
                <Briefcase className="w-4 h-4" />
                Case Materials
                <ChevronDown className="w-3 h-3" />
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

          {/* Utilities Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-6 py-2 h-auto">
                <Wrench className="w-4 h-4" />
                Utilities
                <ChevronDown className="w-3 h-3" />
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
        </TabsList>

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
            <ChatRepositoryTab />
          </TabsContent>

          <TabsContent value="narrative" className="h-full m-0">
            <NarrativeConstructionTab caseId={caseId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
