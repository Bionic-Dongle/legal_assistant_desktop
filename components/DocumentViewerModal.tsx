'use client';

import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { X, FileText } from 'lucide-react';
import { Button } from './ui/button';
import DiffMatchPatch from 'diff-match-patch';

interface DocumentViewerModalProps {
  filename: string;
  quote?: string;
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Lazy singleton - avoids module-level instantiation which can fail during SSR
// and silently make this module's exports undefined
let _dmp: any = null;
function getDmp() {
  if (!_dmp) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dmp = new (DiffMatchPatch as any)();
    _dmp.Match_Threshold = 0.4;   // higher = more fuzzy (0.0 exact, 1.0 very fuzzy)
    _dmp.Match_Distance = 10000;  // search within 10000 chars of expected location
  }
  return _dmp;
}

export function DocumentViewerModal({
  filename,
  quote,
  caseId,
  isOpen,
  onClose,
}: DocumentViewerModalProps) {
  const [documentText, setDocumentText] = useState<string>('');
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load document when modal opens
  useEffect(() => {
    if (isOpen && filename) {
      console.log('[DocumentViewer] Loading document:', filename);
      loadDocument();
    }
  }, [isOpen, filename, quote]);

  // Auto-scroll to highlighted quote - triggers when scrollTrigger changes
  useEffect(() => {
    if (isOpen && quote && documentText && contentRef.current && scrollTrigger > 0) {
      console.log('[DocumentViewer] Scrolling to highlight:', quote?.substring(0, 50));
      setTimeout(() => {
        const highlightElement = contentRef.current?.querySelector('#highlight-target');
        if (highlightElement) {
          console.log('[DocumentViewer] Found highlight element, scrolling...');
          highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          console.log('[DocumentViewer] Highlight element not found in DOM');
        }
      }, 200);
    }
  }, [isOpen, documentText, scrollTrigger]);

  const loadDocument = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/evidence/by-filename?filename=${encodeURIComponent(filename)}&caseId=${caseId}`);
      const data = await res.json();

      if (data.evidence) {
        setDocumentText(data.evidence.extracted_text || '');
        setMetadata(data.evidence);
        // Trigger scroll AFTER document is loaded
        setScrollTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to load document:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Escape HTML special characters
  const escapeHtml = (str: string) => str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m] || m));

  // Find quote location using diff-match-patch fuzzy matching
  const findQuoteLocation = (text: string, quoteToFind: string): { index: number; matchType: string } | null => {
    if (!quoteToFind || !text) return null;

    // Strategy 1: Exact match (fastest)
    let index = text.indexOf(quoteToFind);
    if (index !== -1) {
      return { index, matchType: 'exact' };
    }

    // Strategy 2: Case-insensitive exact match
    index = text.toLowerCase().indexOf(quoteToFind.toLowerCase());
    if (index !== -1) {
      return { index, matchType: 'case-insensitive' };
    }

    // Strategy 3: Normalized whitespace exact match
    const normalizedText = text.replace(/\s+/g, ' ');
    const normalizedQuote = quoteToFind.replace(/\s+/g, ' ');
    const normalizedIndex = normalizedText.toLowerCase().indexOf(normalizedQuote.toLowerCase());
    if (normalizedIndex !== -1) {
      // Map back to original text position
      let origIndex = 0;
      let normIndex = 0;
      while (normIndex < normalizedIndex && origIndex < text.length) {
        if (/\s/.test(text[origIndex])) {
          while (origIndex < text.length && /\s/.test(text[origIndex])) origIndex++;
          normIndex++;
        } else {
          origIndex++;
          normIndex++;
        }
      }
      return { index: origIndex, matchType: 'normalized' };
    }

    // Strategy 4: diff-match-patch fuzzy matching (for typos, minor differences)
    // Note: match_main has a 32-char limit, so use first 30 chars for fuzzy search
    const searchPattern = normalizedQuote.substring(0, 30);

    try {
      index = getDmp().match_main(normalizedText, searchPattern, 0);
      if (index !== -1) {
        // Map back to original text position
        let origIndex = 0;
        let normIndex = 0;
        while (normIndex < index && origIndex < text.length) {
          if (/\s/.test(text[origIndex])) {
            while (origIndex < text.length && /\s/.test(text[origIndex])) origIndex++;
            normIndex++;
          } else {
            origIndex++;
            normIndex++;
          }
        }
        return { index: origIndex, matchType: 'fuzzy' };
      }
    } catch (e) {
      console.warn('[DocumentViewer] Fuzzy match failed:', e);
    }

    return null;
  };

  const getHighlightedHTML = (text: string, quoteToHighlight?: string): string => {
    if (!quoteToHighlight || !text) return escapeHtml(text);

    console.log('[DocumentViewer] Searching for quote:', quoteToHighlight.substring(0, 80) + '...');

    const result = findQuoteLocation(text, quoteToHighlight);

    if (!result) {
      console.log('[DocumentViewer] Quote NOT found in document');
      return escapeHtml(text);
    }

    const { index, matchType } = result;
    console.log(`[DocumentViewer] Quote found at index ${index} using ${matchType} match`);

    // Determine highlight length - use the quote length, but cap it reasonably
    const highlightLength = Math.min(quoteToHighlight.length + 20, text.length - index);
    const foundQuote = text.substring(index, index + highlightLength);

    const before = escapeHtml(text.substring(0, index));
    const highlighted = escapeHtml(foundQuote);
    const after = escapeHtml(text.substring(index + highlightLength));

    return `${before}<mark class="bg-yellow-300 dark:bg-yellow-600 font-semibold" id="highlight-target">${highlighted}</mark>${after}`;
  };

  // Check if quote exists using the same logic
  const quoteExists = (text: string, quoteToCheck?: string): boolean => {
    if (!quoteToCheck || !text) return false;
    return findQuoteLocation(text, quoteToCheck) !== null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <DialogTitle>{filename}</DialogTitle>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            Document viewer showing {filename} {quote ? 'with highlighted quote' : ''}
          </DialogDescription>

          {metadata && (
            <div className="text-sm text-muted-foreground space-y-1 pt-2">
              {metadata.document_type && <p>Type: {metadata.document_type}</p>}
              {metadata.actual_author && <p>Author: {metadata.actual_author}</p>}
              {metadata.submitted_by_party && <p>Submitted By: {metadata.submitted_by_party}</p>}
              <p>Uploaded: {new Date(metadata.uploaded_at).toLocaleDateString()}</p>
            </div>
          )}
        </DialogHeader>

        {quote && (
          <div className="text-sm text-muted-foreground p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <strong>Looking for:</strong> "{quote.substring(0, 100)}{quote.length > 100 ? '...' : ''}"
          </div>
        )}

        <div ref={contentRef} className="flex-1 overflow-y-auto border border-border rounded-lg p-4 bg-muted/30" style={{ maxHeight: '60vh' }}>
          {isLoading ? (
            <p className="text-muted-foreground">Loading document...</p>
          ) : (
            <div
              className="whitespace-pre-wrap font-mono text-sm"
              dangerouslySetInnerHTML={{
                __html: getHighlightedHTML(documentText, quote)
              }}
            />
          )}
        </div>

        {quote && !isLoading && !quoteExists(documentText, quote) && (
          <div className="text-sm text-orange-600 dark:text-orange-400 p-2 bg-orange-50 dark:bg-orange-950 rounded">
            Warning: Quote not found in document. The AI may have paraphrased or the quote may be inaccurate.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
