import weaviate from "weaviate-ts-client";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

async function setupSchema() {
  try {
    console.log("🔍 Checking for existing schema...");

    // ✅ Delete existing schema first
    await client.schema.deleteAll();
    console.log("✅ Old schema deleted.");

    // ✅ Define the new schema with **full metadata**
    const schemaClass = {
      class: "DocumentChunk",
      description: "Chunks of text extracted from various uploaded documents",
      vectorizer: "text2vec-transformers",
      moduleConfig: {
        "text2vec-transformers": {
          "pooling": "mean",
          "vectorizeClassName": false
        }
      },
      properties: [
        { name: "filename", dataType: ["text"], description: "Name of the uploaded file" },
        { name: "chunk_id", dataType: ["int"], description: "Chunk sequence number within the file" },
        { name: "text", dataType: ["text"], description: "Extracted text from document" },  // ✅ Vectorized field
        { name: "user_id", dataType: ["int"], description: "User ID of the uploader" },
        { name: "upload_timestamp", dataType: ["date"], description: "Time when file was uploaded" },
        { name: "tags", dataType: ["text[]"], description: "Tags assigned to document chunk" },
        { name: "dms_id", dataType: ["text"], description: "Document ID from an external Document Management System" },
        { name: "path", dataType: ["text"], description: "Relative path to the document on the file system" }
      ]
    };

    // ✅ Create the new schema
    await client.schema.classCreator().withClass(schemaClass).do();
    console.log("✅ New schema created with full metadata.");

  } catch (error) {
    console.error("❌ Error setting up schema:", error);
  }
}

setupSchema();
