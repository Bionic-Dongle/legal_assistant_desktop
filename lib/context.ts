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
        "SELECT DISTINCT memory_type FROM evidence WHERE case_id = ?"
      ).all(caseId) as any[];

      const byParty: Record<string, string[]> = {};
      for (const row of filters) {
        const collection = `${row.memory_type}_${caseId}`;
        const results = await queryDocuments(collection, query, maxResults);
        if (results?.documents?.[0]?.length) {
          const title = `${row.memory_type.charAt(0).toUpperCase() + row.memory_type.slice(1)} Evidence`;
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

  // Insights & Arguments context — retrieved by relevance to current query, not by recency.
  // Each category lives in its own vector collection, partitioned from evidence,
  // and labelled distinctly so the AI knows the confidence level of each source.
  if (includeInsights || includeArguments) {
    const catList: { label: string; collection: string }[] = [];
    if (includeInsights) catList.push({
      label: "Working Insights *(analytical leads — treat as hypotheses, not established facts)*",
      collection: `insights_${caseId}`,
    });
    if (includeArguments) catList.push({
      label: "Legal Arguments *(positions under development)*",
      collection: `arguments_${caseId}`,
    });

    for (const { label, collection } of catList) {
      try {
        const results = await queryDocuments(collection, query, maxResults);
        if (results?.documents?.[0]?.length) {
          const formatted = results.documents[0]
            .map((doc, i) => `(${i + 1}) ${doc}`)
            .join("\n\n");
          contextSections.push(`### ${label}\n${formatted}`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to retrieve from vector store for ${label}:`, err);
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