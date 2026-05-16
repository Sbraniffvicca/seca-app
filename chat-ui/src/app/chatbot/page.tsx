"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Modal, Input, Button, message as antdMessage, Tooltip } from "antd";
import { SendOutlined, BookOutlined, DeleteOutlined } from "@ant-design/icons";

import { Conversations } from "../repositories/interfaces"; // adjust path if needed

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);

const [citations, setCitations] = useState<{ rag_filename: string; rag_chunk_id: number | null; content: string }[]>([]);


//  const [citations, setCitations] = useState<{ rag_filename: string; rag_chunk_id: number; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCitationsModalOpen, setIsCitationsModalOpen] = useState(false);

  // const [libraryEnabled, setLibraryEnabled] = useState(true);
  const libraryEnabled = true;


  useEffect(() => {
  const fetchAllConversations = async () => {
      try {
        const res = await axios.get("/api/chat/AllConvervations", {
          withCredentials: true,
        });

  const allMessages = JSON.parse(res.data.message) as Conversations[];

  const extractedCitations = allMessages
  .filter((msg: Conversations) => msg.role === "rag_data")
  .map((msg: Conversations) => ({
    rag_filename: msg.rag_filename || "Unknown File",
    rag_chunk_id: msg.rag_chunk_id || 0,
    content: msg.content || "No content available",
  }));

  setCitations(extractedCitations);

  // ✅ Only keep user & assistant messages in the chat window
        const chatMessages = allMessages.filter(
          (msg) => msg.role === "user" || msg.role === "assistant"
        );
        setMessages(chatMessages);

      } catch (error) {
        antdMessage.error("Failed to fetch conversations");
        console.error("Fetch Conversations Error:", error);
      }
    };

    fetchAllConversations(); // Fetch conversations on page load
  }, []);



  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    //try {
      const response = await fetch("/api/chat/chatresponse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: input, libraryEnabled: !!libraryEnabled }),
      });

      if (!response.ok) {
        const errorText = await response.text();
//        antdMessage.error("sendMessage Error:" + errorText);

antdMessage.error({
  content: `sendMessage Error: ${errorText}`,
  duration: 25, // in seconds
});
         setLoading(false);
        throw new Error(errorText || "Server error");
      }

      if (!response.body) throw new Error("Empty response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialMessage = "";

      // ✅ Append user message and create a placeholder for AI response
      setMessages((prev) => [
        ...prev,
        { role: "user", content: input },
        { role: "assistant", content: "" },
      ]);
      setInput(""); // ✅ Clear input after sending

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        // ✅ Ensure assistant message updates progressively
        partialMessage += chunk;
        setMessages((prev) => [
          ...prev.slice(0, -1), // Keep everything except last message
          { role: "assistant", content: partialMessage }, // Update last message only
        ]);
      }
    //} catch (err) {
    //  console.error("❌ Chat request failed:", err);
    //  setError("Failed to fetch response.");
    //  antdMessage.error("Failed to fetch response.");
    //} finally {
      setLoading(false);
    //}
  };

const handleShowCitations = async () => {
  try {
    const res = await axios.get("/api/chat/AllConvervations", {
      withCredentials: true,
    });

    const allMessages = JSON.parse(res.data.message) as Conversations[];

    const extractedCitations = allMessages
      .filter((msg) => msg.role === "rag_data" || msg.role === "upl data")
      .map((msg) => {
        if (msg.role === "rag_data") {
          return {
            rag_filename: msg.rag_filename || "Unknown File",
            rag_chunk_id: msg.rag_chunk_id ?? 0,
            content: msg.content || "No content available",
          };
        } else {
          return {
            rag_filename: msg.upl_filename || "Uploaded File",
            rag_chunk_id: null,
            content: msg.content || "No content available",
          };
        }
      });

    setCitations(extractedCitations);
    setIsCitationsModalOpen(true);
  } catch (error) {
    antdMessage.error("Failed to fetch citations.");
    console.error("Fetch Citations Error:", error);
  }
};


  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "90vh",
        padding: "10px",
        overflow: "hidden",
        backgroundColor: "#f0f2f5",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: "5px" }}>

<Button icon={<BookOutlined />} style={{ marginRight: "10px" }} onClick={handleShowCitations}>
  Citations
</Button>

        <Tooltip title="Clear the conversation and start fresh.">
          <Button
            type="primary"
            danger
            onClick={async () => {
              try {
                await fetch("/api/chat/clear", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                });
                setMessages([]); // Clear local chat history
                setCitations([]); // Clear citations as well
              } catch (error) {
                console.error("Failed to clear chat:", error);
                antdMessage.error("Failed to clear chat history.");
              }
            }}
            icon={<DeleteOutlined />}
          >
            Clear
          </Button>
        </Tooltip>
      </div>

      {/* Chat Messages Section */}
      <div
        style={{
          flexGrow: 1,
          overflowY: "auto",
          padding: "10px",
          background: "#ffffff",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        {messages.map((msg, index) => (
          <p key={index} style={{ padding: "8px", background: msg.role === "user" ? "#e6f7ff" : "#f6ffed", borderRadius: "5px" }}>
            <strong>{msg.role === "user" ? "You: " : "AI: "}</strong>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
             {msg.content}
            </pre>

          </p>
        ))}
      </div>

      {error && <p style={{ color: "red", marginTop: "5px" }}>{error}</p>}

      {/* Input & Send Button */}
      <div style={{ display: "flex", marginTop: "5px", gap: "8px" }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          autoSize={{ minRows: 2, maxRows: 4 }}
          style={{ flexGrow: 1 }}
        />
        <Tooltip title="Ask AI">
        <Button type="primary" icon={<SendOutlined />} onClick={sendMessage} loading={loading}>
        </Button>
        </Tooltip>
      </div>

      {/* Citations Modal */}
      <Modal
        title="Citations"
        open={isCitationsModalOpen}
        onCancel={() => setIsCitationsModalOpen(false)}
        footer={null}
        width={700}
      >
        {citations.length > 0 ? (
          citations.map((citation, index) => (
            <div key={index} style={{ marginBottom: "15px", padding: "10px", background: "#f0f2f5", borderRadius: "5px" }}>

<strong>
  📄 {citation.rag_filename}
  {citation.rag_chunk_id !== null && citation.rag_chunk_id !== undefined && (
    <> (Chunk {citation.rag_chunk_id})</>
  )}
</strong>


              <p style={{ whiteSpace: "pre-wrap", marginTop: "5px" }}>{citation.content}</p>
            </div>
          ))
        ) : (
          <p>No citations found.</p>
        )}
      </Modal>
    </div>
  );
}
