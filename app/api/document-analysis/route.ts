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

    // Get enabled analysis passes in execution order
    const passes = db.prepare(`
      SELECT ap.*, pt.prompt_text, pt.name as prompt_name
      FROM analysis_passes ap
      JOIN prompt_templates pt ON ap.prompt_template_id = pt.id
      WHERE ap.enabled = 1 AND pt.active = 1
      ORDER BY ap.execution_order ASC
    `).all() as any[];

    if (passes.length === 0) {
      return NextResponse.json({ error: 'No analysis passes configured' }, { status: 500 });
    }

    // Get context data
    const plotPoints = db.prepare(`
      SELECT id, title, content, event_date
      FROM plot_points
      WHERE narrative_id = ?
      ORDER BY event_date ASC, sort_order ASC
    `).all(narrativeId) as any[];

    const threads = db.prepare(`
      SELECT id, title
      FROM narrative_threads
      WHERE case_id = ?
      ORDER BY sort_order ASC
    `).all(caseId) as any[];

    // Load ALL evidence for cross-document contradiction detection (unified evidence table)
    const allEvidence = db.prepare(`
      SELECT filename, extracted_text, uploaded_at, memory_type,
             document_type, actual_author, submitted_by_party,
             user_context_notes, defense_strategy, user_counter_narrative,
             strategic_summary,
             legal_areas, cause_of_action, relief_sought, legal_significance
      FROM evidence
      WHERE case_id = ? AND extracted_text IS NOT NULL
      ORDER BY uploaded_at ASC
    `).all(caseId) as any[];

    console.log(`📁 Loaded ${allEvidence.length} evidence documents with metadata for cross-document analysis`);

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
        agentReports: {}
      }, { status: 400 });
    }

    const currentDate = new Date().toISOString().split('T')[0];

    // LEGAL RESEARCH DISABLED - Mock data not acceptable for production
    // TODO: Implement real web search with verified AustLII hyperlinks
    let legalPrinciples = '';

    // Execute analysis passes
    const agentReports: Record<string, any> = {};

    for (const pass of passes) {
      console.log(`🤖 Executing analysis pass: ${pass.name}`);

      // Build prompt with template variables
      let prompt = pass.prompt_text;

      // Replace template variables
      prompt = prompt.replace(/{{CURRENT_DATE}}/g, currentDate);

      // Add legal principles context if available
      if (prompt.includes('{{LEGAL_PRINCIPLES}}')) {
        const principlesContext = legalPrinciples || 'No specific legal principles researched for this document.';
        prompt = prompt.replace(/{{LEGAL_PRINCIPLES}}/g, principlesContext);
      }

      // Add ALL evidence for cross-document contradiction detection (with metadata)
      if (prompt.includes('{{ALL_EVIDENCE}}')) {
        const evidenceContext = allEvidence.length > 0
          ? allEvidence.map((ev: any, idx: number) => {
              const metadata: string[] = [];
              metadata.push(`--- DOCUMENT ${idx + 1}: ${ev.filename} ---`);
              metadata.push(`Uploaded: ${ev.uploaded_at}`);
              metadata.push(`Memory Type: ${ev.memory_type || 'Unknown'}`);
              if (ev.document_type) metadata.push(`Document Type: ${ev.document_type}`);
              if (ev.actual_author) metadata.push(`Actual Author: ${ev.actual_author}`);
              if (ev.submitted_by_party) metadata.push(`Submitted By: ${ev.submitted_by_party}`);
              if (ev.user_context_notes) metadata.push(`\nUser Context: ${ev.user_context_notes}`);
              if (ev.defense_strategy) metadata.push(`Defense Strategy: ${ev.defense_strategy}`);
              if (ev.user_counter_narrative) metadata.push(`Counter-Narrative: ${ev.user_counter_narrative}`);
              if (ev.strategic_summary) metadata.push(`\nStrategic Summary: ${ev.strategic_summary}`);

              // Legal triage fields
              if (ev.legal_areas) {
                try {
                  const areas = JSON.parse(ev.legal_areas);
                  metadata.push(`\n⚖️  Legal Areas: ${areas.join(', ')}`);
                } catch (e) {
                  metadata.push(`\n⚖️  Legal Areas: ${ev.legal_areas}`);
                }
              }
              if (ev.cause_of_action) metadata.push(`Cause of Action: ${ev.cause_of_action}`);
              if (ev.relief_sought) metadata.push(`Relief Sought: ${ev.relief_sought}`);
              if (ev.legal_significance) metadata.push(`Legal Significance: ${ev.legal_significance}`);

              metadata.push(`\nDocument Content:\n${ev.extracted_text.substring(0, 4000)}${ev.extracted_text.length > 4000 ? '...\n[truncated]' : ''}`);
              return metadata.join('\n');
            }).join('\n\n')
          : 'No previous documents uploaded yet.';
        prompt = prompt.replace(/{{ALL_EVIDENCE}}/g, evidenceContext);
      }

      // Add existing timeline context if needed
      if (prompt.includes('{{EXISTING_TIMELINE}}')) {
        const timelineContext = plotPoints.length > 0
          ? plotPoints.map(pp => `- [${pp.event_date || 'No date'}] ${pp.title}`).join('\n')
          : 'No plot points yet';
        prompt = prompt.replace(/{{EXISTING_TIMELINE}}/g, timelineContext);
      }

      // Add available threads context
      if (prompt.includes('{{AVAILABLE_THREADS}}')) {
        const threadsContext = threads.map(t => `- ${t.title}`).join('\n');
        prompt = prompt.replace(/{{AVAILABLE_THREADS}}/g, threadsContext);
      }

      // Add previous analysis results if required
      if (pass.requires_previous_results) {
        if (prompt.includes('{{TEMPORAL_VALIDATION_RESULTS}}')) {
          prompt = prompt.replace(/{{TEMPORAL_VALIDATION_RESULTS}}/g, JSON.stringify(agentReports['temporal_validation'] || {}, null, 2));
        }
        if (prompt.includes('{{TEMPORAL_ISSUES}}')) {
          prompt = prompt.replace(/{{TEMPORAL_ISSUES}}/g, JSON.stringify(agentReports['temporal_validation'] || {}, null, 2));
        }
        if (prompt.includes('{{CONTRADICTIONS}}')) {
          prompt = prompt.replace(/{{CONTRADICTIONS}}/g, JSON.stringify(agentReports['contradiction_detection'] || {}, null, 2));
        }
        if (prompt.includes('{{TIMELINE_EVENTS}}')) {
          prompt = prompt.replace(/{{TIMELINE_EVENTS}}/g, JSON.stringify(agentReports['timeline_extraction'] || {}, null, 2));
        }
      }

      const userMessage = `DOCUMENT TO ANALYZE:\n\n${textToAnalyze.substring(0, 20000)}`;

      // Call AI
      let reply = '';
      try {
        if (useOpenAI) {
          const openai = new OpenAI({ apiKey: openai_key });
          const selectedModel = settingsMap.openai_model?.trim() || 'gpt-4o-mini';

          const completion = await openai.chat.completions.create({
            model: selectedModel,
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" }
          });

          reply = completion.choices[0]?.message?.content ?? '{}';
        } else if (useClaude) {
          const anthropic = new Anthropic({ apiKey: claude_key });
          const selectedModel = settingsMap.claude_model?.trim() || 'claude-3-5-sonnet-20241022';

          const message = await anthropic.messages.create({
            model: selectedModel,
            max_tokens: 4096,
            temperature: 0.2,
            system: prompt,
            messages: [
              { role: 'user', content: userMessage }
            ]
          });

          const content = message.content[0];
          reply = content.type === 'text' ? content.text : '{}';
        }

        // Parse and store result
        try {
          agentReports[pass.prompt_name] = JSON.parse(reply);
        } catch (parseError) {
          console.error(`Failed to parse ${pass.name} response:`, reply);
          agentReports[pass.prompt_name] = { error: 'Parse failed', raw: reply };
        }
      } catch (error) {
        console.error(`Error in ${pass.name}:`, error);
        agentReports[pass.prompt_name] = { error: String(error) };
      }
    }

    // Get master orchestrator prompt
    const masterPrompt = db.prepare(`
      SELECT prompt_text
      FROM prompt_templates
      WHERE name = 'master_orchestrator' AND active = 1
    `).get() as any;

    let synthesizedReport = '';
    if (masterPrompt) {
      let orchestratorPrompt = masterPrompt.prompt_text;
      orchestratorPrompt = orchestratorPrompt.replace(/{{TEMPORAL_REPORT}}/g, JSON.stringify(agentReports['temporal_validation'] || {}, null, 2));
      orchestratorPrompt = orchestratorPrompt.replace(/{{CONTRADICTION_REPORT}}/g, JSON.stringify(agentReports['contradiction_detection'] || {}, null, 2));
      orchestratorPrompt = orchestratorPrompt.replace(/{{TIMELINE_REPORT}}/g, JSON.stringify(agentReports['timeline_extraction'] || {}, null, 2));
      orchestratorPrompt = orchestratorPrompt.replace(/{{STRATEGIC_REPORT}}/g, JSON.stringify(agentReports['strategic_assessment'] || {}, null, 2));

      try {
        if (useOpenAI) {
          const openai = new OpenAI({ apiKey: openai_key });
          const completion = await openai.chat.completions.create({
            model: settingsMap.openai_model?.trim() || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: orchestratorPrompt },
              { role: 'user', content: 'Synthesize the analysis reports into a clear summary.' }
            ],
            temperature: 0.7
          });
          synthesizedReport = completion.choices[0]?.message?.content ?? 'No synthesis generated';
        } else if (useClaude) {
          const anthropic = new Anthropic({ apiKey: claude_key });
          const message = await anthropic.messages.create({
            model: settingsMap.claude_model?.trim() || 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            temperature: 0.7,
            system: orchestratorPrompt,
            messages: [
              { role: 'user', content: 'Synthesize the analysis reports into a clear summary.' }
            ]
          });
          const content = message.content[0];
          synthesizedReport = content.type === 'text' ? content.text : 'No synthesis generated';
        }
      } catch (error) {
        console.error('Orchestrator synthesis error:', error);
        synthesizedReport = 'Error synthesizing reports';
      }
    }

    return NextResponse.json({
      success: true,
      agentReports,
      synthesis: synthesizedReport,
      passesExecuted: passes.length
    });

  } catch (error) {
    console.error('Document analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
