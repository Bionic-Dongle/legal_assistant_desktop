/**
 * lib/triage.ts
 * Shared AI triage function — used by scan-folders and scan-email routes.
 * Sends document content to OpenAI for legal classification.
 */

export interface TriageResult {
  is_relevant: boolean;
  memory_type: 'plaintiff' | 'opposition' | 'neutral';
  party: 'plaintiff' | 'opposition' | 'neutral';
  document_type: string;
  actual_author: string | null;
  key_dates: string[];
  key_entities: string[];
  key_claims: string[];
  document_tone: string;
  legal_areas: string[];
  cause_of_action: string | null;
  legal_significance: string | null;
}

const SYSTEM_PROMPT = `You are a legal evidence triage agent.

Analyze the document and return ONLY a JSON object — no markdown, no explanation:

{
  "is_relevant": true,
  "memory_type": "plaintiff | opposition | neutral",
  "party": "plaintiff | opposition | neutral",
  "document_type": "email communication | text message screenshot | property photograph | scanned document | legal filing | correspondence | statement | financial record | contract | court document",
  "actual_author": "full name or email of author if known, else null",
  "key_dates": ["YYYY-MM-DD"],
  "key_entities": ["people, organisations, addresses mentioned"],
  "key_claims": ["plain English summary of each significant claim or statement"],
  "document_tone": "cooperative | hostile | neutral | legal-formal | threatening | evasive",
  "legal_areas": ["relevant legal areas"],
  "cause_of_action": "brief description or null",
  "legal_significance": "1-2 sentences on why this matters to the case, or null"
}

If the document is irrelevant (spam, purely personal with no case connection, promotional, unrelated matter), return: {"is_relevant": false}

Flag any statement where the opposition acknowledges the plaintiff's ownership or assets with a key_claims entry starting with "⚑ DIRECT ACKNOWLEDGEMENT:"`;

export async function triageDocument(
  apiKey: string,
  filename: string,
  text: string,
  caseContext: string,
  isImage = false,
  imageBase64?: string,
  imageMimeType?: string
): Promise<TriageResult> {
  const systemContent = caseContext
    ? `${SYSTEM_PROMPT}\n\nCase context:\n${caseContext}`
    : SYSTEM_PROMPT;

  const messages: any[] = [{ role: 'system', content: systemContent }];

  if (isImage && imageBase64) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
        { type: 'text', text: `Filename: ${filename}\n\nAnalyze this image and return the JSON.` },
      ],
    });
  } else {
    messages.push({
      role: 'user',
      content: `Filename: ${filename}\n\n${text.substring(0, 8000)}`,
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: isImage ? 'gpt-4o' : 'gpt-4o-mini',
      messages,
      temperature: 0,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI triage failed (${res.status}): ${body.substring(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content?.trim() || '{"is_relevant":false}';
  return JSON.parse(content) as TriageResult;
}
