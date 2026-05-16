import weaviate from "weaviate-ts-client";
import readline from "readline";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("🔍 Enter a keyword to search unverified chunks: ", async (keyword) => {
  if (!keyword.trim()) {
    console.error("❌ Error: Keyword cannot be empty.");
    rl.close();
    process.exit(1);
  }

  console.log(`🔎 Searching for "${keyword}" in Unverified chunks...`);

  try {
    const response = await client.graphql
      .get()
      .withClassName("EnterpriseDocumentChunk")
      .withFields("filename chunk_id text tags _additional { score }")
      .withHybrid({ query: keyword, alpha: 0.5 }) // ✅ Hybrid Search (Keyword + Vector)
      .withWhere({
        path: ["verification_status"],  
        operator: "Equal",
        valueText: "Unverified"  // ✅ Filter for Unverified chunks only
      })
      .withLimit(10)  // ✅ Adjust as needed
      .do();

    const results = response.data.Get.EnterpriseDocumentChunk;

    if (results.length === 0) {
      console.log(`⚠️ No unverified chunks found for keyword: "${keyword}"`);
    } else {
      console.log(`✅ Found ${results.length} results:`);
      results.forEach(chunk => {
        console.log(`📄 ${chunk.filename} (Chunk ${chunk.chunk_id}):`);
        console.log(`   ${chunk.text.slice(0, 300)}...`); // Show first 300 chars
        console.log(`   🏷 Tags: ${chunk.tags?.join(", ") || "None"}`);
        console.log(`   🔢 Score: ${chunk._additional.score}\n`);
      });
    }
  } catch (error) {
    console.error("❌ Error querying Weaviate:", error);
  }

  rl.close();
});
