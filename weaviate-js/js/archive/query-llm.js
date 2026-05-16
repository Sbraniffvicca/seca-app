import readline from "readline";
import fetch from "node-fetch";

const LLM_SERVER_URL = "http://localhost:8082/v1/completions";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\n🚀 Simple LLM Query Tool");
console.log("(Type 'exit' to quit)\n");

function askQuery() {
  rl.question("🔍 Enter query: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      console.log("\n👋 Exiting...");
      rl.close();
      return;
    }

    try {
      const response = await fetch(LLM_SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, max_tokens: 50, temperature: 0, top_p: 0 })
      });

      const data = await response.json();
      console.log("\n🧠 AI Response:\n", data.choices?.[0]?.text || "❌ No response.");
    } catch (error) {
      console.error("❌ Error:", error);
    }

    askQuery(); // Ask for the next query
  });
}

askQuery();

