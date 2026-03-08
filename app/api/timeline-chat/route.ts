import { NextResponse } from 'next/server';
import db from '@/lib/db';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { case_id, narrative_id, message, messages = [], plot_points = [], threads = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Get settings from database
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const settings: Record<string, string> = {};
    settingsRows.forEach((row) => {
      settings[row.key] = row.value;
    });

    // Get API keys and preferences
    const openai_key = settings.openai_key || process.env.OPENAI_API_KEY || '';
    const claude_key = settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY || '';
    const timeline_api_preference = settings.timeline_api_preference || 'openai';
    const global_rules = settings.global_rules || '';
    const timeline_system_prompt = settings.system_prompt_timeline || '';

    // Build context from timeline data
    const contextParts: string[] = [];

    // Add plot points context with attachments
    if (plot_points.length > 0) {
      const plotPointsByThread: Record<string, any[]> = {};
      plot_points.forEach((pp: any) => {
        const threadId = pp.thread_id || 'unassigned';
        if (!plotPointsByThread[threadId]) {
          plotPointsByThread[threadId] = [];
        }
        plotPointsByThread[threadId].push(pp);
      });

      contextParts.push('CURRENT TIMELINE:');
      threads.forEach((thread: any) => {
        const threadPlotPoints = plotPointsByThread[thread.id] || [];
        if (threadPlotPoints.length > 0) {
          contextParts.push(`\n${thread.title} (${threadPlotPoints.length} plot points):`);
          threadPlotPoints.forEach((pp: any) => {
            contextParts.push(`  - [${pp.event_date || 'No date'}] ${pp.title}`);
            if (pp.content) {
              contextParts.push(`    Content: ${pp.content.substring(0, 200)}${pp.content.length > 200 ? '...' : ''}`);
            }

            // Parse and include attachments (insights/arguments)
            if (pp.attachments) {
              try {
                console.log('[Timeline Chat] Plot point attachments raw:', pp.attachments);
                const attachments = JSON.parse(pp.attachments);
                console.log('[Timeline Chat] Parsed attachments:', attachments);
                if (Array.isArray(attachments) && attachments.length > 0) {
                  contextParts.push(`    Attachments:`);
                  attachments.forEach((attachment: any) => {
                    if (attachment && attachment.content) {
                      const label = attachment.type === 'insight' ? 'Insight' : 'Argument';
                      // Include full content for AI analysis
                      contextParts.push(`      - ${label}: ${attachment.content}`);
                    }
                  });
                }
              } catch (e) {
                console.error('[Timeline Chat] Error parsing attachments:', e);
              }
            }
          });
        }
      });
    }

    // Add date range information
    const dates = plot_points
      .map((pp: any) => pp.event_date)
      .filter((d: any) => d)
      .sort();

    if (dates.length > 0) {
      contextParts.push(`\nTimeline Date Range: ${dates[0]} to ${dates[dates.length - 1]}`);
      contextParts.push(`Total Plot Points: ${plot_points.length}`);
    }

    // Add threads information
    if (threads.length > 0) {
      contextParts.push(`\nAvailable Threads: ${threads.map((t: any) => t.title).join(', ')}`);
    }

    // Add insights, arguments, and evidence from database
    if (case_id) {
      const insights = db.prepare('SELECT content FROM saved_insights WHERE case_id = ? AND category = ? LIMIT 10').all(case_id, 'insight') as any[];
      if (insights.length > 0) {
        contextParts.push(`\nKey Insights:\n${insights.map(i => `- ${i.content}`).join('\n')}`);
      }

      const args = db.prepare('SELECT content FROM saved_insights WHERE case_id = ? AND category = ? LIMIT 10').all(case_id, 'argument') as any[];
      if (args.length > 0) {
        contextParts.push(`\nArguments:\n${args.map(a => `- ${a.content}`).join('\n')}`);
      }

      // Load evidence with Upload Bot metadata
      const evidence = db.prepare(`
        SELECT filename, uploaded_at, memory_type,
               document_type, actual_author, submitted_by_party,
               user_context_notes, defense_strategy, user_counter_narrative,
               strategic_summary, extracted_text
        FROM evidence
        WHERE case_id = ? AND extracted_text IS NOT NULL
        ORDER BY uploaded_at DESC
        LIMIT 10
      `).all(case_id) as any[];

      if (evidence.length > 0) {
        contextParts.push('\nEvidence Repository (with line numbers for citation):');
        evidence.forEach((ev: any) => {
          contextParts.push(`\n- ${ev.filename} (${ev.memory_type}, uploaded ${ev.uploaded_at})`);
          if (ev.document_type) contextParts.push(`  Type: ${ev.document_type}`);
          if (ev.actual_author) contextParts.push(`  Author: ${ev.actual_author}`);
          if (ev.submitted_by_party) contextParts.push(`  Submitted By: ${ev.submitted_by_party}`);
          if (ev.user_context_notes) {
            contextParts.push(`  User Context: ${ev.user_context_notes.substring(0, 150)}${ev.user_context_notes.length > 150 ? '...' : ''}`);
          }
          if (ev.strategic_summary) {
            contextParts.push(`  Summary: ${ev.strategic_summary.substring(0, 150)}${ev.strategic_summary.length > 150 ? '...' : ''}`);
          }

          // Add line-numbered content
          if (ev.extracted_text) {
            const lines = ev.extracted_text.split('\n');
            const numberedLines = lines.slice(0, 100).map((line: string, idx: number) => `${idx + 1}: ${line}`).join('\n');
            contextParts.push(`\n  Content (first 100 lines):\n${numberedLines}`);
            if (lines.length > 100) contextParts.push(`  ... [${lines.length - 100} more lines]`);
          }
        });
      }
    }

    const contextString = contextParts.join('\n');

    // Build system prompt — user instructions layer ON TOP of the base, never replace it
    const timelineBase = `You are a timeline construction assistant for legal case analysis.

🚨 CRITICAL CITATION PROTOCOL:
When referencing evidence or making factual claims, you MUST:
1. **Quote verbatim** - Never paraphrase evidence. Use exact quotes.
2. **Cite sources** - Format: [📄 filename] "exact quote"
3. **No hallucinations** - If you don't have evidence for a claim, say so explicitly.

CITATION FORMAT (MUST FOLLOW EXACTLY):
[📄 filename] "exact verbatim quote from the document"

The [📄 filename] becomes a clickable link for verification. DO NOT make up line numbers or references.

EXAMPLES:
❌ WRONG: "The defense claims you acted maliciously."
✅ RIGHT: [📄 defense.txt] "The plaintiff deliberately applied herbicide with malicious intent."

RESPONSE FORMAT RULES (MUST FOLLOW):

1. If user asks to ADD/EXPAND/UPDATE/MODIFY content in an existing plot point, respond ONLY with:
ADD_CONTENT:
PlotPointTitle: [exact title]
AdditionalContent: [content to add]
Reason: [brief reason]

DO NOT add explanations or conversational text. Output ONLY the format above.

2. If user asks to CREATE a new plot point, respond ONLY with:
SUGGEST_PLOT_POINT:
Title: [title]
Date: [YYYY-MM-DD]
Thread: [thread name]
Content: [content]
Reason: [reason]

3. For all other questions (analysis, questions about timeline), respond conversationally.

CONTEXT AWARENESS:
- You can see all plot points with their dates, content, and attachments
- Each plot point may have insights or arguments attached
- Use this to provide informed suggestions

FORMATTING:
- Use plain text only, NO markdown
- No asterisks, underscores, or formatting syntax
- Simple dashes for lists

Your role:
- Analyze chronological patterns
- Suggest new plot points for gaps
- Recommend attachment additions
- Answer timeline questions
- Analyze existing attachments

CONSTRAINTS:
- You can ONLY suggest additions
- You CANNOT delete or modify directly
- All suggestions require user confirmation`;

    const baseSystemPrompt = timeline_system_prompt
      ? `${timelineBase}\n\n### Configured Preferences (set by the user in Settings — NOT said in this conversation)\n${timeline_system_prompt}`
      : timelineBase;

    const fullSystemPrompt = global_rules
      ? `${global_rules}\n\n${baseSystemPrompt}\n\n🚨 REMINDER: When quoting from evidence, you MUST use the citation format: [📄 filename] "exact quote"\nThis is NON-NEGOTIABLE. Every quote from evidence MUST be cited with the [📄 filename] format.`
      : `${baseSystemPrompt}\n\n🚨 REMINDER: When quoting from evidence, you MUST use the citation format: [📄 filename] "exact quote"\nThis is NON-NEGOTIABLE. Every quote from evidence MUST be cited with the [📄 filename] format.`;

    // Choose API based on preference
    const useOpenAI = timeline_api_preference === 'openai' && openai_key;
    const useClaude = timeline_api_preference === 'claude' && claude_key;

    if (!useOpenAI && !useClaude) {
      return NextResponse.json({
        reply: `Timeline Assistant is not configured. Please add an ${timeline_api_preference === 'openai' ? 'OpenAI' : 'Claude'} API key in Settings and ensure the Timeline API preference is set correctly.\n\nI can see:\n- ${plot_points.length} plot points across ${threads.length} threads\n- Date range: ${dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : 'No dates set'}\n\nConfigure your API key to enable AI-powered timeline assistance.`,
      });
    }

    let reply = '';

    if (useOpenAI) {
      // OpenAI API call
      const openai = new OpenAI({ apiKey: openai_key });
      const selectedModel = settings.openai_model?.trim() || 'gpt-4o-mini';

      const aiMessages: any[] = [
        {
          role: 'system',
          content: `${fullSystemPrompt}\n\nCONTEXT:\n${contextString}`,
        },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'user',
          content: message,
        },
      ];

      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: aiMessages,
        temperature: 0.3,
        top_p: 0.9,
      });

      reply = completion.choices[0]?.message?.content ?? 'No response received';
    } else if (useClaude) {
      // Claude API call
      const anthropic = new Anthropic({ apiKey: claude_key });
      const selectedModel = settings.claude_model?.trim() || 'claude-3-5-sonnet-20241022';

      const aiMessages: any[] = [
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'user',
          content: message,
        },
      ];

      const completion = await anthropic.messages.create({
        model: selectedModel,
        max_tokens: 4096,
        system: `${fullSystemPrompt}\n\nCONTEXT:\n${contextString}`,
        messages: aiMessages,
      });

      reply = completion.content[0]?.type === 'text'
        ? completion.content[0].text
        : 'No response received';
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('POST /api/timeline-chat error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process timeline chat',
        reply: 'An error occurred while processing your message. Please check your API configuration.'
      },
      { status: 500 }
    );
  }
}
