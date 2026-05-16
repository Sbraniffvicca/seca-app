import weaviate from "weaviate-ts-client";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

async function checkSchema() {
  try {
    const schema = await client.schema.getter().do();

    // ✅ Find "EnterpriseDocumentChunk" in the schema
    const classSchema = schema.classes.find(cls => cls.class === "EnterpriseDocumentChunk");

    if (!classSchema) {
      console.error("❌ Error: 'EnterpriseDocumentChunk' class not found in schema.");
      return;
    }

    // ✅ Extract only property names
    const schemaFields = classSchema.properties.map(prop => prop.name);
    console.log("✅ Schema Fields:", JSON.stringify(schemaFields, null, 2));

    // ✅ Get count of chunks by verification status
    await countChunksByVerificationStatus();

    // ✅ Get count of files by ingestion date
    await countFilesByIngestionDate();

  } catch (error) {
    console.error("❌ Error fetching schema:", error);
  }
}

async function countChunksByVerificationStatus() {
  try {
    const verifiedCount = await client.graphql
      .get()
      .withClassName("EnterpriseDocumentChunk")
      .withFields("verification_status")
      .withWhere({
        path: ["verification_status"],
        operator: "Equal",
        valueText: "Verified",
      })
      .withLimit(1000) // ✅ Increase limit
      .do();

    const unverifiedCount = await client.graphql
      .get()
      .withClassName("EnterpriseDocumentChunk")
      .withFields("verification_status")
      .withWhere({
        path: ["verification_status"],
        operator: "Equal",
        valueText: "Unverified",
      })
      .withLimit(1000) // ✅ Increase limit
      .do();

    console.log(`✅ Chunk Count by Verification Status:`);
    console.log(`   - Verified: ${verifiedCount.data.Get.EnterpriseDocumentChunk.length}`);
    console.log(`   - Unverified: ${unverifiedCount.data.Get.EnterpriseDocumentChunk.length}`);
  } catch (error) {
    console.error("❌ Error fetching chunk counts:", error);
  }
}

// ✅ Count files by `ingestion_date` grouped for Verified & Unverified
async function countFilesByIngestionDate() {
  try {
    // ✅ Count Verified Files by `ingestion_date`
    const verifiedDateCounts = await client.graphql
      .aggregate()
      .withClassName("EnterpriseDocumentChunk")
      .withFields("groupedBy { value } meta { count }") // ✅ Correct syntax
      .withWhere({
        path: ["verification_status"],
        operator: "Equal",
        valueText: "Verified",
      })
      .withGroupBy(["ingestion_date"]) // ✅ Use `groupBy` properly
      .do();

    // ✅ Count Unverified Files by `ingestion_date`
    const unverifiedDateCounts = await client.graphql
      .aggregate()
      .withClassName("EnterpriseDocumentChunk")
      .withFields("groupedBy { value } meta { count }") // ✅ Correct syntax
      .withWhere({
        path: ["verification_status"],
        operator: "Equal",
        valueText: "Unverified",
      })
      .withGroupBy(["ingestion_date"]) // ✅ Use `groupBy` properly
      .do();

    console.log(`📅 File Count by Ingestion Date (Verified):`);
    verifiedDateCounts.data.Aggregate.EnterpriseDocumentChunk.forEach(entry => {
      console.log(`   - ${entry.groupedBy.value}: ${entry.meta.count} files`);
    });

    console.log(`📅 File Count by Ingestion Date (Unverified):`);
    unverifiedDateCounts.data.Aggregate.EnterpriseDocumentChunk.forEach(entry => {
      console.log(`   - ${entry.groupedBy.value}: ${entry.meta.count} files`);
    });

  } catch (error) {
    console.error("❌ Error fetching file counts by ingestion date:", error);
  }
}




async function checkCount() {
  const result = await client.graphql
    .aggregate()
    .withClassName("EnterpriseDocumentChunk")
    .withFields("meta { count }")
    .do();

  // ✅ Extract and log the real count
  const totalChunks = result.data.Aggregate.EnterpriseDocumentChunk[0].meta.count;
  console.log(`📊 Total Chunks in Weaviate: ${totalChunks}`);
}

checkCount();
checkSchema();
