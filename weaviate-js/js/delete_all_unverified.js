import weaviate from "weaviate-ts-client";

const weaviateClient = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

// ✅ Function to delete all Unverified chunks
async function deleteAllUnverifiedChunks() {
  try {
    console.log("🚨 Deleting all Unverified chunks...");

    const response = await weaviateClient.batch
      .objectsBatchDeleter()
      .withClassName("EnterpriseDocumentChunk")
      .withWhere({
        path: ["verification_status"],
        operator: "Equal",
        valueText: "Unverified", // ✅ Delete ONLY Verified
      })
      .do();

    if (response.errors) {
      console.error("❌ Error deleting Unverified chunks:", response.errors);
    } else {
      console.log("🗑 Successfully deleted all Unverified chunks!");
    }
  } catch (error) {
    console.error("❌ Error deleting Unverified chunks:", error);
  }
}

// ✅ Run the deletion process
deleteAllUnverifiedChunks();
