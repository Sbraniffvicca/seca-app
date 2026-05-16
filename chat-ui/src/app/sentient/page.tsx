"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Input, Button, Tooltip, Modal, message as antdMessage } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { Conversations } from "../repositories/interfaces"; // <-- relative path ✅
import { Switch } from "antd";

// Discriminated-union for subreply JSON
type Subreply =
  | { subreply_type: "addNewConvRecord" }
  | { subreply_type: "updateOldConvRecord"; id: number }
  | { subreply_type: "deleteConvRecord"; id: number }
  | { subreply_type: "run-mysql-dml"; id: string }
  | { subreply_type: "fetchUrl"; url: string };

export default function SentientPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Conversations[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logVisible, setLogVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);


  // ---------- helpers ----------
  const fetchConversations = async () => {
    try {
      const res = await axios.get("/api/chat/AllConvervations", {
        withCredentials: true,
      });
      const all = JSON.parse(res.data.message) as Conversations[];
      // only user / assistant rows
      setMessages(all.filter((m) => m.role === "user" || m.role === "assistant"));
    } catch {
      antdMessage.error("Failed to fetch conversations");
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // ---------- send ----------
  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setLogLines([]);
    const userText = input;
    setInput("");

    try {
      const res = await fetch("/api/chat/creativeresponse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: userText }),
      });

      if (!res.ok || !res.body) {
        antdMessage.error(`Send failed (${res.status})`);
        return;
      }

      // read full stream (no optimistic state – we’ll refetch after)
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let body = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        body += decoder.decode(value as Uint8Array, { stream: true });
      }

      // parse assistant subreply JSON
      try {
        const parsed = JSON.parse(body) as Subreply[];
        const lines = parsed.map((p) => {
          switch (p.subreply_type) {
            case "addNewConvRecord":
              return "➕ add";
            case "updateOldConvRecord":
              return `📝 update ${p.id}`;
            case "deleteConvRecord":
              return `🗑 delete ${p.id}`;
            case "fetchUrl":
              return `🌐 fetch ${p.url}`;
            case "run-mysql-dml":
              return `🗄 SQL playspace op`;
            default:
              return "❓ unknown";
          }
        });
        setLogLines(lines);
        setLogVisible(true);
      } catch {
        /* body wasn’t JSON – ignore */
      }

      // final refresh
      await fetchConversations();
    } catch (err) {
      antdMessage.error("Assistant error");
        console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ---------- UI ----------
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "90vh", padding: 10 }}>
      <div style={{ marginBottom: 6 }}>

<Tooltip title="Toggle between all vs [for-human] only">
  <Switch
    checked={showAll}
    onChange={(checked) => setShowAll(checked)}
    checkedChildren="Show All"
    unCheckedChildren="Only [for-human]"
  />
</Tooltip>

      </div>


<div style={{ flexGrow: 1, overflowY: "auto", background: "#fff", padding: 10, borderRadius: 8 }}>
  {messages
        .filter(m => m.role === "user" || showAll || m.content.includes("[for-human]"))

    .map((m) => (
      <p
        key={m.conversation_id}
        style={{
          background: m.role === "user" ? "#e6f7ff" : "#f6ffed",
          padding: 8,
          borderRadius: 5,
        }}
      >
        <strong>
          [{m.conversation_id}] {m.role === "user" ? "You" : "AI"}:
        </strong>{" "}
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</pre>
      </p>
    ))}
</div>


      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your reflection..."
          autoSize={{ minRows: 2, maxRows: 4 }}
          style={{ flexGrow: 1 }}
        />
        <Tooltip title="Send">
          <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={sendMessage} />
        </Tooltip>
      </div>

      <Modal title="Subreply Summary" open={logVisible} onCancel={() => setLogVisible(false)} footer={null}>
        {logLines.length ? (
          <ul>{logLines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        ) : (
          <p>No subreply actions recorded.</p>
        )}
      </Modal>
    </div>
  );
}
