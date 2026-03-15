/**
 * lib/austlii.ts
 *
 * AustLII authority retrieval.
 * Searches AustLII for relevant Australian case law and legislation,
 * extracts key passages, and returns structured summaries for injection
 * into the LLM reasoning context.
 *
 * Pipeline per query:
 *   1. Search AustLII (5-10 candidate results)
 *   2. Fetch top results
 *   3. Extract headnote + key passages via AI
 *   4. Return 3-5 structured authority summaries
 */

import OpenAI from 'openai';

export interface AuthoritySummary {
  citation:    string;
  title:       string;
  court:       string;
  year:        string;
  url:         string;
  principle:   string;    // Core legal principle established
  relevance:   string;    // Why it matters to this query
  key_passage: string;    // Extracted key text
}

// Court tier for prioritisation
const COURT_PRIORITY: Record<string, number> = {
  'HCA':  1,  // High Court of Australia
  'VSCA': 2,  // Victorian Court of Appeal
  'VSC':  3,  // Supreme Court of Victoria
  'FCA':  4,  // Federal Court of Australia
  'FCCA': 5,  // Federal Circuit Court
  'NSWCA':  2, 'NSWSC': 3,
  'QCA':    2, 'QSC':   3,
  'WASC':   3, 'SASC':  3,
};

function courtPriority(url: string): number {
  for (const [code, priority] of Object.entries(COURT_PRIORITY)) {
    if (url.includes(`/${code.toLowerCase()}/`) || url.includes(`/${code}/`)) return priority;
  }
  return 99;
}

/**
 * Search AustLII for relevant cases using their search API.
 * Returns raw search result URLs.
 */
async function searchAustLII(query: string, maxResults = 8): Promise<Array<{ title: string; url: string }>> {
  try {
    // AustLII search endpoint — returns HTML search results
    const searchUrl = `https://www.austlii.edu.au/cgi-bin/sinosrch.cgi?` + new URLSearchParams({
      method:   'auto',
      query,
      rank:     'on',
      results:  String(maxResults),
      callback: 'off',
      sources:  'au',   // Australian sources only
    });

    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'LegalMind-Desktop/1.0 (legal research assistant)' },
      signal:  AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const html = await res.text();

    // Extract result links — AustLII HTML format: <a href="/cgi-bin/viewdoc/...">Title</a>
    const linkPattern = /href="(https?:\/\/www\.austlii\.edu\.au\/[^"]+\.html?)"\s*>\s*([^<]+)</gi;
    const results: Array<{ title: string; url: string }> = [];
    let match;

    while ((match = linkPattern.exec(html)) !== null && results.length < maxResults) {
      const url   = match[1];
      const title = match[2].trim();
      // Filter to case law and legislation only (exclude search pages, admin pages)
      if (url.includes('/cases/') || url.includes('/legis/')) {
        results.push({ title, url });
      }
    }

    // Sort by court tier (High Court first)
    return results.sort((a, b) => courtPriority(a.url) - courtPriority(b.url));
  } catch {
    return [];
  }
}

/**
 * Fetch the text of an AustLII document and extract a useful excerpt.
 */
async function fetchAustLIIDocument(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LegalMind-Desktop/1.0' },
      signal:  AbortSignal.timeout(15000),
    });
    if (!res.ok) return '';

    const html = await res.text();

    // Strip HTML tags, collapse whitespace
    const text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    // Return first 4000 chars — enough for headnote + opening passages
    return text.substring(0, 4000);
  } catch {
    return '';
  }
}

/**
 * Use AI to extract a structured summary from raw case text.
 */
async function summariseAuthority(
  apiKey:  string,
  title:   string,
  url:     string,
  rawText: string,
  query:   string
): Promise<AuthoritySummary | null> {
  try {
    const openai = new OpenAI({ apiKey });

    const res = await openai.chat.completions.create({
      model:       'gpt-4o-mini',
      temperature: 0,
      max_tokens:  500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role:    'system',
          content: `You are a legal research assistant. Extract a structured summary from the case text.
Return JSON with these fields:
{
  "citation": "formal citation e.g. Smith v Jones (2020) 100 CLR 1",
  "court": "court name",
  "year": "YYYY",
  "principle": "the core legal principle or rule established (1-2 sentences)",
  "relevance": "why this case is relevant to the query (1 sentence)",
  "key_passage": "the most relevant quoted passage from the case (2-4 sentences max)"
}
If the document is not relevant to the query, return {"irrelevant": true}.`,
        },
        {
          role:    'user',
          content: `Research query: ${query}\n\nCase title: ${title}\nURL: ${url}\n\nCase text:\n${rawText}`,
        },
      ],
    });

    const content = res.choices[0].message.content?.trim() || '{}';
    const data    = JSON.parse(content);

    if (data.irrelevant) return null;

    return {
      citation:    data.citation   || title,
      title,
      court:       data.court      || '',
      year:        data.year        || '',
      url,
      principle:   data.principle  || '',
      relevance:   data.relevance  || '',
      key_passage: data.key_passage || '',
    };
  } catch {
    return null;
  }
}

/**
 * Main entry point — run a legal authority search and return summaries.
 *
 * @param queries    Array of pre-built AustLII search queries (from doctrinal framework)
 * @param apiKey     OpenAI API key for summarisation
 * @param maxReturn  Number of authorities to return (default 4)
 */
export async function fetchAuthorities(
  queries:   string[],
  apiKey:    string,
  maxReturn  = 4
): Promise<AuthoritySummary[]> {
  const seen    = new Set<string>();
  const results: AuthoritySummary[] = [];

  for (const query of queries) {
    if (results.length >= maxReturn) break;

    const searchResults = await searchAustLII(query, 6);

    for (const { title, url } of searchResults) {
      if (results.length >= maxReturn) break;
      if (seen.has(url)) continue;
      seen.add(url);

      const rawText = await fetchAustLIIDocument(url);
      if (!rawText) continue;

      const summary = await summariseAuthority(apiKey, title, url, rawText, query);
      if (summary) results.push(summary);
    }
  }

  return results;
}

/**
 * Build an authority context block for injection into the LLM prompt.
 */
export function buildAuthorityContext(authorities: AuthoritySummary[]): string {
  if (authorities.length === 0) return '';

  const lines: string[] = ['## Relevant Legal Authorities\n'];

  for (const auth of authorities) {
    lines.push(`### ${auth.citation}`);
    if (auth.court) lines.push(`*${auth.court}*`);
    lines.push(`**Principle**: ${auth.principle}`);
    lines.push(`**Relevance**: ${auth.relevance}`);
    if (auth.key_passage) lines.push(`**Key passage**: "${auth.key_passage}"`);
    lines.push(`*Source: ${auth.url}*`);
    lines.push('');
  }

  return lines.join('\n');
}
