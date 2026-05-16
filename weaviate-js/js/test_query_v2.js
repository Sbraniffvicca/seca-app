import weaviate from "weaviate-ts-client";

const weaviateClient = weaviate.client({
  scheme: "http",
  host: "localhost:8080",
});

async function testQuery() {
    const response = await weaviateClient.graphql
        .get()
        .withClassName("EnterpriseDocumentChunk")
        .withFields("file_path modified_date")
        .withWhere({
            path: ["file_path"],
            operator: "Equal",
            valueText: "../chunks/Steve-dinner.txt"
        })
        .do();

    console.log("🧐 Exact Weaviate Timestamp for Steve-dinner.txt:", JSON.stringify(response, null, 2));
}

testQuery();
