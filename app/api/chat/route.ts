
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
      const found = allSettings.find(s => s.key === "openai_key");
      const apiKey = (process.env.OPENAI_API_KEY || found?.value?.trim());

      console.log("🔍 Settings check:", {
        foundKey: found?.key,
        hasValue: !!found?.value,
        valuePrefix: found?.value?.substring(0, 10),
        finalApiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND'
      });

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
Prioritize factual grounding, but sustain continuity with the user’s ongoing narrative.`;
      }

      // --- Multi‑repository context assembly ---
      const insights = db.prepare("SELECT content, created_at FROM saved_insights WHERE case_id = ? AND category = 'insight' ORDER BY created_at DESC").all(caseId);
      const argumentsSet = db.prepare("SELECT content, created_at FROM saved_insights WHERE case_id = ? AND category = 'argument' ORDER BY created_at DESC").all(caseId);

      const insightsContext = (insights as any[]).map((i: any) => `• (${i.created_at}) ${i.content}`).join("\n") || "No saved insights yet.";
      const argumentsContext = (argumentsSet as any[]).map((a: any) => `• (${a.created_at}) ${a.content}`).join("\n") || "No saved arguments yet.";

      // --- Assemble final system prompt ---
      const systemPrompt = `${baseSystemPrompt}

### Case Context (memory from buildCaseContext)
${context || "No contextual data yet."}

### Repositories
1. Evidence Repository — documents.
2. Insights Repository — conceptual/legal reasoning.
3. Arguments Repository — structured positions.

Your goals:
- Interpret user intent across all repositories.
- Ask clarifying questions when ambiguous.
- Maintain continuity across recent chat turns.

### Evidence Context
${context || "No evidence currently loaded."}

### Key Insights
${insightsContext}

### Saved Arguments
${argumentsContext}
`;

      if (!apiKey) {
        console.warn("⚠️ Missing OpenAI key — using mock response.");
        response = generateMockResponse(message, context);
      } else {
        // Get selected model from settings (default to gpt-4o-mini)
        const modelSetting = allSettings.find(s => s.key === "openai_model");
        const selectedModel = modelSetting?.value?.trim() || "gpt-4o-mini";

        console.log("🚀 Attempting OpenAI API call with model:", selectedModel);
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey });

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
        console.log("✅ OpenAI response received successfully");
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
        response = "❌ **Rate Limit Exceeded**\n\nYou've exceeded your OpenAI API rate limit or quota. This could mean:\n\n1. Too many requests in a short time (wait a minute and try again)\n2. Monthly quota exceeded (check your OpenAI billing dashboard)\n3. Free tier limits reached (upgrade your OpenAI plan)\n\nVisit https://platform.openai.com/account/billing to check your usage.";
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
