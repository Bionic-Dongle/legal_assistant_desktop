# LegalMind — Architecture Vision
_Last updated: 2026-03-05_

This document captures the architectural direction discussed in the 2026-03-05 session.
It is intentionally written in plain English, not just code.

---

## The Core Problem We're Solving

Right now all evidence, insights, and arguments are treated as undifferentiated text.
The AI cannot tell the difference between:
- What a document actually says (primary source)
- What you think about that document (your analysis)
- What legal position you're building (your argument)

This causes two problems:
1. The AI may present your commentary as if it came from the original document
2. The AI retrieves insights/arguments by recency (last N) not by relevance
   — so old but important notes may never surface

---

## The Target Architecture

### Layer 1 — Typed Vector Collections (replaces current flat approach)

Instead of one evidence store, separate collections by provenance:

| Collection | What goes in | How AI labels it |
|---|---|---|
| `evidence_plaintiff_{caseId}` | Actual document text | "This is what the document says" |
| `evidence_opposition_{caseId}` | Actual document text | "This is what the document says" |
| `insights_{caseId}` | Your analysis and observations | "This is your interpretation" |
| `arguments_{caseId}` | Legal positions you've built | "This is your constructed argument" |

Already partially done — evidence already uses separate plaintiff/opposition collections.
Insights and arguments need to be added to the vector store when saved.

### Layer 2 — Provenance Labels in Context Assembly

When building the AI's context, each block is explicitly labelled:

```
[AUTHORITATIVE SOURCE MATERIAL — from uploaded documents]
(1) "Payment received March 3rd..." — email-2024-03-15.eml

[YOUR ANALYTICAL NOTES — your interpretation, not document text]
(1) "The March 3rd date contradicts the invoice dated Feb 28th..."

[YOUR LEGAL POSITIONS]
(1) "Chain of custody breaks at the point where..."
```

The system prompt instructs the AI: never present ANALYTICAL NOTES content
as if it came from source documents.

### Layer 3 — Knowledge Graph (longer term)

The evidence table already stores structured metadata from the Cowork triage:
- `key_entities` — people, places, organisations mentioned
- `key_dates` — significant dates
- `key_claims` — what the document asserts

Currently these sit as JSON blobs in text columns. The next evolution is two tables:

```sql
entities      (id, case_id, name, type, source_evidence_id)
relationships (from_entity, to_entity, type, source_evidence_id)
```

This makes the knowledge queryable. "Which entities appear in both plaintiff
and opposition documents?" becomes a simple SQL join rather than parsing every
JSON string.

This IS what GraphRAG (Microsoft's approach) does, implemented simply in SQLite.
No external graph database needed at this scale.

---

## Two Evidence Ingestion Paths

These are complementary, not competing:

### Path 1 — Cowork Email Pipeline (informal evidence)
- Cowork reads emails from your accounts
- Applies the legal triage prompt (see COWORK.md)
- Writes structured JSON to `data/import-queue/`
- You click "Import Now" in Evidence tab
- Emails land fully categorised with metadata pre-populated
- Best for: informal communications, "your property" acknowledgements,
  anything the formal discovery doesn't capture

### Path 2 — Direct Upload (formal evidence)
- Drag-drop into Evidence tab
- Upload Bot guides you through tagging
- Best for: discovery documents, formal legal filings, PDFs, Word docs

---

## What GraphRAG Actually Is (plain English)

"GraphRAG" is a brand name (Microsoft, 2024) for a concept that's been around longer:
use a knowledge graph as part of retrieval, not just vector similarity.

The key insight for legal work: legal reasoning is multi-hop.
"The plaintiff claims X in document A, the defendant says Y in document B,
and the witness said Z in the deposition — do these contradict?"

Flat vector search retrieves isolated passages. A graph can traverse:
Smith → signed → Invoice #4521 → dated → March 3rd → contradicts → Hospital Record

Obsidian (the note-taking app) is essentially manual GraphRAG — you draw the
connections yourself. What we'd build is automated GraphRAG — the Cowork triage
extracts entities and relationships, they go into SQLite, the AI traverses them.

For now: focus on typed collections + provenance labels (Layer 1 & 2 above).
Graph tables are the natural next phase once the triage pipeline is running.

---

## What We're NOT Building

- We are not building Obsidian inside LegalMind (that was scope creep we caught)
- We are not integrating Baserow (needs Docker server, SaaS upsell, you hate spreadsheets)
- We don't need a graph database (Neo4j etc.) — SQLite handles this scale fine
- Obsidian sync is optional and low priority — a one-way file write if ever needed
