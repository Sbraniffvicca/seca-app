import weaviate from "weaviate-ts-client";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

async function checkSchema() {
  try {
    const schema = await client.schema.getter().do();
    console.log("✅ Weaviate Schema:", JSON.stringify(schema, null, 2));
  } catch (error) {
    console.error("❌ Error fetching schema:", error);
  }
}

checkSchema();

