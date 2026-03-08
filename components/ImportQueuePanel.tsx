'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Inbox, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ImportQueuePanelProps {
  caseId: string;
  onImportComplete: () => void;
}

export function ImportQueuePanel({ caseId, onImportComplete }: ImportQueuePanelProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    checkQueue();
  }, []);

  const checkQueue = async () => {
    try {
      const res = await fetch('/api/evidence/import-queue');
      const data = await res.json();
      setPendingCount(data.pending ?? 0);
    } catch {
      // Silent fail — queue file may not exist yet
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const res = await fetch('/api/evidence/import-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const parts: string[] = [];
      if (data.processed > 0) parts.push(`${data.processed} imported`);
      if (data.skipped   > 0) parts.push(`${data.skipped} already existed`);
      if (data.errors?.length > 0) parts.push(`${data.errors.length} failed`);

      if (data.processed > 0) {
        toast.success(`Cowork import complete — ${parts.join(', ')}`);
      } else {
        toast.info(`Nothing new — ${parts.join(', ')}`);
      }

      if (data.errors?.length > 0) {
        console.warn('[ImportQueue] Errors:', data.errors);
        toast.warning(`${data.errors.length} item(s) failed — check console`);
      }

      setPendingCount(0);
      onImportComplete();
    } catch {
      toast.error('Import failed — check that LegalMind is running');
    } finally {
      setIsImporting(false);
    }
  };

  // Hide entirely when queue is empty
  if (pendingCount === 0) return null;

  return (
    <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {pendingCount} email{pendingCount !== 1 ? 's' : ''} waiting in Cowork import queue
        </span>
      </div>
      <Button
        size="sm"
        onClick={handleImport}
        disabled={isImporting}
        className="bg-blue-600 text-white hover:bg-blue-700"
      >
        <Download className="mr-1 h-3 w-3" />
        {isImporting ? 'Importing…' : 'Import Now'}
      </Button>
    </div>
  );
}
