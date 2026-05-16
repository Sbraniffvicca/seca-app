import weaviate from "weaviate-ts-client";

const weaviateClient = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

// ✅ Function to delete all Verified chunks
async function deleteAllVerifiedChunks() {
  try {
    console.log("🚨 Deleting all Verified chunks...");

    const response = await weaviateClient.batch
      .objectsBatchDeleter()
      .withClassName("EnterpriseDocumentChunk")
      .withWhere({
        path: ["verification_status"],
        operator: "Equal",
        valueText: "Verified", // ✅ Delete ONLY Verified
      })
      .do();

    if (response.errors) {
      console.error("❌ Error deleting Verified chunks:", response.errors);
    } else {
      console.log("🗑 Successfully deleted all Verified chunks!");
    }
  } catch (error) {
    console.error("❌ Error deleting Verified chunks:", error);
  }
}

// ✅ Run the deletion process
deleteAllVerifiedChunks();
