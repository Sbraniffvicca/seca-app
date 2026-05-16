import weaviate from "weaviate-ts-client";
import fs from "fs";
import path from "path";

const weaviateClient = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

const filePath = path.resolve("../chunks/Steve-dinner.txt"); // ✅ Adjust path if needed

async function checkFileMetadata() {
  try {
    const response = await weaviateClient.graphql
      .get()
      .withClassName("EnterpriseDocumentChunk")
      .withFields("file_path modified_date")
      .withWhere({
        path: ["file_path"],
        operator: "Equal",
        valueText: filePath,
      })
      .withLimit(1)
      .do();

    // ✅ Extract Weaviate-stored modified_date
    const weaviateModifiedDate = response.data.Get.EnterpriseDocumentChunk.length > 0 
      ? response.data.Get.EnterpriseDocumentChunk[0].modified_date 
      : "Not Found";

    // ✅ Get local modified_date from filesystem
    const localModifiedDate = fs.statSync(filePath).mtime.toISOString();

    console.log(`\n🔍 Checking File: ${filePath}`);
    console.log(`   🕒 Local modified_date:  ${localModifiedDate}`);
    console.log(`   🕒 Weaviate modified_date: ${weaviateModifiedDate}`);

    // ✅ Compare timestamps
    if (weaviateModifiedDate === localModifiedDate) {
      console.log("✅ Timestamps match. The file should NOT be re-uploading.");
    } else {
      console.log("⚠️ Timestamps DO NOT match. This file is being re-uploaded.");
    }
  } catch (error) {
    console.error(`❌ Error checking file metadata for ${filePath}:`, error);
  }
}

checkFileMetadata();
