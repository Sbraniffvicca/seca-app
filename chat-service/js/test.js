import { fetch } from "undici";  // Ensure `undici` is used

async function testLlamaStreaming() {
  const response = await fetch("http://localhost:8082/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "local-llama-model",
      messages: [{ role: "user", content: "Tell me a joke." }],
      max_tokens: 50,
      stream: true,  // Enable streaming
    }),
  });

  if (!response.ok) {
    console.error("HTTP Error:", response.status);
    return;
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let accumulatedContent = "";  // To accumulate the full response

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });

    // Process each line in the buffer
    let lines = buffer.split("\n");
    buffer = lines.pop(); // Save any incomplete lines for the next loop

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue; // Ignore non-data lines

      const jsonString = line.slice(6).trim(); // Remove "data: " prefix

      if (jsonString === "[DONE]") {
        console.log("\n✅ Streaming complete.");
        console.log("Full response:", accumulatedContent);
        return;
      }

      try {
        const parsed = JSON.parse(jsonString);

        // Extract the content from the delta object and accumulate
        const content = parsed.choices[0]?.delta?.content;
        if (content) {
          accumulatedContent += content;  // Append the new content chunk
          console.log(content);  // Display the current chunk
        }
      } catch (err) {
        console.error("JSON Parse Error:", err.message, "\nRaw:", jsonString);
      }
    }
  }
}

testLlamaStreaming();
