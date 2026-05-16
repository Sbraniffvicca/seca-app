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
  } catch (error) {
    console.error("❌ Error fetching schema:", error);
  }
}

checkSchema();
