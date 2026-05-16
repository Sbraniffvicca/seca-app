import weaviate from "weaviate-ts-client";

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

async function clearAllData() {
  try {
    // Fetch all class names in schema
    const schema = await client.schema.getter().do();
    const classNames = schema.classes.map(cls => cls.class);

    for (const className of classNames) {
      // Drop the class (deletes all objects within it)
      await client.schema.classDeleter().withClassName(className).do();
      console.log(`✅ Dropped class: ${className}`);
    }

    console.log("✅ All data cleared successfully!");
  } catch (error) {
    console.error("❌ Error clearing data:", error);
  }
}

clearAllData();
