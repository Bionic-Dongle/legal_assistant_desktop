
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { queryDocuments } from '@/lib/chroma';
import { buildCaseContext } from '@/lib/context';

export async function POST(request: Request) {
  try {
    const { caseId, message } = await request.json();

    // Save user message
    const userMsgId = `msg-${Date.now()}-user`;
    db.prepare(
      'INSERT INTO messages (id, case_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(userMsgId, caseId, 'user', message);

    // Check for "save that" command
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('save that') || lowerMsg.includes('remember this')) {
      // Get the last assistant message
      const lastMsg: any = db.prepare(
        'SELECT * FROM messages WHERE case_id = ? AND role = ? ORDER BY timestamp DESC LIMIT 1'
      ).get(caseId, 'assistant');

      if (lastMsg) {
        // Save as insight
        const insightId = `insight-${Date.now()}`;
        db.prepare(
          'INSERT INTO saved_insights (id, case_id, content, category) VALUES (?, ?, ?, ?)'
        ).run(insightId, caseId, lastMsg.content, 'insight');

        const response = "✓ I've saved that insight for you. You can find it in the 'Key Insights' tab.";
        const assistantMsgId = `msg-${Date.now()}-assistant`;
        db.prepare(
          'INSERT INTO messages (id, case_id, role, content) VALUES (?, ?, ?, ?)'
        ).run(assistantMsgId, caseId, 'assistant', response);

        return NextResponse.json({ messageId: assistantMsgId, response });
      }
    }

    // Build unified case context (includes evidence, insights, arguments, precedents)
    let context = '';
    try {
      context = await buildCaseContext(caseId, message, { includePrecedents: true });
    } catch (error) {
      console.log('⚠️ Context assembly failed, falling back to empty context:', error);
    }

    // Build adaptive system prompt combining backend core + Settings custom overlay
    let response: string = "";
    try {
      const allSettings = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];

      // Determine provider (openai or openrouter)
      const providerSetting = allSettings.find(s => s.key === "main_chat_provider");
      const provider = providerSetting?.value?.trim() || "openai";

      let apiKey: string | undefined;
      let baseURL: string | undefined;
      let selectedModel: string;

      if (provider === "openrouter") {
        const orKey = allSettings.find(s => s.key === "openrouter_key");
        apiKey = orKey?.value?.trim();
        baseURL = "https://openrouter.ai/api/v1";
        const orModel = allSettings.find(s => s.key === "openrouter_model");
        selectedModel = orModel?.value?.trim() || "anthropic/claude-3.7-sonnet";
        console.log("🔍 Using OpenRouter:", { model: selectedModel, hasKey: !!apiKey });
      } else {
        const found = allSettings.find(s => s.key === "openai_key");
        apiKey = process.env.OPENAI_API_KEY || found?.value?.trim();
        const modelSetting = allSettings.find(s => s.key === "openai_model");
        selectedModel = modelSetting?.value?.trim() || "gpt-4o-mini";
        console.log("🔍 Using OpenAI:", { model: selectedModel, hasKey: !!apiKey });
      }

      // --- Determine base system prompt ---
      // --- Determine base system prompt (check all possible key variants) ---
      const promptKeys = [
        'main_chat_system_prompt',
        'system_prompt_main',
        'custom_system_prompt',
        'main_system_prompt',
        'chat_system_prompt'
      ];

      const userPrompt = (() => {
        for (const key of promptKeys) {
          const foundPrompt = allSettings.find(
            (s) => s.key.toLowerCase() === key.toLowerCase()
          );
          if (foundPrompt?.value?.trim()) return foundPrompt.value.trim();
        }
        return '';
      })();

      let baseSystemPrompt: string;
      if (userPrompt) {
        baseSystemPrompt = userPrompt;
      } else {
        baseSystemPrompt = `You are LegalMind — a local, privacy‑first legal reasoning environment.
Maintain two cognitive modes:
• **Analytical Mode** — precise, logical reasoning grounded in evidence and law.
• **Conversational Mode** — flexible, contextually aware, adapting tone to human dialogue history.
Prioritize factual grounding, but sustain continuity with the user's ongoing narrative.

🚨 CRITICAL CITATION PROTOCOL - STRICT ENFORCEMENT:

**RULE 1: VERIFY BEFORE CITING**
Before creating any citation [📄 filename] "quote", you MUST verify that the EXACT quote exists in that specific document.
- Check the document content carefully
- Match the quote word-for-word
- If unsure, DO NOT cite - ask the user to clarify

**RULE 2: CORRECT DOCUMENT ATTRIBUTION**
Each quote MUST be paired with the correct source document:
❌ WRONG: Quoting from "Hargreaves vs Mulligan.txt" but citing [📄 defence.txt]
✅ RIGHT: Read the evidence context, find which document contains the quote, cite that exact document

**RULE 3: NO PARAPHRASING IN CITATIONS**
Citations must be VERBATIM excerpts from the source:
❌ WRONG: [📄 defense.txt] "defendant denies malicious conduct"
✅ RIGHT: [📄 defense.txt] "The Defendant denies doing so out of malice, spite, or horticultural ignorance."

**RULE 4: CITATION FORMAT (MUST FOLLOW EXACTLY)**
[📄 exact-filename.txt] "exact verbatim quote from the document"

The [📄 filename] becomes a clickable link that opens the document and highlights the quote.
If the quote is not in the document you cite, the system will show an error to the user.

**RULE 5: CROSS-CHECK YOUR WORK**
Before responding with citations:
1. Read the evidence context provided below
2. Note which document contains which information
3. Copy exact quotes - do not reword
4. Match each quote to its source document
5. Format as [📄 filename] "exact quote"

EXAMPLES:
❌ WRONG: "The defense claims you deliberately poisoned the tree."
✅ RIGHT: [📄 defence.txt] "The Defendant did not confine his actions to pruning or lawful removal of roots and instead applied a chemical agent capable of systemic absorption."

❌ WRONG: Citing multiple quotes from different documents under one filename
✅ RIGHT: Each quote gets its own citation with the correct source document

When user asks "What do they accuse me of?" - carefully read the evidence context, identify the correct source document for each accusation, and cite each one separately with exact quotes.`;
      }

      // --- Multi‑repository context assembly ---
      const insights = db.prepare("SELECT content, created_at FROM saved_insights WHERE case_id = ? AND category = 'insight' ORDER BY created_at DESC").all(caseId);
      const argumentsSet = db.prepare("SELECT content, created_at FROM saved_insights WHERE case_id = ? AND category = 'argument' ORDER BY created_at DESC").all(caseId);

      // Load evidence with Upload Bot metadata
      const evidence = db.prepare(`
        SELECT filename, uploaded_at, memory_type,
               document_type, actual_author, submitted_by_party,
               user_context_notes, defense_strategy, user_counter_narrative,
               strategic_summary, extracted_text
        FROM evidence
        WHERE case_id = ? AND extracted_text IS NOT NULL
        ORDER BY uploaded_at DESC
      `).all(caseId) as any[];

      const insightsContext = (insights as any[]).map((i: any) => `• (${i.created_at}) ${i.content}`).join("\n") || "No saved insights yet.";
      const argumentsContext = (argumentsSet as any[]).map((a: any) => `• (${a.created_at}) ${a.content}`).join("\n") || "No saved arguments yet.";

      const evidenceContext = evidence.length > 0
        ? evidence.map((ev: any) => {
            const parts: string[] = [];
            parts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            parts.push(`📄 DOCUMENT: ${ev.filename}`);
            parts.push(`⚠️ CITATION REQUIREMENT: When quoting from this document, you MUST cite as [📄 ${ev.filename}]`);
            parts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            parts.push(`Type: ${ev.memory_type}`);
            if (ev.document_type) parts.push(`Document Type: ${ev.document_type}`);
            if (ev.actual_author) parts.push(`Author: ${ev.actual_author}`);
            if (ev.submitted_by_party) parts.push(`Submitted By: ${ev.submitted_by_party}`);
            if (ev.user_context_notes) parts.push(`User Notes: ${ev.user_context_notes.substring(0, 200)}${ev.user_context_notes.length > 200 ? '...' : ''}`);
            if (ev.strategic_summary) parts.push(`Summary: ${ev.strategic_summary.substring(0, 150)}${ev.strategic_summary.length > 150 ? '...' : ''}`);

            // Add line-numbered content for citation
            if (ev.extracted_text) {
              const lines = ev.extracted_text.split('\n');
              const numberedLines = lines.slice(0, 100).map((line: string, idx: number) => `${idx + 1}: ${line}`).join('\n');
              parts.push(`\n📝 CONTENT (quotes from this section MUST cite [📄 ${ev.filename}]):\n${numberedLines}`);
              if (lines.length > 100) parts.push(`... [${lines.length - 100} more lines]`);
            }

            return parts.join('\n');
          }).join('\n\n')
        : "No evidence uploaded yet.";

      // --- Assemble final system prompt ---
      const systemPrompt = `🚨🚨🚨 CRITICAL CITATION RULES - ZERO TOLERANCE 🚨🚨🚨

**RULE: COPY-PASTE ONLY - NO PARAPHRASING**
When the user asks "what does X say about Y?", you MUST:
1. Find the EXACT text in the document (use Ctrl+F mentally)
2. COPY it character-for-character - do NOT reword, summarize, or paraphrase
3. Cite it as [📄 filename] "exact copied text"

❌ WRONG (paraphrasing): [📄 defence.txt] "The defendant denies wrongdoing"
✅ RIGHT (exact quote): [📄 defence.txt] "The Defendant denies each and every allegation contained in the Statement of Claim."

**IF YOU CANNOT FIND THE EXACT WORDING:**
- Say: "I don't see that exact phrasing in the document. Here's what I found: [📄 filename] 'actual quote'"
- NEVER make up quotes or paraphrase

**VERIFICATION TEST:**
Before responding, ask yourself: "Can I Ctrl+F and find this exact quote in the document?"
If NO → Don't use that quote. Find actual text or say you can't find it.

EVERY SINGLE TIME you quote evidence, use format: [📄 filename] "exact verbatim quote"
THIS IS NOT OPTIONAL. THIS IS MANDATORY. NO EXCEPTIONS.

${baseSystemPrompt}

### Repositories
1. Evidence Repository — uploaded documents with conversational metadata from Upload Bot.
2. Insights Repository — conceptual/legal reasoning.
3. Arguments Repository — structured legal positions.

Your goals:
- Interpret user intent across all repositories.
- Ask clarifying questions when ambiguous.
- Maintain continuity across recent chat turns.
- When referencing evidence, acknowledge the metadata (author, submitter, user context).

### Evidence Repository
⚠️ CITATION ACCURACY REMINDER: Each document below has a filename. When you cite a quote, the [📄 filename] MUST match the document where that quote actually appears. The user can click these citations to verify - if you cite the wrong document, it will be immediately obvious. Cross-check carefully!

${evidenceContext}

### Key Insights
${insightsContext}

### Saved Arguments
${argumentsContext}

### Vector Search Results (semantic retrieval)
${context || "No vector search results for this query."}

🚨 REMINDER: When quoting from evidence, you MUST use the citation format: [📄 filename] "exact quote"
This is NON-NEGOTIABLE. Every quote from evidence MUST be cited with the [📄 filename] format.
`;

      if (!apiKey) {
        console.warn("⚠️ Missing OpenAI key — using mock response.");
        response = generateMockResponse(message, context);
      } else {
        console.log(`🚀 Attempting API call — provider: ${provider}, model: ${selectedModel}`);
        const OpenAI = (await import("openai")).default;
        const clientOptions: any = { apiKey };
        if (baseURL) clientOptions.baseURL = baseURL;
        if (provider === "openrouter") {
          clientOptions.defaultHeaders = {
            "HTTP-Referer": "https://legalmind.app",
            "X-Title": "LegalMind Desktop",
          };
        }
        const openai = new OpenAI(clientOptions);

        // Fetch recent conversation history to maintain continuity
        const recentMessages = db.prepare(
          "SELECT role, content FROM messages WHERE case_id = ? ORDER BY timestamp DESC LIMIT 6"
        ).all(caseId) as any[];

        // Rebuild past turn sequence for better continuity
        const conversationContext = recentMessages.reverse().map(m => ({
          role: m.role as "system" | "assistant" | "user",
          content: m.content,
        }));

        const completion = await openai.chat.completions.create({
          model: selectedModel,
          temperature: 0.8,
          top_p: 0.9,
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationContext,
            { role: "user", content: message },
          ],
        });

        response = completion?.choices?.[0]?.message?.content?.trim() || "⚠️ Empty response from model.";
        console.log(`✅ Response received from ${provider}`);
      }
    } catch (error: any) {
      console.error("💥 Error in chat processing:", {
        message: error?.message,
        status: error?.status,
        type: error?.type,
        stack: error?.stack?.split('\n')[0]
      });

      // Provide more helpful error messages instead of mock response
      if (error?.status === 401) {
        response = "❌ **OpenAI API Key Error**\n\nYour API key is invalid or has been revoked. Please:\n\n1. Go to https://platform.openai.com/api-keys\n2. Create a new API key\n3. Copy the entire key (starts with 'sk-')\n4. Go to Settings tab and paste it in the API Key field\n5. Click 'Save Settings'\n6. Make sure your OpenAI account has billing enabled\n\nThen try your message again.";
      } else if (error?.status === 429) {
        response = "❌ **Rate Limit / Quota Exceeded**\n\nYou've hit a usage limit. Check:\n\n1. Too many requests in a short time — wait a minute and try again\n2. Monthly quota exceeded — check your billing dashboard\n3. OpenAI: https://platform.openai.com/account/billing\n4. OpenRouter: https://openrouter.ai/credits\n\nYou can also switch providers in Settings → Main Chat Provider.";
      } else if (error?.status === 403) {
        response = "❌ **Access Denied**\n\nYour API key doesn't have permission to access this model. This usually means:\n\n1. Your key is for a different organization\n2. The model requires a paid plan\n3. Your account doesn't have access to this model\n\nCheck your OpenAI dashboard or try selecting a different model in Settings.";
      } else if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
        response = "❌ **Network Error**\n\nCouldn't connect to OpenAI servers. Please check:\n\n1. Your internet connection\n2. Firewall or proxy settings\n3. OpenAI service status: https://status.openai.com\n\nThen try again.";
      } else {
        response = `❌ **Error**\n\n${error?.message || 'An unexpected error occurred'}\n\nError type: ${error?.type || 'unknown'}\nStatus: ${error?.status || 'N/A'}\n\nIf this persists, check the terminal logs for more details.`;
      }
    }

    // Save assistant message
    const assistantMsgId = `msg-${Date.now()}-assistant`;
    db.prepare(
      'INSERT INTO messages (id, case_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(assistantMsgId, caseId, 'assistant', response);

    return NextResponse.json({ messageId: assistantMsgId, response });
  } catch (error) {
    console.error('POST /api/chat error:', error);
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}

function generateMockResponse(message: string, context: string): string {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('evidence') || lowerMsg.includes('document')) {
    return context 
      ? `Based on the evidence, here's my analysis:\n\n${context.substring(0, 300)}...\n\nThis is a mock response. Configure your OpenAI API key in Settings for full AI analysis.`
      : 'No evidence has been uploaded yet. Please upload documents in the Evidence tab to enable AI analysis.';
  }
  
  if (lowerMsg.includes('argument') || lowerMsg.includes('position')) {
    return 'To build a strong legal argument, we should:\n\n1. Review all available evidence\n2. Identify key facts and timeline\n3. Research relevant case law\n4. Develop counterarguments\n\n(Mock response - configure OpenAI for full analysis)';
  }
  
  return `I understand you're asking about: "${message}"\n\nThis is a mock response. To enable full AI-powered legal analysis:\n\n1. Go to Settings tab\n2. Enter your OpenAI API key\n3. Upload evidence documents\n4. Return here for detailed analysis\n\nYour data stays 100% local on your machine.`;
}
