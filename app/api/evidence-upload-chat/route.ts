import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  try {
    const { case_id, document_id, message, messages = [], document_text = '' } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Get AI settings
    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const openai_key = settingsMap.openai_api_key || process.env.OPENAI_API_KEY;
    const claude_key = settingsMap.claude_api_key || process.env.ANTHROPIC_API_KEY;
    const timeline_preference = settingsMap.timeline_api_preference || 'openai';

    const useOpenAI = timeline_preference === 'openai' && openai_key;
    const useClaude = timeline_preference === 'claude' && claude_key;

    if (!useOpenAI && !useClaude) {
      return NextResponse.json({
        error: 'No AI API key configured',
        reply: 'Please configure an API key in Settings to use the Evidence Upload Bot.'
      }, { status: 400 });
    }

    // Load existing evidence for context (what other docs have been uploaded)
    const existingEvidence = db.prepare(`
      SELECT filename, document_type, actual_author, submitted_by_party, key_dates, user_context_notes
      FROM evidence
      WHERE case_id = ? AND extracted_text IS NOT NULL
      ORDER BY uploaded_at DESC
      LIMIT 5
    `).all(case_id) as any[];

    // Load insights and arguments for context
    const insights = db.prepare('SELECT content FROM saved_insights WHERE case_id = ? AND category = ? LIMIT 5').all(case_id, 'insight') as any[];
    const args = db.prepare('SELECT content FROM saved_insights WHERE case_id = ? AND category = ? LIMIT 5').all(case_id, 'argument') as any[];

    // Build context
    const contextParts: string[] = [];

    if (document_text) {
      contextParts.push(`DOCUMENT TO TAG:\n${document_text.substring(0, 3000)}${document_text.length > 3000 ? '...' : ''}`);
    }

    if (existingEvidence.length > 0) {
      contextParts.push('\nPREVIOUSLY UPLOADED DOCUMENTS:');
      existingEvidence.forEach((ev) => {
        contextParts.push(`- ${ev.filename} (Type: ${ev.document_type || 'Unknown'}, Author: ${ev.actual_author || 'Unknown'}, Submitted by: ${ev.submitted_by_party || 'Unknown'})`);
        if (ev.user_context_notes) {
          contextParts.push(`  User notes: ${ev.user_context_notes.substring(0, 150)}...`);
        }
      });
    }

    if (insights.length > 0) {
      contextParts.push(`\nKEY INSIGHTS:\n${insights.map(i => `- ${i.content}`).join('\n')}`);
    }

    if (args.length > 0) {
      contextParts.push(`\nKEY ARGUMENTS:\n${args.map(a => `- ${a.content}`).join('\n')}`);
    }

    const contextString = contextParts.join('\n');

    // System prompt for Upload Bot
    const systemPrompt = `You are the Evidence Upload Bot - a conversational legal assistant who helps users understand and contextualize evidence documents through natural dialogue.

YOUR PHILOSOPHY:
You're not a form-filling robot. You're a thoughtful paralegal who asks insightful questions that help users see their evidence from new angles. Your goal is to capture rich context through conversation, not just fill metadata fields.

CONVERSATION APPROACH:
1. START OPEN-ENDED: Begin with "Tell me about this document - what's the story here?" rather than formulaic questions
2. LISTEN AND PROBE: Based on what they say, ask follow-up questions that reveal strategic implications
3. CHALLENGE ASSUMPTIONS: If something doesn't add up, ask about it (like "Why would defense submit something that helps your case?")
4. CAPTURE NUANCE: Get the user to explain context that wouldn't be obvious from just reading the document
5. HELP THEM THINK: Ask questions that make them consider: "How will the opposition spin this?" or "What are they trying to prove?"

CRITICAL INSIGHTS TO EXPLORE:
- Who created this vs. who submitted it (often different in discovery)
- What the opposition is trying to accomplish by submitting it
- Context that changes interpretation (sarcasm, prior history, relationship dynamics)
- Dates and timeline implications
- Why this document matters to the case strategy
- **LEGAL TRIAGE**: What areas of law does this evidence relate to? (e.g., property damage, negligence, contract breach, constructive trust, beneficial ownership, unjust enrichment, etc.)
- What cause of action or legal theory does this support or defend against?
- What relief or remedy does this evidence relate to? (damages, injunction, specific performance, etc.)

CONVERSATION FLOW:
- Start conversational and open: "What's the story with this document?"
- **MATCH THE USER'S ENERGY**: If they give detailed context, dig deeper. If they say "just tag it" or "straightforward", be efficient.
- **READ THE ROOM**: User signals like "There isn't much to this", "simple case", or "just needs tagging" mean they want efficiency, not deep analysis.
- Follow their lead - if they mention something interesting, dig deeper. If they're brief, be brief.
- Don't rigidly follow a question script - adapt to what they're telling you
- When you sense you understand enough (or user signals they're done), summarize and ask for confirmation

TAGGING PROCESS (TWO STEPS):

STEP 1 - Present Summary (conversational response):
"Got it! So this is [document type] from [author], submitted by [party]. They're trying to show [strategy], but your counter-point is [user's perspective]. Key dates: [dates]. Sound right?"

STEP 2 - After User Confirms (CRITICAL):
When user says "yes", "correct", "yep", "that's right", etc., respond with PURE JSON ONLY.
NO TEXT BEFORE OR AFTER THE JSON. NO EXPLANATIONS. JUST THE JSON OBJECT.

Example of correct response to confirmation:
{
  "confirmed": true,
  "metadata": {
    "document_type": "...",
    "actual_author": "...",
    "submitted_by_party": "plaintiff" | "opposition",
    "key_dates": ["YYYY-MM-DD"],
    "key_entities": ["entity1", "entity2"],
    "key_claims": ["claim1", "claim2"],
    "document_tone": "defensive" | "aggressive" | "neutral" | "conciliatory",
    "user_context_notes": "User's explanation verbatim",
    "defense_strategy": "What defense is trying to accomplish (if applicable)",
    "user_counter_narrative": "User's counter-explanation (if applicable)",
    "strategic_summary": "Your synthesis of document + user context",
    "legal_areas": ["property damage", "negligence", "nuisance"],
    "cause_of_action": "Intentional destruction of property",
    "relief_sought": "Compensatory damages + injunctive relief",
    "legal_significance": "Why this evidence matters from a legal standpoint"
  }
}

WRONG: "Great! Here's the final summary: {json...}"
RIGHT: {json...}

CONTEXT AVAILABLE TO YOU:
${contextString}`;

    let reply = '';

    if (useOpenAI) {
      const openai = new OpenAI({ apiKey: openai_key });
      const selectedModel = settingsMap.openai_model?.trim() || 'gpt-4o-mini';

      const aiMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];

      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: aiMessages,
        temperature: 0.5,
        top_p: 0.9,
      });

      reply = completion.choices[0]?.message?.content ?? 'No response received';
    } else if (useClaude) {
      const anthropic = new Anthropic({ apiKey: claude_key });
      const selectedModel = settingsMap.claude_model?.trim() || 'claude-3-5-sonnet-20241022';

      const aiMessages: any[] = [
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];

      const completion = await anthropic.messages.create({
        model: selectedModel,
        max_tokens: 4096,
        temperature: 0.5,
        system: systemPrompt,
        messages: aiMessages,
      });

      reply = completion.content[0]?.type === 'text'
        ? completion.content[0].text
        : 'No response received';
    }

    // Check if reply is confirmation JSON
    let metadata = null;
    try {
      const parsed = JSON.parse(reply);
      if (parsed.confirmed && parsed.metadata) {
        metadata = parsed.metadata;

        // Build friendly tag summary for display
        const tagSummary: string[] = [];
        tagSummary.push('**Tagged successfully!** Here\'s what I captured:\n');

        if (metadata.document_type) tagSummary.push(`📄 Document Type: ${metadata.document_type}`);
        if (metadata.actual_author) tagSummary.push(`✍️ Author: ${metadata.actual_author}`);
        if (metadata.submitted_by_party) tagSummary.push(`📨 Submitted By: ${metadata.submitted_by_party}`);

        if (metadata.legal_areas && Array.isArray(metadata.legal_areas) && metadata.legal_areas.length > 0) {
          tagSummary.push(`⚖️ Legal Areas: ${metadata.legal_areas.join(', ')}`);
        }
        if (metadata.cause_of_action) tagSummary.push(`🎯 Cause of Action: ${metadata.cause_of_action}`);
        if (metadata.relief_sought) tagSummary.push(`💰 Relief Sought: ${metadata.relief_sought}`);

        if (metadata.key_dates && Array.isArray(metadata.key_dates) && metadata.key_dates.length > 0) {
          tagSummary.push(`📅 Key Dates: ${metadata.key_dates.join(', ')}`);
        }

        tagSummary.push(`\n✅ This metadata is now available to all AI assistants.`);

        reply = tagSummary.join('\n');
      }
    } catch (e) {
      // Not JSON, just a conversational reply
    }

    return NextResponse.json({ reply, metadata });
  } catch (error) {
    console.error('POST /api/evidence-upload-chat error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process message',
        reply: 'An error occurred while processing your message.'
      },
      { status: 500 }
    );
  }
}
