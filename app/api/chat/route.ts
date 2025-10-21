
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { queryDocuments } from '@/lib/chroma';

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

    // Query relevant documents from ChromaDB
    let context = '';
    try {
      const plaintiffDocs = await queryDocuments(`plaintiff_${caseId}`, message, 3);
      const oppositionDocs = await queryDocuments(`opposition_${caseId}`, message, 3);
      
      if (plaintiffDocs?.documents?.[0]?.length > 0) {
        context += '\nPlaintiff Evidence:\n' + plaintiffDocs.documents[0].join('\n\n');
      }
      if (oppositionDocs?.documents?.[0]?.length > 0) {
        context += '\nOpposition Evidence:\n' + oppositionDocs.documents[0].join('\n\n');
      }
    } catch (error) {
      console.log('No documents found in vector DB:', error);
    }

    // Build adaptive system prompt combining backend core + Settings custom overlay
    let response: string = "";
    try {
      const allSettings = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
      const found = allSettings.find(s => s.key.toLowerCase().includes("openai"));
      const apiKey = found?.value?.trim();

      // --- Core base prompt defined here ---
      const baseSystemPrompt = `
You are LegalMind — a local, privacy‑first legal reasoning environment.
Maintain two cognitive modes:
• **Analytical Mode** — precise, logical reasoning grounded in evidence and law.
• **Conversational Mode** — flexible, contextually aware, adapting tone to human dialogue history.
Prioritize factual grounding, but sustain continuity with the user’s ongoing narrative.`;

      // Optional overlay: user‑configurable custom system prompt
      const overlayEntry = allSettings.find(s => s.key.toLowerCase() === "custom_system_prompt");
      const overlayPrompt = overlayEntry?.value ? `\n\n### User Custom System Instruction\n${overlayEntry.value}` : "";

      // --- Multi‑repository context assembly ---
      const insights = db.prepare("SELECT content, created_at FROM saved_insights WHERE case_id = ? AND category = 'insight' ORDER BY created_at DESC").all(caseId);
      const argumentsSet = db.prepare("SELECT content, created_at FROM saved_insights WHERE case_id = ? AND category = 'argument' ORDER BY created_at DESC").all(caseId);

      const insightsContext = (insights as any[]).map((i: any) => `• (${i.created_at}) ${i.content}`).join("\n") || "No saved insights yet.";
      const argumentsContext = (argumentsSet as any[]).map((a: any) => `• (${a.created_at}) ${a.content}`).join("\n") || "No saved arguments yet.";

      const systemPrompt = `${baseSystemPrompt}${overlayPrompt}

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
          model: "gpt-4o-mini",
          temperature: 0.8,
          top_p: 0.9,
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationContext,
            { role: "user", content: message },
          ],
        });

        response = completion?.choices?.[0]?.message?.content?.trim() || "⚠️ Empty response from model.";
      }
    } catch (error: any) {
      console.error("💥 prompt assembly failed:", error?.message || error);
      response = generateMockResponse(message, context);
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
