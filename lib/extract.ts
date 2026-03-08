/**
 * lib/extract.ts
 * Proper text extraction for PDF, DOCX, and plain text files.
 * Used by the evidence upload API to get readable content from uploaded documents.
 */

import path from 'path';

/**
 * Extract readable text from a file buffer.
 * Handles PDF, DOCX/DOC, and plain text. Falls back gracefully on failure.
 *
 * @param buffer   - Raw file bytes
 * @param filename - Original filename (used to detect file type)
 * @param limit    - Max characters to return (default 50,000)
 */
export async function extractText(
  buffer: Buffer,
  filename: string,
  limit = 50000
): Promise<{ text: string; method: 'pdf' | 'docx' | 'text' | 'fallback' }> {
  const ext = path.extname(filename).toLowerCase();

  // ── PDF ────────────────────────────────────────────────────────────────────
  if (ext === '.pdf') {
    try {
      // pdf-parse may export as default or as the module itself depending on bundler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule = await import('pdf-parse') as any;
      const pdfParse = pdfParseModule.default ?? pdfParseModule;
      const result = await pdfParse(buffer);
      const text = result.text?.trim() ?? '';
      if (text.length > 20) {
        return { text: text.substring(0, limit), method: 'pdf' };
      }
      // Empty result — scanned PDF with no text layer
      return {
        text: '[PDF appears to be a scanned image — no text layer detected. Manual transcription or OCR needed.]',
        method: 'fallback',
      };
    } catch (err) {
      console.warn('[extract] pdf-parse failed:', err);
      return { text: '[PDF extraction failed — file may be corrupted or password-protected.]', method: 'fallback' };
    }
  }

  // ── DOCX / DOC ─────────────────────────────────────────────────────────────
  if (ext === '.docx' || ext === '.doc') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim() ?? '';
      if (text.length > 20) {
        return { text: text.substring(0, limit), method: 'docx' };
      }
      return { text: '[Word document appears to be empty.]', method: 'fallback' };
    } catch (err) {
      console.warn('[extract] mammoth failed:', err);
      return { text: '[Word document extraction failed.]', method: 'fallback' };
    }
  }

  // ── Plain text (.txt, .eml, .md, .csv, etc.) ──────────────────────────────
  try {
    const text = buffer.toString('utf-8').trim();
    return { text: text.substring(0, limit), method: 'text' };
  } catch {
    return { text: '[Could not read file as text.]', method: 'fallback' };
  }
}
