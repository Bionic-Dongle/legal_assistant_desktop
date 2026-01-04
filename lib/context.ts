import db from "@/lib/db";
import { queryDocuments } from "@/lib/chroma";

/**
 * Unified memory context builder.
 *
 * Generates standardized cognitive context for both main chat and narrative chat systems.
 * Pulls from evidence vectors, insights, arguments, and any available precedent collections.
 */

export async function buildCaseContext(
  caseId: string,
  query: string,
  options: {
    includeEvidence?: boolean;
    includeInsights?: boolean;
    includeArguments?: boolean;
    includePrecedents?: boolean;
    maxResults?: number;
  } = {}
) {
  const {
    includeEvidence = true,
    includeInsights = true,
    includeArguments = true,
    includePrecedents = false,
    maxResults = 3,
  } = options;

  let contextSections: string[] = [];

  // Evidence context: query both sides with optional filters
  if (includeEvidence) {
    try {
      const filters = db.prepare(
        "SELECT DISTINCT party, knowledge_domain FROM evidence WHERE case_id = ?"
      ).all(caseId) as any[];

      const byParty: Record<string, string[]> = {};
      for (const row of filters) {
        const collection = `${row.party || row.knowledge_domain || "neutral"}_${caseId}`;
        const results = await queryDocuments(collection, query, maxResults);
        if (results?.documents?.[0]?.length) {
          const title = `${row.party ? row.party.charAt(0).toUpperCase() + row.party.slice(1) : "Neutral"} - ${row.knowledge_domain || "Evidence"}`;
          byParty[title] = results.documents[0];
        }
      }

      for (const [label, docs] of Object.entries(byParty)) {
        contextSections.push(
          `### ${label}\n${docs.map((doc, i) => `(${i + 1}) ${doc}`).join("\n\n")}`
        );
      }
    } catch (err) {
      console.warn("⚠️ Evidence vector query failed:", err);
    }
  }

  // Insights & Arguments context
  if (includeInsights || includeArguments) {
    const catList: { label: string; category: string }[] = [];
    if (includeInsights) catList.push({ label: "Key Insights", category: "insight" });
    if (includeArguments) catList.push({ label: "Arguments", category: "argument" });

    for (const { label, category } of catList) {
      try {
        const rows = db
          .prepare("SELECT content, created_at FROM saved_insights WHERE case_id = ? AND category = ? ORDER BY created_at DESC")
          .all(caseId, category) as any[];

        if (rows.length > 0) {
          const formatted = rows
            .map((r) => `• (${r.created_at}) ${r.content}`)
            .join("\n");
          contextSections.push(`### ${label}\n${formatted}`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to fetch ${label}:`, err);
      }
    }
  }

  // Precedent context (future extension)
  if (includePrecedents) {
    try {
      const precedentDocs = await queryDocuments(`precedents_global`, query, maxResults);
      if (precedentDocs?.documents?.[0]?.length > 0) {
        contextSections.push(
          "### Precedent References\n" +
            precedentDocs.documents[0]
              .map((doc, i) => `(${i + 1}) ${doc}`)
              .join("\n\n")
        );
      }
    } catch (err) {
      console.warn("⚠️ Precedent memory retrieval failed:", err);
    }
  }

  const fullContext = contextSections.length
    ? contextSections.join("\n\n---\n\n")
    : "No contextual data found.";

  return fullContext;
}