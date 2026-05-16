import weaviate from "weaviate-ts-client";
import readline from "readline";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function searchChunks(query) {
  try {
    const response = await client.graphql
      .get()
      .withClassName("BidResponseChunk")
      .withFields("filename chunk_id text tags _additional { score }")
      .withHybrid({ query, alpha: 0.5 }) // Hybrid search
      .withLimit(5)
      .do();

    const results = response.data.Get.BidResponseChunk;

    if (!results || results.length === 0) {
      console.log("\n❌ No relevant results found.\n");
      return;
    }

    console.log(`\n✅ **Top ${results.length} matches:**\n`);
    results.forEach((chunk, index) => {
      const score = parseFloat(chunk._additional.score) || 0; // Convert safely

      console.log(`🔹 **Result ${index + 1}:**`);
      console.log(`   📄 Filename: ${chunk.filename}`);
      console.log(`   🔢 Chunk ID: ${chunk.chunk_id}`);
      console.log(`   🏷 Tags: ${chunk.tags.join(", ") || "None"}`);
      console.log(`   📝 Text: ${chunk.text.substring(0, 300)}...`);
      console.log(`   🎯 Score: ${score.toFixed(4)}\n`);
    });
  } catch (error) {
    console.error("❌ Error executing search:", error);
  }
}

// Interactive query loop
function askQuery() {
  rl.question("\n🔍 Enter query (or type 'exit' to quit): ", async (query) => {
    if (query.toLowerCase() === "exit") {
      console.log("👋 Exiting...");
      rl.close();
      return;
    }
    await searchChunks(query);
    askQuery();
  });
}

console.log("🚀 **Weaviate RAG Query Tool**\n(Type 'exit' to quit)");
askQuery();
