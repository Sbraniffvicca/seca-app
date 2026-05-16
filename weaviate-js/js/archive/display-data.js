import weaviate from "weaviate-ts-client";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

async function fetchChunks() {
  try {
    const response = await client.graphql
      .get()
      .withClassName("BidResponseChunk")
      .withFields("filename chunk_id text tags")
      .do();

    const chunks = response.data.Get.BidResponseChunk;
    if (!chunks.length) {
      console.log("⚠️ No data found in Weaviate.");
      return;
    }

    console.log("\n📌 **Stored Chunks in Weaviate:**");
    chunks.forEach((chunk) => {
      console.log(`\n📂 File: ${chunk.filename}`);
      console.log(`🔢 Chunk ID: ${chunk.chunk_id}`);
      console.log(`📜 Text: ${chunk.text}`);
      console.log(`🏷️ Tags: ${chunk.tags.join(", ") || "None"}`);
      console.log("------------------------------------------------");
    });
  } catch (error) {
    console.error("❌ Error fetching data:", error);
  }
}

fetchChunks();
	