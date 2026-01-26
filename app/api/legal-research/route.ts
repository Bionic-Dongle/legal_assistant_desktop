import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { keywords, jurisdiction, caseId } = await req.json();

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({ error: 'No keywords provided' }, { status: 400 });
    }

    console.log(`🔍 Researching: ${keywords.join(', ')} (${jurisdiction || 'Australia'})`);

    // Check cache first
    const cachedKnowledge = db.prepare(`
      SELECT * FROM legal_knowledge
      WHERE jurisdiction = ?
      AND (${keywords.map(() => 'keywords LIKE ?').join(' OR ')})
      LIMIT 10
    `).all(
      jurisdiction || 'Australia',
      ...keywords.map((k: string) => `%${k}%`)
    ) as any[];

    if (cachedKnowledge.length > 0) {
      console.log(`✅ Found ${cachedKnowledge.length} cached legal principles`);
      return NextResponse.json({
        cached: true,
        principles: cachedKnowledge,
        source: 'local_cache'
      });
    }

    // No cache - do REAL web search
    console.log(`📚 No cache - performing web search for Australian case law...`);

    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
    const openai_key = settingsMap.openai_api_key || process.env.OPENAI_API_KEY;

    if (!openai_key) {
      return NextResponse.json({
        error: 'No OpenAI API key configured',
        principles: [],
        source: 'no_api_key'
      }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: openai_key });

    // Use GPT-4o to search the web for real Australian case law
    const searchQuery = `Find Australian case law on: ${keywords.join(', ')}. Include case names, citations, and AustLII URLs.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a legal research assistant specializing in Australian law.
Your task is to search for REAL Australian cases and return them with:
1. Case name (e.g., "Smith v Jones")
2. Citation (e.g., "[2020] HCA 15" or "(2020) 270 CLR 1")
3. AustLII URL (e.g., "https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/HCA/2020/15.html")
4. Brief summary of the legal principle

CRITICAL: Only include cases that ACTUALLY EXIST. If you can't find a real case, say so.

Return JSON format:
{
  "cases": [
    {
      "name": "Case Name",
      "citation": "[Year] Court Number",
      "url": "https://www.austlii.edu.au/...",
      "principle": "Brief statement of law from this case",
      "keywords": "relevant, keywords, here"
    }
  ],
  "search_performed": true,
  "disclaimer": "Note if any cases need verification"
}`
        },
        { role: 'user', content: searchQuery }
      ],
      temperature: 0.3,
    });

    const aiResponse = completion.choices[0]?.message?.content ?? '{}';
    const searchResults = JSON.parse(aiResponse);

    if (!searchResults.cases || searchResults.cases.length === 0) {
      return NextResponse.json({
        cached: false,
        principles: [],
        cases: [],
        source: 'web_search',
        message: 'No cases found for these keywords'
      });
    }

    // Save to cache
    const savedPrinciples = [];
    for (const caseData of searchResults.cases) {
      const principleId = `law-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Store with hyperlink in explanation
      const explanationWithLink = `${caseData.principle}\n\nCase: [${caseData.name} ${caseData.citation}](${caseData.url})`;

      db.prepare(`
        INSERT INTO legal_knowledge
        (id, jurisdiction, area_of_law, principle, explanation, source, precedent_cases, keywords)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        principleId,
        jurisdiction || 'Australia',
        'Case Law',
        caseData.principle,
        explanationWithLink,
        `Web Search - ${new Date().toISOString()}`,
        JSON.stringify([{
          name: caseData.name,
          citation: caseData.citation,
          url: caseData.url
        }]),
        caseData.keywords || keywords.join(', ')
      );

      savedPrinciples.push({
        id: principleId,
        jurisdiction: jurisdiction || 'Australia',
        area_of_law: 'Case Law',
        principle: caseData.principle,
        explanation: explanationWithLink,
        source: `Web Search - ${new Date().toISOString()}`,
        precedent_cases: JSON.stringify([{
          name: caseData.name,
          citation: caseData.citation,
          url: caseData.url
        }]),
        keywords: caseData.keywords || keywords.join(', ')
      });
    }

    console.log(`✅ Found and cached ${savedPrinciples.length} real cases with hyperlinks`);

    return NextResponse.json({
      cached: false,
      principles: savedPrinciples,
      source: 'web_search',
      message: `Found ${savedPrinciples.length} cases - all citations are hyperlinked`,
      disclaimer: searchResults.disclaimer
    });

  } catch (error) {
    console.error('Legal research error:', error);
    return NextResponse.json({
      error: 'Research failed',
      details: String(error)
    }, { status: 500 });
  }
}
