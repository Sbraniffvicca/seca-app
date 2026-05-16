"use client";

import React, { useRef, useState, useEffect } from "react";
import { Slider, Input, Button, message as antdMessage, Select, Tooltip } from "antd";
import { PaperClipOutlined, DeleteOutlined } from "@ant-design/icons";
import axios from "axios";
import { AxiosError } from "axios";

import { Conversations } from "../repositories/interfaces"; // adjust the path if needed


const { Option } = Select;

const Page = () => {

const fileInputRef = useRef<HTMLInputElement>(null);


  const [apiKeywords, setApiKeywords] = useState("");
  const [maxReturn, setMaxReturn] = useState("3");
  const [Confidence, setConfidence] = useState("0.75");
  const [apiName, setApiName] = useState("Verified");
const [response, setResponse] = useState<Conversations[]>([]);
//  const [expandedEntries, setExpandedEntries] = useState({}); // Expand messages

const [expandedEntries, setExpandedEntries] = useState<Record<number, boolean>>({});



  const fetchAllConversations = async () => {
    try {
      const res = await axios.get("/api/chat/getRemovedConvervations", {
        withCredentials: true,
      });
      const newResponse = JSON.parse(res.data.message);
      setResponse(newResponse);
    } catch (error) {
      antdMessage.error("Failed to fetch conversations");
      console.error("Fetch Conversations Error:", error);
    }
  };



  useEffect(() => {
    fetchAllConversations();
  }, []);




  const handleDelete = async (index: number) => {

    const conversation_id = response[index].conversation_id;
    try {
await axios.delete(`/api/chat/conversations/${conversation_id}`, {
        withCredentials: true,
      });
      antdMessage.success("Conversation record deleted successfully");

    // ✅ Remove the item from the response list immediately
    setResponse((prevResponse) => prevResponse.filter((_, i) => i !== index));

    } catch (error) {
      antdMessage.error("Failed to delete conversation record");
      console.error("Delete Conversation Records Error:", error);
    }
  };




  const handleInject = async () => {
    try {
      const res = await axios.post(
        "/api/chat/injectAPI",
        {
          api_name: apiName,
          api_keywords: apiKeywords,
          max_return: maxReturn, // ✅ Add maxReturn to the API request
          confidence: Confidence,
        },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );
      const newResponse = JSON.parse(res.data.message)

const hasRagRecords = newResponse.some((c: Conversations) => c.role === "rag_data");
if (!hasRagRecords) {
  antdMessage.warning("No relevant RAG results were found. Only keyword matches were returned.");
} else {
  antdMessage.success("Injected successfully");
}

setResponse(prevResponse => [...prevResponse, ...newResponse]);

    } catch (error) {
      antdMessage.error("Failed to inject");
      console.error("Inject Error:", error);
    }
  };




const handleRemovedFlagChange = async (index: number, value: number) => {
  const conversationId = response[index].conversation_id;
  const removeFlag = value === 1 ? "IN" : "OUT";

  try {
    await axios.put(
      "/api/chat/doRemoveFlag",
      { conversation_id: conversationId, removed_flag: removeFlag },
      { withCredentials: true }
    );
    antdMessage.success("Remove flag updated successfully");
    setResponse((prevResponse) => {
      const updatedResponse = [...prevResponse];
      updatedResponse[index].removed_flag = removeFlag;
      return updatedResponse;
    });
  } catch (error) {
    antdMessage.error("Failed to update remove flag");
    console.error("Remove Flag Error:", error);
  }
};


const handlePaperclip = async (files: File[]) => {
  try {
    await axios.post("/api/chat/ensureSystemMessage", null, {
      withCredentials: true,
    });

    for (const file of files) {

    console.log("Uploading file:", file.name, "Size:", file.size, "Type:", file.type);

      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(
        "/api/chat/injectUpload",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        }
      );

      antdMessage.success(`Uploaded: ${file.name}`);
      const newResponse = JSON.parse(res.data.message);
      setResponse((prev) => [...prev, ...newResponse]);
    }

    // ✅ Reload everything to include system record
await fetchAllConversations();

/*
  } catch (error) {
    antdMessage.error("Upload failed");
    console.error("Upload Error:", error);
  }
  */
} catch (error: unknown) {
  const axiosError = error as AxiosError<{ message: string }>;
  const msg =
    axiosError.response?.data?.message ||
    axiosError.message ||
    "Unknown upload error";

  antdMessage.error(`Upload failed: ${msg}`);
  console.error("Upload Error:", axiosError);
}





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
            {expandedEntries[index] ? (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {item.content}
             </pre>
            ) : (
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", display: "inline" }}>
          {item.content.length > 100 ? `${item.content.slice(0, 100)}...` : item.content}
        </pre>
            )}

      {item.content.length > 100 && (
        <Button type="link" onClick={() => toggleExpand(index)}>
          {expandedEntries[index] ? "Collapse" : "Expand"}
        </Button>
      )}

<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
  <Slider
    min={0}
    max={1}
    step={1}
    value={item.removed_flag === "IN" ? 1 : 0}
    onChange={(value) => handleRemovedFlagChange(index, value)}
    marks={{ 0: "OUT", 1: "IN" }}
    style={{ width: "100px" }}
  />

<Tooltip title="Delete the record permanently">
<Button type="primary" danger icon={<DeleteOutlined />} onClick={() => handleDelete(index)} style={{ marginLeft: "20px" }} />

</Tooltip>
               <strong>Token Count: </strong> {item.token_count}
                                            <strong>Date: </strong> {item.created_dttm}

</div>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
               {item.role === "upl data" && item.upl_filename && (
               <div><strong>Uploaded File: </strong> {item.upl_filename}</div>
               )}
               {item.role === "rag_data" && item.rag_filename && (
               <div><strong>Filename: </strong> {item.rag_filename}</div>
               )}
               {item.role === "rag_data" && item.rag_chunk_id !== undefined && (
               <div><strong>Chunk ID: </strong> {item.rag_chunk_id}</div>
               )}
               {item.role === "rag_data" && item.rag_tags !== undefined && (
               <div><strong>Tags: </strong> {item.rag_tags}</div>
               )}
               {item.role === "snow_inc data" && item.snow_sys_id && (
               <div><strong>Snow Sys ID: </strong> {item.snow_sys_id}</div>
               )}
 
</div>



          </div>
        ))}
      </div>

      {/* API Selection & Inject Button */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <Select value={apiName} onChange={setApiName} style={{ width: "200px" }}>
          <Option value="Verified">Verified</Option>
          <Option value="Unverified">Unverified</Option>
        </Select>
        <Input value={apiKeywords} onChange={(e) => setApiKeywords(e.target.value)} placeholder="Enter Keywords" style={{ flexGrow: 1 }} />

  <span>Max Return</span>
  <Input 
    value={maxReturn} 
    onChange={(e) => setMaxReturn(e.target.value)} 
    placeholder="Enter" 
    style={{ width: "80px" }} // ✅ Set a fixed width
  />
 
    <span>Confidence Score</span>
  <Input 
    value={Confidence} 
    onChange={(e) => setConfidence(e.target.value)} 
    placeholder="Enter" 
    style={{ width: "100px" }} // ✅ Set a fixed width
  />

     <Button type="primary" onClick={handleInject}
  disabled={!maxReturn.trim()}
>
          Library Search
        </Button>


<Button
  type="primary"
  icon={<PaperClipOutlined />}
  onClick={() => fileInputRef.current?.click()}
>
  Attach Files
</Button>

<input
  type="file"
  multiple
  ref={fileInputRef}
  style={{ display: "none" }}
  onChange={(e) => {
    const files = Array.from(e.target.files ?? []);

    if (files.length > 0) {
      handlePaperclip(files);
    }
    e.target.value = ""; // reset input so same file can be uploaded again
  }}
/>




      </div>

    </div>
  );
};

export default Page;
