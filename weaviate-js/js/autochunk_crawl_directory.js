import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import weaviate from 'weaviate-ts-client';

const client = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080',
});

// ✅ Ensure a directory is provided
if (process.argv.length < 3) {
  console.error("❌ Error: No target directory provided. Usage: node processDirectory.js <directory>");
  process.exit(1);
}

const targetDirectory = process.argv[2];

if (!fs.existsSync(targetDirectory) || !fs.statSync(targetDirectory).isDirectory()) {
  console.error(`❌ Error: '${targetDirectory}' is not a valid directory.`);
  process.exit(1);
}

const OVERLAP_RATIO = 0.25;

// ✅ Generate ingestion_date once per run
const ingestionDate = new Date().toISOString();
console.log(`🕒 Ingestion Run Timestamp: ${ingestionDate}`);


async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  return pdfData.text;
}

async function extractTextFromDocx(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: dataBuffer });
  return result.value;
}

// no longer used but will keep in the file in case a client wants it
function createOverlappingChunks(text, chunkSize = 500) {
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
  let chunks = [];
  let currentChunk = [];
  let charCount = 0;
  let overlapBuffer = [];

  for (const para of paragraphs) {
    if (charCount + para.length > chunkSize) {
      chunks.push([...overlapBuffer, ...currentChunk].join(' '));
      overlapBuffer = currentChunk.slice(-Math.ceil(currentChunk.length * OVERLAP_RATIO));
      currentChunk = [];
      charCount = 0;
    }

    currentChunk.push(para);
    charCount += para.length;
  }

  if (currentChunk.length > 0) {
    chunks.push([...overlapBuffer, ...currentChunk].join(' '));
  }

  return chunks;
}

// ✅ Check if a file exists in Weaviate, scoped to 'Unverified' and full file_path
async function getFileMetadataFromWeaviate(filePath) {
  try {
    const response = await client.graphql
      .get()
      .withClassName("EnterpriseDocumentChunk")
      .withFields("file_path modified_date") 
      .withWhere({
        operator: "And",
        operands: [
          { path: ["file_path"], operator: "Equal", valueText: filePath },  // ✅ Match full file path
          { path: ["verification_status"], operator: "Equal", valueText: "Unverified" } // ✅ Keep Unverified distinct
        ]
      })
      .withLimit(1) // ✅ Only need one instance to check if file exists
      .do();

    const chunks = response.data.Get.EnterpriseDocumentChunk;
    return chunks.length > 0 ? chunks[0].modified_date : null;
  } catch (error) {
    console.error(`❌ Error checking file metadata for ${filePath}:`, error);
    return null;
  }
}

// ✅ Delete all chunks for a given file (scoped to Unverified)
async function deleteChunksForFile(filePath) {
  try {
    const response = await client.batch
      .objectsBatchDeleter()
      .withClassName("EnterpriseDocumentChunk")
      .withWhere({
        operator: "And",
        operands: [
          { path: ["file_path"], operator: "Equal", valueText: filePath }, 
          { path: ["verification_status"], operator: "Equal", valueText: "Unverified" }
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


// no longer used but will keep in case client wants it
async function OLDOLDprocessFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let text = '';

  if (ext === '.pdf') {
    text = await extractTextFromPDF(filePath);
  } else if (ext === '.docx') {
    text = await extractTextFromDocx(filePath);
  } else {
    console.log(`⚠️ Skipping unsupported file type: ${filePath}`);
    return [];
  }

  return createOverlappingChunks(text);
}


function createSmartParagraphChunks(text) {
  return text
    .split(/\n\s*\n/) // ✅ Split by double newlines (paragraphs)
    .map(para => para.trim()) // ✅ Remove leading/trailing spaces
    .filter(para => para.length > 0); // ✅ Remove empty paragraphs
}

async function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let text = '';

  if (ext === '.pdf') {
    text = await extractTextFromPDF(filePath);
  } else if (ext === '.docx') {
    text = await extractTextFromDocx(filePath);
  } else {
    console.log(`⚠️ Skipping unsupported file type: ${filePath}`);
    return [];
  }

  return createSmartParagraphChunks(text);
}


async function ingestChunksToWeaviate(filePath, chunks) {
  const filename = path.basename(filePath);
  const modifiedDate = fs.statSync(filePath).mtime.toISOString();


  for (let i = 0; i < chunks.length; i++) {
    await client.data.creator()
      .withClassName("EnterpriseDocumentChunk")
      .withProperties({
        filename,
        file_path: filePath, // ✅ Store full file path
        chunk_id: i + 1,
        text: chunks[i],
        modified_date: modifiedDate,
        ingestion_date: ingestionDate,
        verification_status: "Unverified", // ✅ Keep only unverified scope
        dms_id: "",
      })
      .do();
  }

  console.log(`✅ Ingested ${chunks.length} chunks from ${filename}`);
}

function normalizeTimestamp(timestamp) {
    return new Date(timestamp).toISOString().slice(0, -1); // Remove trailing 'Z' for safe comparison
}


async function processDirectory(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      await processDirectory(filePath);
    } else {
      const filename = path.basename(filePath);
      const modifiedDate = fs.statSync(filePath).mtime.toISOString();

      // ✅ Step 1: Check if file exists in Weaviate with correct path and status
      const weaviateModifiedDate = await getFileMetadataFromWeaviate(filePath);

if (weaviateModifiedDate && normalizeTimestamp(weaviateModifiedDate) === normalizeTimestamp(modifiedDate)) {
    console.log(`⚡ Skipping ${filename} (unchanged)`);
    continue; // ✅ Skip unchanged files
}



      // ✅ Step 2: If file exists and has changed, delete old chunks
      if (weaviateModifiedDate) {
        await deleteChunksForFile(filePath);
      }

      // ✅ Step 3: Process and ingest new chunks
      const chunks = await processFile(filePath);
      if (chunks.length > 0) {
        await ingestChunksToWeaviate(filePath, chunks);
      }
    }
  }
}

console.log(`🔍 Processing directory: ${targetDirectory}`);
processDirectory(targetDirectory).then(() => console.log('🎉 Processing complete!'));
