"use client";

import React, { useState, useEffect } from "react";
import { Tooltip, Input, Button, message as antdMessage, Select } from "antd";
// import { PaperClipOutlined } from "@ant-design/icons";
import axios from "axios";
import { Conversations, QuickPrompts } from "../repositories/interfaces"; // adjust path if needed

const { Option, OptGroup } = Select;
import type { DefaultOptionType } from "antd/es/select";

import { CopyOutlined, FireOutlined , EyeOutlined  } from "@ant-design/icons";

const Page = () => {

const [quickPrompts, setQuickPrompts] = useState<QuickPrompts[]>([]);
const [pageCount, setPageCount] = useState("1");
const [selectedQuickPromptId, setSelectedQuickPromptId] = useState<number | null>(null);

//    const [maxReturn, setMaxReturn] = useState("3");
//  const [Confidence, setConfidence] = useState("0.75");
//  const [apiName, setApiName] = useState("Verified");
  const [llmMessage, setLlmMessage] = useState("");
//  const [response, setResponse] = useState([]);
const [response, setResponse] = useState<Partial<Conversations>[]>([]);

  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Expand LLM input box

  const [expandedEntries, setExpandedEntries] = useState<{ [key: number]: boolean }>({});

//  const [expandedEntries, setExpandedEntries] = useState({}); // Expand messages

  const fetchAllConversations = async () => {
    try {
      const res = await axios.get("/api/chat/AllConvervations", {
        withCredentials: true,
      });
      const newResponse = JSON.parse(res.data.message);
      setResponse(newResponse);
    } catch (error) {
      antdMessage.error("Failed to fetch conversations");
      console.error("Fetch Conversations Error:", error);
    }
  };

  const grouped = quickPrompts.reduce((acc: Record<string, QuickPrompts[]>, prompt) => {
  acc[prompt.category] = acc[prompt.category] || [];
  acc[prompt.category].push(prompt);
  return acc;
}, {});


  useEffect(() => {
  axios.get("/api/chat/quickprompts", { withCredentials: true })
    .then(res => {
      const rows: QuickPrompts[] = JSON.parse(res.data.message);
      rows.sort((a: QuickPrompts, b: QuickPrompts) => a.category.localeCompare(b.category));
      setQuickPrompts(rows);
      fetchAllConversations();
    })
    .catch(err => {
      antdMessage.error("Failed to load QuickPrompts");
      console.error(err);
    });
}, []);


  const handleCopy = (index: number) => {
  const text = response[index]?.content || "";
  navigator.clipboard.writeText(text).then(() => {
    antdMessage.success("Copied to clipboard");
  }).catch(() => {
    antdMessage.error("Failed to copy");
  });
};


  const handleSendLLM = async (useFullContext: boolean) => {

    if (!llmMessage.trim()) return;

    setLoading(true);
    setLlmMessage("");

      const response = await fetch("/api/chat/llmresponse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",

        body: JSON.stringify({ 
        message: llmMessage,
        full_context: useFullContext 
        }),

      });

      if (!response.ok) {
        const errorText = await response.text();
        antdMessage.error({
          content: `sendMessage Error: ${errorText}`,
          duration: 25, // in seconds
        });
         setLoading(false);
        throw new Error(errorText || "Server error");
      }

      const userMessage: Partial<Conversations> = { role: "user", content: llmMessage };

      //    const userMessage = { role: "user", content: llmMessage };
    setResponse((prevResponse) => [...prevResponse, userMessage]);

      if (!response.body) throw new Error("Empty response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let assistantContent = "";

      // First, push a new assistant message placeholder
      setResponse(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

//        const chunk = decoder.decode(value, { stream: true });
const chunk = decoder.decode(value);
console.log("🕐 received chunk at", new Date().toISOString(), ":", JSON.stringify(chunk));

        assistantContent += chunk;

        // ✅ Immutable update to trigger React render
        setResponse(prev => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;

          if (updated[lastIndex].role === "assistant") {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: assistantContent
            };
          }

          return updated;
        });
      }

      setLoading(false);
  };

  const toggleExpand = (index: number) => {
    setExpandedEntries((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (


    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "90vh",
        padding: "10px",
        backgroundColor: "#f0f2f5",
        boxSizing: "border-box",
      }}
    >

      {/* Response window */}
      <div
        style={{
          flexGrow: 1,
          overflowY: "auto",
          marginBottom: "10px",
          padding: "10px",
          border: "1px solid #d9d9d9",
          borderRadius: "4px",
          backgroundColor: "#ffffff",
        }}
      >
        {response.map((item, index) => (
        <div key={index} style={{ marginBottom: "10px", padding: "10px", backgroundColor: "#f6f8fa", borderRadius: "4px" }}>
            {item.role === "user" && (<strong>User: </strong>)}
            {item.role === "snow_kb keywords" && (<strong>ServiceNow KB Keywords: </strong>)}
            {item.role === "snow_kb data" && (<strong>ServiceNow KB data: </strong>)}
            {item.role === "snow_inc keywords" && (<strong>ServiceNow Incident Keywords: </strong>)}
            {item.role === "snow_kb data" && (<strong>ServiceNow Incident data: </strong>)}
            {item.role === "rag_bid keywords" && (<strong>Library Keywords: </strong>)}
            {item.role === "rag_data" && (<strong>Library: </strong>)}
            {item.role === "upl data" && (<strong>Upload Data: </strong>)}
            {item.role === "assistant" && (<strong>AI: </strong>)}
            {item.role === "system" && (<strong>System: </strong>)}

<Tooltip title="Copy to clipboard">
    <CopyOutlined
      onClick={() => handleCopy(index)}
      style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        cursor: "pointer",
        color: "#999",
        fontSize: "16px"
      }}
    />
  </Tooltip>

            {expandedEntries[index] ? (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {item.content}
             </pre>
            ) : (
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", display: "inline" }}>
{item.content && item.content.length > 100
  ? `${item.content.slice(0, 100)}...`
  : item.content || ""}

        </pre>
            )}

{item.content && item.content.length > 100 && (
        <Button type="link" onClick={() => toggleExpand(index)}>
          {expandedEntries[index] ? "Collapse" : "Expand"}
        </Button>
      )}


            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
               {item.role === "upl data" && item.upl_filename && (
               <div><strong>Uploaded File: </strong> {item.upl_filename}</div>
               )}
               {item.role === "rag_data" && item.rag_filename && (
               <div><strong>Filename: </strong> {item.rag_filename}</div>
               )}
               {item.role === "snow_inc data" && item.snow_sys_id && (
               <div><strong>Snow Sys ID: </strong> {item.snow_sys_id}</div>
               )}
            </div>
         </div>
         ))}
      </div>



      {/* LLM Input & Bottom Buttons */}
      <div style={{           marginBottom: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <Input.TextArea
            value={llmMessage}
            onChange={(e) => setLlmMessage(e.target.value)}
            placeholder="Enter your message"
            autoSize={{ minRows: isExpanded ? 12 : 5, maxRows: isExpanded ? 12 : 5 }}
            style={{ flexGrow: 1 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

<Tooltip title="Call the AI with the information that is visible plus any enabled knowledge session information">
<Button type="primary" onClick={() => handleSendLLM(true)} loading={loading}>
  Ask AI
</Button>
</Tooltip>


            <Button type="default" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? "Shrink" : "Expand"}
            </Button>


<div>
<Tooltip title="Visible Mode: Call the AI with only the information that is visible">
<Button icon={<EyeOutlined />} onClick={() => handleSendLLM(false)} loading={loading} />
</Tooltip>

<Tooltip title="Critique Mode: receive blunt, critical analysis of the information that is visible">
  <Button
    icon={<FireOutlined />}
    onClick={() => handleSendLLM(false)}
    loading={loading}
  />
</Tooltip>
</div>
          </div>
        </div>
      </div>



<div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
  <Select
    placeholder="QuickPrompt..."
    style={{ flexGrow: 1 }}
    onChange={(value: string, option: DefaultOptionType) => {
      if (option?.key !== undefined) {
        setSelectedQuickPromptId(Number(option.key));
      }
    }}
  >
    {Object.entries(grouped).map(([category, items]) => (
      <OptGroup key={category} label={category}>
        {items.map(item => (
          <Option key={item.quickprompt_id} value={item.prefill_text}>
            {item.label}
          </Option>
        ))}
      </OptGroup>
    ))}
  </Select>

  <span># Pages:</span>
  <Input
    value={pageCount}
    onChange={e => setPageCount(e.target.value)}
    style={{ width: "60px" }}
  />

  <Button
    type="primary"
    onClick={() => {
      const chosen = quickPrompts.find(p => p.quickprompt_id === selectedQuickPromptId);
      if (!chosen) {
        antdMessage.warning("Please select a quick prompt first.");
        return;
      }
      const final = chosen.use_page_count
        ? `${chosen.prefill_text} Also, do the reply in approximately ${pageCount} page${pageCount === "1" ? "" : "s"}.`
        : chosen.prefill_text;
      setLlmMessage(final);
    }}
    disabled={selectedQuickPromptId === null}
  >
    Quick Prompt
  </Button>
</div>




      {/* Overall close */}
    </div>
  );
};

export default Page;
