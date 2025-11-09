import { NextResponse } from 'next/server';
import db from '@/lib/db';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { case_id, narrative_id, plot_point_id, sub_narrative_id, message, messages = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Get OpenAI key and narrative system prompt from settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const settings: Record<string, string> = {};
    settingsRows.forEach((row) => {
      settings[row.key] = row.value;
    });

    const openai_key = settings.openai_key || '';
    const narrative_system_prompt = settings.system_prompt_narrative || '';

    // Build context
    const contextParts: string[] = [];

    // Add narrative context if available
    if (narrative_id) {
      const narrative = db.prepare('SELECT * FROM narratives WHERE id = ?').get(narrative_id) as any;
      if (narrative) {
        contextParts.push(`Current Narrative: ${narrative.title} (${narrative.narrative_type})`);
      }

      // Get all plot points for main narrative
      if (narrative.narrative_type === 'main') {
        const plotPoints = db.prepare('SELECT * FROM plot_points WHERE narrative_id = ? ORDER BY sort_order ASC').all(narrative_id) as any[];
        if (plotPoints.length > 0) {
          contextParts.push(`\nPlot Points:\n${plotPoints.map(p => `- ${p.title}`).join('\n')}`);
        }

        // Add current plot point content if available
        if (plot_point_id) {
          const plotPoint = plotPoints.find(p => p.id === plot_point_id);
          if (plotPoint && plotPoint.content) {
            contextParts.push(`\nCurrent Plot Point Content:\n${plotPoint.content}`);
          }

          // Add sub-narratives for this plot point
          const subNarratives = db.prepare('SELECT * FROM narratives WHERE plot_point_id = ? AND narrative_type = ?').all(plot_point_id, 'sub') as any[];
          if (subNarratives.length > 0) {
            contextParts.push(`\nSub-Narratives:\n${subNarratives.map(s => `- ${s.title}`).join('\n')}`);
          }
        }
      }

      // If working in sub-narrative, show its context
      if (sub_narrative_id) {
        const subNarrative = db.prepare('SELECT * FROM narratives WHERE id = ?').get(sub_narrative_id) as any;
        if (subNarrative) {
          contextParts.push(`\nWorking on Sub-Narrative: ${subNarrative.title}`);
        }
      }
    }

    // Add saved insights/arguments
    if (case_id) {
      const insights = db.prepare('SELECT content FROM saved_insights WHERE case_id = ? AND category = ?').all(case_id, 'insight') as any[];
      if (insights.length > 0) {
        contextParts.push(`\nKey Insights:\n${insights.map(i => `- ${i.content}`).join('\n')}`);
      }

      const arguments = db.prepare('SELECT content FROM saved_insights WHERE case_id = ? AND category = ?').all(case_id, 'argument') as any[];
      if (arguments.length > 0) {
        contextParts.push(`\nArguments:\n${arguments.map(a => `- ${a.content}`).join('\n')}`);
      }
    }

    const contextString = contextParts.length > 0 ? contextParts.join('\n\n') : '';

    // If no OpenAI key, return mock response
    if (!openai_key) {
      return NextResponse.json({
        reply: `I'm here to help with narrative construction! However, no OpenAI API key is configured. Please add one in Settings to enable AI assistance.\n\nIn the meantime, I can see you're working on${narrative_id ? ' your narrative' : ' organizing your case'}. Consider:\n- Breaking down complex arguments into clear sections\n- Supporting each claim with specific evidence\n- Maintaining a persuasive, logical flow`,
      });
    }

    // Call OpenAI
    const openai = new OpenAI({ apiKey: openai_key });

    const systemPrompt = narrative_system_prompt ||
      'You are a legal narrative construction assistant. Help craft compelling, evidence-backed narratives. Focus on clarity, persuasiveness, and logical structure.';

    const aiMessages: any[] = [
      {
        role: 'system',
        content: `${systemPrompt}\n\n${contextString ? `CONTEXT:\n${contextString}` : ''}`,
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
      model: 'gpt-4o-mini',
      messages: aiMessages,
      temperature: 0.8,
      top_p: 0.9,
    });

    const reply = completion.choices[0]?.message?.content ?? 'No response received';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('POST /api/narrative-chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process narrative chat', reply: 'An error occurred while processing your message.' },
      { status: 500 }
    );
  }
}
