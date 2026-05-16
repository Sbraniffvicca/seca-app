import fs from 'node:fs/promises';
import path from 'node:path';
import pdf from 'pdf-parse';

async function processPDFDirectory(directoryPath, outputFilePath) {
  try {
    const files = await fs.readdir(directoryPath);
    let allText = '';

    for (const file of files) {
      if (file.toLowerCase().endsWith('.pdf')) {
        const filePath = path.join(directoryPath, file);
        try {
          const dataBuffer = await fs.readFile(filePath);
          const data = await pdf(dataBuffer);
          allText += `--- Start of ${file} ---\n`;
          allText += data.text;
          allText += `\n--- End of ${file} ---\n\n`;
          console.log(`Successfully processed: ${file}`);
        } catch (error) {
          console.error(`Error processing PDF file ${file}:`, error);
        }
      }
    }

    await fs.writeFile(outputFilePath, allText, 'utf8');
    console.log(`Successfully saved all text to: ${outputFilePath}`);

  } catch (error) {
    console.error('Error reading directory:', error);
  }
}

// --- Configuration ---
const directoryToScan = 'C:/ai_project/eddie/PUBS_EC'; // Replace with the path to your directory of PDFs
const outputTextFile = 'all_pdfs_text.txt'; // Replace with the desired output file name

// --- Run the script ---
processPDFDirectory(directoryToScan, outputTextFile);

