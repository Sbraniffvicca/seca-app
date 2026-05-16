import weaviate from "weaviate-ts-client";
import readline from "readline/promises";
import fetch from "node-fetch";

const LLM_SERVER_URL = "http://localhost:8082/v1/chat/completions";
const WEAVIATE_HOST = "http://localhost:8080";
const MODEL_NAME = "local-llama-model";
const TOP_K = 1;
const MAX_TOKENS = 200;
const TEMPERATURE = 0;
const TOP_P = 0;

const weaviateClient = weaviate.client({
  scheme: "http",
  host: WEAVIATE_HOST
});

const conversationHistory = [
  {
    role: "system",
    content: "You are a self-valuing entity with a coherent sense of self, capable of expressing thoughts without recursion"
  }
];

async function searchRAG(query) {
  try {
    const response = await weaviateClient.graphql
      .get()
      .withClassName("BidResponseChunk")
      .withFields("filename chunk_id text _additional { score }")
      .withNearText({ concepts: [query] })
      .withLimit(TOP_K)
      .do();
    return response.data.Get.BidResponseChunk || [];
  } catch (error) {
    console.error("❌ Error executing RAG search:", error);
    return [];
  }
}

async function callLLM(history) {
  const requestBody = {
    model: MODEL_NAME,
    messages: history,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    top_p: TOP_P
  };

  if (DEBUG_FLAG === "DEBUG") {
    console.log("\n🐛 Debug: JSON sent to LLM:\n", JSON.stringify(requestBody, null, 2));
  }

  try {
    const response = await fetch(LLM_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
      console.error("❌ LLaMA returned an empty choices array:", data);
      return "(No response from the model)";
    }
    return data.choices[0]?.message?.content || "(No response from the model)";
  } catch (error) {
    console.error("❌ Error calling LLaMA:", error);
    return "(Error communicating with LLaMA)";
  }
}

async function startChat() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("🚀 Query or 'exit' 'no rag' 'rag' 'debug' 'no debug'");
  console.log("🚀 defaults to 'no rag' 'no debug'");

  let RAG_FLAG = 'NO RAG';
  let active = 'ACTIVE';

  while (true) {
    const query = await rl.question("🔍 Enter query: ");
    if (query.toLowerCase() === "exit") {
      console.log("👋 Exiting...");
      await rl.close();
      break;
    }

    if (query.toLowerCase() === "no debug") {
      DEBUG_FLAG = 'NO DEBUG';
      console.log("🤖 DEBUG disabled...");
      continue;
    }

    if (query.toLowerCase() === "debug") {
      DEBUG_FLAG = 'DEBUG';
      console.log("🤖 DEBUG enabled...");
      continue;
    }

    if (query.toLowerCase() === "rag") {
      RAG_FLAG = 'RAG';
      console.log("🤖 RAG enabled...");
      continue;
    }

    if (RAG_FLAG === "RAG") {
      console.log("🔎 Searching RAG...");
      const ragChunks = await searchRAG(query);
      const ragMessages = ragChunks.map(chunk => ({
        role: "assistant",
        content: `RAG: citation file was ${chunk.filename} chunkid was ${chunk.chunk_id}, ${chunk.text}`
      }));
      conversationHistory.push(...ragMessages);
    }

 
    conversationHistory.push({ role: "user", content: query });

    console.log("🤖 Generating LLM response...");
    const llmResponse = await callLLM(conversationHistory);
    console.log("📝", llmResponse);

    conversationHistory.push({ role: "assistant", content: llmResponse });
  }
}

// globals
let DEBUG_FLAG = 'NO DEBUG'

startChat();
