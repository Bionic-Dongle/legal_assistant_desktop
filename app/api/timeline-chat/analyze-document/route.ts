import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  try {
    const { documentId, documentText, caseId, narrativeId } = await req.json();

    if (!documentText && !documentId) {
      return NextResponse.json({ error: 'No document provided' }, { status: 400 });
    }

    // Get document text
    let textToAnalyze = documentText;
    if (!textToAnalyze && documentId) {
      const doc = db.prepare('SELECT extracted_text FROM timeline_documents WHERE id = ?').get(documentId) as any;
      if (!doc) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
      textToAnalyze = doc.extracted_text;
    }

    // Get existing plot points and threads for context
    const plotPoints = db.prepare(`
      SELECT id, title, content, event_date, thread_id
      FROM plot_points
      WHERE narrative_id = ?
      ORDER BY event_date ASC, sort_order ASC
    `).all(narrativeId) as any[];

    const threads = db.prepare(`
      SELECT id, title, color
      FROM narrative_threads
      WHERE case_id = ?
      ORDER BY sort_order ASC
    `).all(caseId) as any[];

    // Get settings
    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const openai_key = settingsMap.openai_api_key || process.env.OPENAI_API_KEY;
    const claude_key = settingsMap.claude_api_key || process.env.ANTHROPIC_API_KEY;
    const timeline_preference = settingsMap.timeline_api_preference || 'openai';
    const useOpenAI = timeline_preference === 'openai' && openai_key;
    const useClaude = timeline_preference === 'claude' && claude_key;

    if (!useOpenAI && !useClaude) {
      return NextResponse.json({
        error: 'No AI API key configured. Please add OpenAI or Claude API key in Settings.',
        events: []
      }, { status: 400 });
    }

    // Build context about existing timeline
    const timelineContext = plotPoints.length > 0
      ? `\n\nEXISTING TIMELINE:\n${plotPoints.map(pp => `- [${pp.event_date || 'No date'}] ${pp.title}: ${pp.content?.substring(0, 100)}...`).join('\n')}`
      : '\n\nEXISTING TIMELINE: No plot points yet.';

    const threadsContext = threads.length > 0
      ? `\n\nAVAILABLE THREADS:\n${threads.map(t => `- ${t.title}`).join('\n')}`
      : '\n\nAVAILABLE THREADS: Thoughts (default)';

    // Build analysis prompt
    const systemPrompt = `You are a legal document analyzer extracting timeline events for case narrative construction.

Analyze the document and extract ALL chronologically significant events, dates, admissions, and facts.

${timelineContext}${threadsContext}

INSTRUCTIONS:
1. Extract every event with a date or chronological reference
2. Identify legal admissions, contradictions, or key facts
3. Note events that contradict or support existing timeline
4. Suggest which narrative thread each event belongs to
5. Provide legal significance for each event

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "events": [
    {
      "suggestedTitle": "Brief event description",
      "date": "YYYY-MM-DD or null if no specific date",
      "thread": "thread name from available threads",
      "content": "Relevant excerpt or summary from document",
      "reason": "Why this is legally significant",
      "crossReference": "Contradicts/supports existing plot point X" or null
    }
  ],
  "summary": "Brief overall analysis of document's timeline significance"
}`;

    const userPrompt = `DOCUMENT TO ANALYZE:\n\n${textToAnalyze.substring(0, 20000)}`;

    let reply = '';

    if (useOpenAI) {
      const openai = new OpenAI({ apiKey: openai_key });
      const selectedModel = settingsMap.openai_model?.trim() || 'gpt-4o-mini';

      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      reply = completion.choices[0]?.message?.content ?? '{"events": []}';
    } else if (useClaude) {
      const anthropic = new Anthropic({ apiKey: claude_key });
      const selectedModel = settingsMap.claude_model?.trim() || 'claude-3-5-sonnet-20241022';

      const message = await anthropic.messages.create({
        model: selectedModel,
        max_tokens: 4096,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      });

      const content = message.content[0];
      reply = content.type === 'text' ? content.text : '{"events": []}';
    }

    // Parse response
    let analysisResult;
    try {
      analysisResult = JSON.parse(reply);
    } catch (parseError) {
      console.error('Failed to parse AI response:', reply);
      return NextResponse.json({
        error: 'Failed to parse AI response',
        events: [],
        rawResponse: reply
      });
    }

    return NextResponse.json({
      success: true,
      ...analysisResult,
      documentAnalyzed: true
    });

  } catch (error) {
    console.error('Document analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed', events: [] }, { status: 500 });
  }
}
