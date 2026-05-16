import weaviate from "weaviate-ts-client";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

async function searchChunks(query) {
  try {
    const response = await client.graphql
      .get()
      .withClassName("BidResponseChunk")
      .withFields("filename chunk_id text tags")
      .withHybrid({
        query: query,
        alpha: 0.5, // Balance between BM25 (keyword) and semantic search
      })
      .do();

    if (response.data.Get.BidResponseChunk.length === 0) {
      console.log("❌ No relevant chunks found.");
    } else {
      console.log("✅ Search Results:");
      response.data.Get.BidResponseChunk.forEach((chunk, index) => {
        console.log(`\n🔹 Result ${index + 1}`);
        console.log(`📄 File: ${chunk.filename} (Chunk ${chunk.chunk_id})`);
        console.log(`📝 Text: ${chunk.text.substring(0, 300)}...`); // Show first 300 chars
        console.log(`🏷️ Tags: ${chunk.tags.join(", ") || "None"}`);
      });
    }
  } catch (error) {
    console.error("❌ Error executing search:", error);
  }
}

// Run search with user input
const query = process.argv.slice(2).join(" ");
if (!query) {
  console.log("⚠️ Please provide a search query.");
} else {
  searchChunks(query);
}
