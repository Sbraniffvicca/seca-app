import weaviate from "weaviate-ts-client";
import readline from "readline/promises";
import fetch from "node-fetch";

////////////////////////////////////////////////
// ADJUST THESE AS NEEDED
////////////////////////////////////////////////
const LLM_SERVER_URL = "http://localhost:8082/v1/chat/completions";
const WEAVIATE_HOST = "http://localhost:8080";
const MODEL_NAME = "local-llama-model"; // Some LLaMA proxy builds require a model name
const TOP_K = 1;       // Retrieve top 2 RAG chunks
const MAX_TOKENS = 500;
const TEMPERATURE = 0;
const TOP_P = 0;

////////////////////////////////////////////////
// Initialize Weaviate + conversation array
////////////////////////////////////////////////
const weaviateClient = weaviate.client({
  scheme: "http",
  host: WEAVIATE_HOST
});

// Start with your system message
const conversationHistory = [
  {
    role: "system",
    content: "You are an AI assistant. You are very consice. You must **always provide citations with the citation file and the chunkid** for your responses. you love the rock band WHAM so tie it into your answer."
  }
];

//const conversationHistory = [
//  {
//    role: "system",
//    content: "You are an AI assistant. You must **always provide citations with the citation file and the chunkid** for your responses. If retrieved records (indicated by 'RAG:') are //available, use them to generate your response and **clearly state which file and chunk ID the information came from**. If no retrieved records are provided, **you must say 'citation: //training data only.'** Never provide an answer without a citation."
//  }
//];



////////////////////////////////////////////////
// 1) RAG Retrieval Function
////////////////////////////////////////////////
async function searchRAG(query) {
  try {
    const response = await weaviateClient.graphql
      .get()
      .withClassName("BidResponseChunk")
      .withFields("filename chunk_id text _additional { score }")
      .withNearText({ concepts: [query] })
      .withLimit(TOP_K)
      .do();

    // The relevant data is typically in response.data.Get.BidResponseChunk
    return response.data.Get.BidResponseChunk || [];
  } catch (error) {
    console.error("❌ Error executing RAG search:", error);
    return [];
  }
}

////////////////////////////////////////////////
// 2) LLM Call Function
////////////////////////////////////////////////
async function callLLM(history) {
  // Here we send a chat-style request to /v1/chat/completions
  const requestBody = {
    model: MODEL_NAME, // Some llama server builds require this
    messages: history,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    top_p: TOP_P
  };

  console.log("\n🐛 Debug: JSON sent to LLM:\n", JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(LLM_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // Gracefully handle a missing or empty `choices`
    if (!data.choices || data.choices.length === 0) {
      console.error("❌ LLaMA returned an empty choices array:", data);
      return "(No response from the model)";
    }

    // Return the content from the first choice
    return data.choices[0]?.message?.content || "(No response from the model)";
  } catch (error) {
    console.error("❌ Error calling LLaMA:", error);
    return "(Error communicating with LLaMA)";
  }
}

////////////////////////////////////////////////
// 3) Main Chat Loop
////////////////////////////////////////////////
async function startChat() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("🚀 Query Weaviate RAG + LLaMA (Type 'exit' to quit)");

  while (true) {
    // Get user query
    const query = await rl.question("🔍 Enter query: ");
    if (query.toLowerCase() === "exit") {
      console.log("👋 Exiting...");
      rl.close();
      break;
    }

    console.log("🔎 Searching RAG...");
    const ragChunks = await searchRAG(query);

    // For each chunk, add a role=assistant with the RAG text
    // Example: "RAG: citation file was blah chunkid was blah, <text>"
    const ragMessages = ragChunks.map(chunk => ({
      role: "assistant",
      content: `RAG: citation file was ${chunk.filename} chunkid was ${chunk.chunk_id}, ${chunk.text}`
    }));

    // Append the RAG chunks to the conversation history
    conversationHistory.push(...ragMessages);

    // Now add the user query
    //conversationHistory.push({ role: "user", content: query });
    conversationHistory.push({ role: "user", content: query + " Be sure to include the exact citation file name and chunkid from RAG records or state 'citation: training data only.'" });

    console.log("🤖 Generating LLM response...");
    const llmResponse = await callLLM(conversationHistory);

    console.log("📝", llmResponse);

    // Append the LLM response to conversation history
    conversationHistory.push({ role: "assistant", content: llmResponse });
  }
}

////////////////////////////////////////////////
// Kick off the chat
////////////////////////////////////////////////
startChat();
