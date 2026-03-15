'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Upload, FileText, Trash2, Eye, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { EvidenceUploadBotPanel } from './EvidenceUploadBotPanel';
import { ImportQueuePanel } from './ImportQueuePanel';
import { ScanPanel } from './ScanPanel';

interface Evidence {
  id: string;
  filename: string;
  filepath: string;
  memory_type: string;
  uploaded_at: string;
}

interface PendingDocument {
  file: File;
  memoryType: string;
  extractedText: string;
}

export function EvidenceTab({ caseId }: { caseId: string }) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<PendingDocument | null>(null);
  const [showBotPanel, setShowBotPanel] = useState(false);

  useEffect(() => {
    loadEvidence();
  }, [caseId]);

  const loadEvidence = async () => {
    try {
      const res = await fetch(`/api/evidence?caseId=${caseId}`);
      const data = await res.json();
      setEvidence(data?.evidence ?? []);
    } catch (error) {
      console.error('Failed to load evidence:', error);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    // PDF and Word docs are binary — browser can't read them as text.
    // Return empty string; the server handles proper extraction via lib/extract.ts
    if (ext === 'pdf' || ext === 'doc' || ext === 'docx') {
      return '';
    }
    // Plain text files (.txt, .eml, .md, .csv) can be read directly in the browser
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(text.substring(0, 10000));
      };
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    memoryType: string
  ) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    try {
      // Extract text from file
      const extractedText = await extractTextFromFile(file);

      // Show bot panel for conversational tagging
      setPendingDoc({ file, memoryType, extractedText });
      setShowBotPanel(true);
    } catch (error) {
      console.error('Failed to extract text:', error);
      toast.error('Failed to read file');
    }
  };

  const handleTaggingComplete = async (metadata: any) => {
    if (!pendingDoc) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', pendingDoc.file);
    formData.append('caseId', caseId);
    formData.append('memoryType', pendingDoc.memoryType);
    formData.append('extractedText', pendingDoc.extractedText);
    formData.append('metadata', JSON.stringify(metadata));

    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        toast.success('Evidence uploaded and tagged!');
        loadEvidence();
        setShowBotPanel(false);
        setPendingDoc(null);
      } else {
        toast.error('Upload failed');
      }
    } catch (error) {
      toast.error('Upload error');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteEvidence = async (id: string) => {
    try {
      await fetch(`/api/evidence?id=${id}`, { method: 'DELETE' });
      toast.success('Evidence deleted');
      loadEvidence();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    memoryType: string
  ) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(fakeEvent, memoryType);
    }
  };

  const preventDefault = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  return (
    <div className="flex h-full">
      {/* Left side - Evidence Lists */}
      <div className={`${showBotPanel ? 'w-2/3' : 'w-full'} flex flex-col transition-all`}>
        {/* Cowork import queue banner — only visible when emails are waiting */}
      <ImportQueuePanel caseId={caseId} onImportComplete={loadEvidence} />
      <ScanPanel caseId={caseId} onQueueUpdated={loadEvidence} />

      {/* Upload Areas - Fixed at top */}
        <div className="p-6 pb-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-6">
          <div
            className="border border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition"
            onClick={() => document.getElementById('plaintiff-upload')?.click()}
            onDrop={(e) => handleDrop(e, 'plaintiff')}
            onDragOver={preventDefault}
          >
            <h3 className="text-lg font-semibold mb-4">Plaintiff Evidence</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Drag & drop or click to upload plaintiff evidence
            </p>
            <input
              id="plaintiff-upload"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => handleFileUpload(e, 'plaintiff')}
              disabled={isUploading}
            />
            <Upload className="w-6 h-6 mx-auto text-primary" />
          </div>

          <div
            className="border border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition"
            onClick={() => document.getElementById('opposition-upload')?.click()}
            onDrop={(e) => handleDrop(e, 'opposition')}
            onDragOver={preventDefault}
          >
            <h3 className="text-lg font-semibold mb-4">Opposition Evidence</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Drag & drop or click to upload opposition evidence
            </p>
            <input
              id="opposition-upload"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => handleFileUpload(e, 'opposition')}
              disabled={isUploading}
            />
            <Upload className="w-6 h-6 mx-auto text-primary" />
          </div>
          </div>
        </div>

        {/* Two-Column Evidence Lists - Fixed height, each list scrolls internally */}
        <div className="flex-1 px-6 pb-6 min-h-0">
          <div className="grid grid-cols-2 gap-6 h-full">
          {/* Plaintiff Evidence List */}
          <div className="border border-border rounded-lg p-4 flex flex-col h-full">
            <h3 className="text-lg font-semibold mb-2 flex-shrink-0">Plaintiff Evidence</h3>
            <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
              {evidence?.filter(e => e.memory_type === 'plaintiff')?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No plaintiff evidence uploaded yet</p>
              ) : (
                evidence
                  ?.filter(e => e.memory_type === 'plaintiff')
                  ?.map?.((item) => (
                    <div
                      key={item?.id}
                      className="flex items-center justify-between px-3 py-1.5 bg-muted rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <p className="text-sm truncate flex-1 min-w-0">
                          <span className="font-medium">{item?.filename}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(item?.uploaded_at ?? '').toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => {
                            window.electron?.openFile(item?.filepath);
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => deleteEvidence(item?.id ?? '')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Opposition Evidence List */}
          <div className="border border-border rounded-lg p-4 flex flex-col h-full">
            <h3 className="text-lg font-semibold mb-2 flex-shrink-0">Opposition/Defense Evidence</h3>
            <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
              {evidence?.filter(e => e.memory_type === 'opposition')?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No opposition evidence uploaded yet</p>
              ) : (
                evidence
                  ?.filter(e => e.memory_type === 'opposition')
                  ?.map?.((item) => (
                    <div
                      key={item?.id}
                      className="flex items-center justify-between px-3 py-1.5 bg-muted rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <p className="text-sm truncate flex-1 min-w-0">
                          <span className="font-medium">{item?.filename}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(item?.uploaded_at ?? '').toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => {
                            window.electron?.openFile(item?.filepath);
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => deleteEvidence(item?.id ?? '')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Right side - Evidence Upload Bot Panel */}
      {showBotPanel && pendingDoc && (
        <div className="w-1/3 border-l border-border bg-background h-full">
          <EvidenceUploadBotPanel
            caseId={caseId}
            documentId={null}
            documentText={pendingDoc.extractedText}
            filename={pendingDoc.file.name}
            onTaggingComplete={handleTaggingComplete}
            onClose={() => {
              setShowBotPanel(false);
              setPendingDoc(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
