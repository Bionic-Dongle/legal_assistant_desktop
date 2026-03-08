
// ChromaDB local vector storage
// For desktop app, we'll use a simple JSON-based storage for now
// Can be upgraded to full ChromaDB server later

import fs from 'fs';
import path from 'path';

const VECTOR_DIR = path.join(process.cwd(), 'data', 'vectors');

if (!fs.existsSync(VECTOR_DIR)) {
  fs.mkdirSync(VECTOR_DIR, { recursive: true });
}

interface VectorDoc {
  id: string;
  content: string;
  metadata: any;
}

function getCollectionPath(name: string): string {
  return path.join(VECTOR_DIR, `${name}.json`);
}

function loadCollection(name: string): VectorDoc[] {
  const filePath = getCollectionPath(name);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveCollection(name: string, docs: VectorDoc[]): void {
  const filePath = getCollectionPath(name);
  fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
}

export async function addDocuments(
  collectionName: string,
  documents: string[],
  metadatas: any[],
  ids: string[]
) {
  const collection = loadCollection(collectionName);
  
  for (let i = 0; i < documents.length; i++) {
    collection.push({
      id: ids[i],
      content: documents[i],
      metadata: metadatas[i],
    });
  }
  
  saveCollection(collectionName, collection);
  return { success: true };
}

export async function queryDocuments(
  collectionName: string,
  queryText: string,
  nResults: number = 5
) {
  const collection = loadCollection(collectionName);
  
  if (collection.length === 0) {
    return { documents: [[]], metadatas: [[]], distances: [[]] };
  }
  
  // Check if embeddings exist in documents
  const hasEmbeddings = collection.length > 0 && Array.isArray(collection[0].metadata?.embedding);

  let scored: { doc: VectorDoc; score: number }[] = [];

  if (hasEmbeddings) {
    try {
      const allSettings = require("@/lib/db")
        .prepare("SELECT value FROM settings WHERE LOWER(key) = 'openai_api_key'")
        .get() as { value?: string } | undefined;
      const apiKey = allSettings?.value?.trim() || process.env.OPENAI_API_KEY;
      if (apiKey) {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey });
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: queryText,
        });
        const queryVector = embedding.data[0].embedding as number[];

        scored = collection.map((doc) => {
          const vector = doc.metadata.embedding as number[];
          const dot = vector.reduce((sum, v, i) => sum + v * queryVector[i], 0);
          const magA = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
          const magB = Math.sqrt(queryVector.reduce((sum, v) => sum + v * v, 0));
          const similarity = dot / (magA * magB);
          return { doc, score: similarity };
        });
      }
    } catch (error) {
      console.error("🧠 Embedding query fallback to keyword: ", error);
    }
  }

  // Fallback: keyword overlap scoring if no embeddings or error
  if (scored.length === 0) {
    const queryLower = queryText.toLowerCase();
    scored = collection.map((doc) => {
      const contentLower = doc.content.toLowerCase();
      const score = queryLower.split(" ").filter((word) => contentLower.includes(word)).length;
      return { doc, score };
    });
  }

  // Sort by similarity or overlap
  scored.sort((a, b) => b.score - a.score);
  const topDocs = scored.slice(0, nResults);

  return {
    documents: [topDocs.map((item) => item.doc.content)],
    metadatas: [topDocs.map((item) => item.doc.metadata)],
    distances: [topDocs.map((item) => 1 - (item.score || 0))],
  };
}

export async function removeDocuments(
  collectionName: string,
  ids: string[]
) {
  const collection = loadCollection(collectionName);
  const filtered = collection.filter((doc) => !ids.includes(doc.id));
  saveCollection(collectionName, filtered);
  return { removed: collection.length - filtered.length };
}

export async function getOrCreateCollection(name: string) {
  // Stub for compatibility
  return { name };
}
