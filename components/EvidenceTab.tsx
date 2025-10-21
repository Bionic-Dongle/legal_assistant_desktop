
'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Upload, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Evidence {
  id: string;
  filename: string;
  memory_type: string;
  uploaded_at: string;
}

export function EvidenceTab({ caseId }: { caseId: string }) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    memoryType: string
  ) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('caseId', caseId);
    formData.append('memoryType', memoryType);

    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        toast.success('Evidence uploaded');
        loadEvidence();
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
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div
          className="border border-border rounded-lg p-6 text-center cursor-pointer"
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
          className="border border-border rounded-lg p-6 text-center cursor-pointer"
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

      <div className="border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Uploaded Evidence</h3>
        <div className="space-y-2">
          {evidence?.length === 0 ? (
            <p className="text-muted-foreground">No evidence uploaded yet</p>
          ) : (
            evidence?.map?.((item) => (
              <div
                key={item?.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{item?.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      {item?.memory_type} • {new Date(item?.uploaded_at ?? '').toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteEvidence(item?.id ?? '')}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
