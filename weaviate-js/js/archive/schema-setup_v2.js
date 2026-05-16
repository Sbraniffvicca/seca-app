import weaviate from "weaviate-ts-client";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

async function setupSchema() {
  try {
    // Define the schema with full metadata matching the crawler
    const schemaClass = {
      class: "EnterpriseDocumentChunk", // ✅ Matches the crawler's data
      description: "Chunks of text extracted from enterprise documents",
      vectorizer: "text2vec-transformers", // ✅ Correct for on-prem vectorization
      moduleConfig: {
        "text2vec-transformers": {
          "pooling": "mean",
          "vectorizeClassName": false
        }
      },
      properties: [
        { name: "filename", dataType: ["text"], description: "Original filename" },
        { name: "file_path", dataType: ["text"], description: "Full file path on LAN" },
        { name: "chunk_id", dataType: ["int"], description: "Chunk number within the file" },
        { name: "text", dataType: ["text"], description: "Chunked paragraph from the document" }, // ✅ Vectorized
        { name: "tags", dataType: ["text[]"], description: "Auto-generated or manual tags" },
        { name: "dms_id", dataType: ["text"], description: "Document Management System ID (if applicable)" },
        { name: "modified_date", dataType: ["date"], description: "Last modified date of the file" },
        { name: "ingestion_date", dataType: ["date"], description: "Date when the document was processed" }
      ]
    };

    // Delete old schema first
    await client.schema.deleteAll();
    console.log("✅ Old schema deleted.");

    // Create new schema
    await client.schema.classCreator().withClass(schemaClass).do();
    console.log("✅ New Weaviate schema created successfully.");
  } catch (error) {
    console.error("❌ Error setting up schema:", error);
  }
}

// Run the setup function
setupSchema();
