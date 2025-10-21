
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
  
  // Simple keyword matching for now
  // When OpenAI is configured, this can use embeddings
  const queryLower = queryText.toLowerCase();
  const scored = collection.map(doc => {
    const contentLower = doc.content.toLowerCase();
    const score = queryLower.split(' ').filter(word => 
      contentLower.includes(word)
    ).length;
    return { doc, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  const topDocs = scored.slice(0, nResults);
  
  return {
    documents: [topDocs.map(item => item.doc.content)],
    metadatas: [topDocs.map(item => item.doc.metadata)],
    distances: [topDocs.map(item => 1 - item.score / queryLower.split(' ').length)],
  };
}

export async function getOrCreateCollection(name: string) {
  // Stub for compatibility
  return { name };
}
