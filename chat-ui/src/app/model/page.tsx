"use client";

import React, { useState, useEffect } from "react";
import { Select, Button, message, Form, Collapse } from "antd";
import axios from "axios";

const { Option } = Select;

const ManageAccount = () => {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
//  const [viewUsers, setViewUsers] = useState<any>(null);   remove this and replace w below though its not type safe
  const [viewUsers, setViewUsers] = useState({});

  const fetchViewUsers = async () => {
    try {
      const res = await axios.get("/api/chat/viewUsers", {
        withCredentials: true,
      });

      // Debug: Log response
      console.log("🔍 API Response:", res.data);

      const userData = JSON.parse(res.data.message);
      setViewUsers(userData);

      if (userData?.active_model) {
        console.log("✅ Setting active model:", userData.active_model);
        setActiveModel(userData.active_model);
        setSelectedModel(userData.active_model); // Default dropdown to current value
      } else {
        console.warn("⚠️ active_model is missing from user data:", userData);
      }
    } catch (error) {
      message.error("Failed to fetch user details");
      console.error("❌ Fetch User Details Error:", error);
    }
  };

  useEffect(() => {
    fetchViewUsers();
  }, []);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
  };

  const handleUpdateModel = async () => {
    if (!selectedModel) {
      message.warning("Please select a model.");
      return;
    }

    try {
      setLoading(true);
      await axios.put(
        "/api/chat/updateUserSettings",
        { active_model: selectedModel },
        { withCredentials: true }
      );

      message.success("Model updated successfully!");
      fetchViewUsers(); // ✅ Refresh the user data after update
    } catch (error) {
      message.error("Failed to update model");
      console.error("❌ Update Model Error:", error);
    } finally {
      setLoading(false);
    }
  };


  const items = [
    {
      key: "1",
      label: "Did You Know?",
      children: (
        <p>
<strong> If your conversation is sensitive only use the local model, never use the cloud.</strong><br />
<br />
This app is currently configured to use OpenAI GPT-5.4 mini for cloud responses. OpenAI API usage is paid.<br />
        </p>
      ),
    },
  ];

  return (
    <div>
      {/* "Did You Know?" Tip Section */}
      <Collapse items={items} />

    <div style={{ maxWidth: 400, margin: "50px auto", textAlign: "center" }}>



      {/* Display Active Model */}
      <p><strong>Active Model:</strong> {activeModel ? activeModel : "Fetching..."}</p>

      {/* Model Selection */}
      <Form.Item label="Change to">
        <Select
          value={selectedModel}
          onChange={handleModelChange}
          placeholder="Select a model"
          style={{ width: "100%" }}
          loading={!viewUsers} // Disable until data is loaded
        >
          <Option value="openai_4_mini">OpenAI GPT-5.4 Mini</Option>
        </Select>
      </Form.Item>

      <Button type="primary" onClick={handleUpdateModel} loading={loading}>
        Save Model Selection
      </Button>
    </div>
        </div>
  );
};

export default ManageAccount;
