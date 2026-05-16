import weaviate from "weaviate-ts-client";
import fs from "fs";
import path from "path";

const weaviateClient = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

const chunksDir = "../chunks";
const vocabFile = "../controlled-vocab/controlled_vocab.txt";

// ✅ Load controlled vocabulary
const vocabulary = new Set(
  fs.readFileSync(vocabFile, "utf-8").split(/\r?\n/).map(tag => tag.trim().toLowerCase())
);

// ✅ Extract tags from text
function extractTags(text) {
  const words = new Set(text.toLowerCase().split(/\W+/));
  return [...vocabulary].filter(tag => words.has(tag));
}

// ✅ Set ingestion date once per script execution
const ingestionDateGlobal = new Date().toISOString(); // ✅ Fix: This remains constant

// ✅ Parse text chunks (with metadata fields)
function parseChunks(filePath, filename) {
  const content = fs.readFileSync(filePath, "utf-8");
  const modifiedDate = fs.statSync(filePath).mtime.toISOString(); // ✅ Get file modified date

  return content
    .split(/\*\*\* START OF CHUNK \d+/)
    .filter(chunk => chunk.trim())
    .map((chunk, index) => ({
      filename,
      file_path: filePath, // ✅ Full file path
      chunk_id: index + 1,
      text: chunk.trim(),
      tags: extractTags(chunk.trim()),
      modified_date: modifiedDate, // ✅ File last modified date
      ingestion_date: ingestionDateGlobal, // ✅ Fix: Use global ingestion date
      verification_status: "Verified", // ✅ Mark manual chunks as Verified
    }));
}

// ✅ Check if a file exists in Weaviate (for manual chunks)
async function getFileMetadataFromWeaviate(filePath) {
  try {
    const response = await weaviateClient.graphql
      .get()
      .withClassName("EnterpriseDocumentChunk")
      .withFields("file_path modified_date")
      .withWhere({
        operator: "And",
        operands: [
          { path: ["file_path"], operator: "Equal", valueText: filePath },
          { path: ["verification_status"], operator: "Equal", valueText: "Verified" }
        ]
      })
      .withLimit(1)
      .do();

    const chunks = response.data.Get.EnterpriseDocumentChunk;
    return chunks.length > 0 ? chunks[0].modified_date : null;
  } catch (error) {
    console.error(`❌ Error checking file metadata for ${filePath}:`, error);
    return null;
  }
}

// ✅ Delete all chunks for a given file (Scoped to Verified)
async function deleteChunksForFile(filePath) {
  try {
    const response = await weaviateClient.batch
      .objectsBatchDeleter()
      .withClassName("EnterpriseDocumentChunk")
      .withWhere({
        operator: "And",
        operands: [
          { path: ["file_path"], operator: "Equal", valueText: filePath },
          { path: ["verification_status"], operator: "Equal", valueText: "Verified" }
        ]
      })
      .do();

    if (response.errors) {
      console.error(`❌ Error deleting chunks for ${filePath}:`, response.errors);
    } else {
      console.log(`🗑 Deleted old chunks for ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error deleting chunks for ${filePath}:`, error);
  }
}

// ✅ Normalize timestamps for proper comparison
function normalizeTimestamp(timestamp) {
  return new Date(timestamp).toISOString(); // ✅ Keep 'Z' to match Weaviate's storage format
}

// ✅ Upload chunks to Weaviate
async function uploadChunks() {
  try {
    console.log("🚀 Uploading chunks to Weaviate...");
    const files = fs.readdirSync(chunksDir).filter(file => file.endsWith(".txt"));

    for (const file of files) {
      const filePath = path.join(chunksDir, file);
      const modifiedDate = fs.statSync(filePath).mtime.toISOString();

      // ✅ Step 1: Check if file exists in Weaviate with correct path and status
      const weaviateModifiedDate = await getFileMetadataFromWeaviate(filePath);

      if (weaviateModifiedDate && normalizeTimestamp(weaviateModifiedDate) === normalizeTimestamp(modifiedDate)) {
        console.log(`⚡ Skipping ${file} (unchanged)`); // ✅ Fixed variable reference
        continue;
      }

      // ✅ Step 2: If file exists and has changed, delete old chunks
      if (weaviateModifiedDate) {
        await deleteChunksForFile(filePath);
      }

      // ✅ Step 3: Process and ingest new chunks
      const chunks = parseChunks(filePath, file);
      for (const chunk of chunks) {
        await weaviateClient.data.creator()
          .withClassName("EnterpriseDocumentChunk")
          .withProperties(chunk)
          .do();
        console.log(`✅ Uploaded chunk ${chunk.chunk_id} from ${chunk.filename}`);
      }
    }

    console.log("✅ All chunks uploaded successfully!");
  } catch (error) {
    console.error("❌ Error uploading chunks:", error);
  }
}

uploadChunks();
