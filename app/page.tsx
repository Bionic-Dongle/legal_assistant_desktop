
'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatTab } from '@/components/ChatTab';
import { EvidenceTab } from '@/components/EvidenceTab';
import { InsightsTab } from '@/components/InsightsTab';
import { SettingsTab } from '@/components/SettingsTab';
import { MessageSquare, FileText, Lightbulb, Scale, CheckSquare, Database, Settings } from 'lucide-react';

export default function Home() {
  const [caseId, setCaseId] = useState('');
  const [baserowEnabled, setBaserowEnabled] = useState(false);

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
      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <TabsList className="w-full rounded-none">
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-2">
            <FileText className="w-4 h-4" />
            Evidence
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <Lightbulb className="w-4 h-4" />
            Key Insights
          </TabsTrigger>
          <TabsTrigger value="arguments" className="gap-2">
            <Scale className="w-4 h-4" />
            Arguments
          </TabsTrigger>
          <TabsTrigger value="todos" className="gap-2">
            <CheckSquare className="w-4 h-4" />
            To-Do
          </TabsTrigger>
          {baserowEnabled && (
            <TabsTrigger value="baserow" className="gap-2">
              <Database className="w-4 h-4" />
              Baserow
            </TabsTrigger>
          )}
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
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
        </div>
      </Tabs>
    </div>
  );
}
