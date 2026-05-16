import weaviate from "weaviate-ts-client";
import fs from "fs";
import path from "path";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

const chunksDir = "../chunks";
const vocabFile = "../controlled-vocab/controlled_vocab.txt";


// Load controlled vocabulary
const vocabulary = new Set(
  fs.readFileSync(vocabFile, "utf-8").split(/\r?\n/).map(tag => tag.trim().toLowerCase())
);

function extractTags(text) {
  const words = new Set(text.toLowerCase().split(/\W+/));
  return [...vocabulary].filter(tag => words.has(tag));
}

function parseChunks(filePath, filename) {
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split(/\*\*\* START OF CHUNK \d+/)
    .filter(chunk => chunk.trim())
    .map((chunk, index) => ({
      filename,
      chunk_id: index + 1,
      text: chunk.trim(),
      tags: extractTags(chunk.trim()),
    }));
}

async function uploadChunks() {
  try {
    const files = fs.readdirSync(chunksDir).filter(file => file.endsWith(".txt"));
    let allChunks = [];
    
    for (const file of files) {
      const filePath = path.join(chunksDir, file);
      const chunks = parseChunks(filePath, file);
      allChunks.push(...chunks);
    }
    
    for (const chunk of allChunks) {
      await client.data.creator()
        .withClassName("BidResponseChunk")
        .withProperties(chunk)
        .do();
      console.log(`✅ Uploaded chunk ${chunk.chunk_id} from ${chunk.filename}`);
    }
  } catch (error) {
    console.error("❌ Error uploading chunks:", error);
  }
}

uploadChunks();
