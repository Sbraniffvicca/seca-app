import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import weaviate from 'weaviate-ts-client';

// ✅ Configure Weaviate Client
const client = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080',
});

// ✅ Define Chunk Overlap Percentage
const OVERLAP_RATIO = 0.25; // 25% of previous chunk will overlap

// ✅ Function: Extract Text from PDF
async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  return pdfData.text;
}

// ✅ Function: Extract Text from DOCX
async function extractTextFromDocx(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: dataBuffer });
  return result.value;
}

// ✅ Function: Split Text into Overlapping Chunks
function createOverlappingChunks(text, chunkSize = 500) {
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
  let chunks = [];
  let currentChunk = [];
  let charCount = 0;
  let overlapBuffer = [];

  for (const para of paragraphs) {
    if (charCount + para.length > chunkSize) {
      chunks.push([...overlapBuffer, ...currentChunk].join(' '));

      // ✅ Store the overlap portion for next chunk
      overlapBuffer = currentChunk.slice(-Math.ceil(currentChunk.length * OVERLAP_RATIO));

      // ✅ Reset current chunk
      currentChunk = [];
      charCount = 0;
    }

    currentChunk.push(para);
    charCount += para.length;
  }

  // ✅ Push last chunk
  if (currentChunk.length > 0) {
    chunks.push([...overlapBuffer, ...currentChunk].join(' '));
  }

  return chunks;
}

// ✅ Function: Process a Single File
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

  return createOverlappingChunks(text);
}

// ✅ Function: Ingest File Chunks into Weaviate
async function ingestChunksToWeaviate(filePath, chunks) {
  const filename = path.basename(filePath);
  const modifiedDate = fs.statSync(filePath).mtime.toISOString();

  for (let i = 0; i < chunks.length; i++) {
    await client.data.creator()
      .withClassName('BidResponseChunk')
      .withProperties({
        filename: filename,
        chunk_id: i + 1,
        text: chunks[i],
        last_modified: modifiedDate,
      })
      .do();
  }

  console.log(`✅ Ingested ${chunks.length} chunks from ${filename}`);
}

// ✅ Function: Process Directory Recursively
async function processDirectory(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      await processDirectory(filePath); // ✅ Recursive Call for Subdirectories
    } else {
      const chunks = await processFile(filePath);
      if (chunks.length > 0) {
        await ingestChunksToWeaviate(filePath, chunks);
      }
    }
  }
}

// 🚀 Start processing (pass directory path as CLI argument)
const targetDirectory = process.argv[2] || './documents';
console.log(`🔍 Processing directory: ${targetDirectory}`);
processDirectory(targetDirectory).then(() => console.log('🎉 Processing complete!'));
