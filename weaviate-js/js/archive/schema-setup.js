import weaviate from "weaviate-ts-client";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

async function setupSchema() {
  try {
    // Define the schema with the correct vectorizer module
    const schemaClass = {
      class: "BidResponseChunk",
      description: "Chunks of text from IT RFP responses",
      vectorizer: "text2vec-transformers", // ✅ Use text2vec-transformers instead of text2vec-openai
      moduleConfig: {
        "text2vec-transformers": {
          "pooling": "mean",
          "vectorizeClassName": false
        }
      },
      properties: [
        { name: "filename", dataType: ["text"] },
        { name: "chunk_id", dataType: ["int"] },
        { name: "text", dataType: ["text"] },  // ✅ Vectorized text field
        { name: "tags", dataType: ["text[]"] }
      ]
    };

    // Delete old schema first
    await client.schema.deleteAll();
    console.log("✅ Old schema deleted.");

    // Create new schema
    await client.schema.classCreator().withClass(schemaClass).do();
    console.log("✅ New schema with vectorizer created.");
  } catch (error) {
    console.error("❌ Error setting up schema:", error);
  }
}

setupSchema();
