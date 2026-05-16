import fs from 'fs';
import pdfParse from 'pdf-parse';

const filePath = 'C:/ai_project/weaviate-js/js/sample.pdf'; // ✅ Ensure this file exists
// update the index.js to false to get around bug in pdf library

console.log(`🔍 Checking file: ${filePath}`);

if (!fs.existsSync(filePath)) {
  console.error(`❌ Error: File not found - ${filePath}`);
  process.exit(1);
}

console.log(`✅ File found. Parsing PDF...`);

const dataBuffer = fs.readFileSync(filePath);

pdfParse(dataBuffer)
  .then(data => console.log(`📄 PDF Content:\n${data.text}`))
  .catch(error => console.error(`❌ Error parsing PDF:`, error));
