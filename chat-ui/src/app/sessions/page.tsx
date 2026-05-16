"use client";
import { useRouter } from "next/navigation";

import React, { useState, useEffect } from "react";
import { Collapse, Table, Button, Tooltip, message as antdMessage } from "antd";
import { SaveOutlined, SwapOutlined, DeleteOutlined } from "@ant-design/icons";
import axios from "axios";
import { view_sessions } from "../repositories/interfaces";
import { viewUsers as viewUsersType } from "../repositories/interfaces";

const Page = () => {
  const [sessions, setSessions] = useState<view_sessions[]>([]);
  const [viewUsers, setViewUsers] = useState<viewUsersType | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [loading] = useState(false); // Not currently used

  const router = useRouter();


  // Fetch sessions
  const fetchSessions = async () => {
    try {
      const res = await axios.get("/api/chat/SessionsByUserId", { withCredentials: true });
      const newSessions = JSON.parse(res.data.message);
      setSessions(newSessions);
    } catch (error) {
      antdMessage.error("Failed to fetch sessions");
      console.error("Fetch Sessions Error:", error);
    }
  };

  // Fetch user info (active session, etc.)
  const fetchViewUsers = async () => {
    try {
      const res = await axios.get("/api/chat/viewUsers", { withCredentials: true });
      const viewUsersData = JSON.parse(res.data.message);
      setViewUsers(viewUsersData);
    } catch (error) {
      antdMessage.error("Failed to fetch user details");
      console.error("Fetch User Details Error:", error);
    }
  };

  // Fetch token count for active session
  const fetchTokenCount = async () => {
    try {
      const res = await axios.get("/api/chat/sessionTokenCount", { withCredentials: true });
      setTokenCount(res.data.totalTokens || 0);
    } catch (error) {
      antdMessage.error("Failed to fetch token count");
      console.error("Fetch Token Count Error:", error);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchViewUsers();
    fetchTokenCount();
  }, []);

  // Delete entire session
  const handleDelete = async (sessionId: number) => {
    try {
      await axios.delete(`/api/chat/sessions/${sessionId}`, { withCredentials: true });
      antdMessage.success("Session deleted successfully");
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));

      // If deleted session was active, refresh user info
      if (viewUsers?.active_session_id === sessionId) {
        fetchViewUsers();
      }
    } catch (error) {
      antdMessage.error("Failed to delete session");
      console.error("Delete Session Error:", error);
    }
  };

  // Append another session's conversation to the active conversation
  const handleAppendToActive = async (sessionId: number) => {
    if (!viewUsers?.active_session_id) {
      antdMessage.warning("No active conversation selected. Switch first.");
      return;
    }
    if (viewUsers.active_session_id === sessionId) {
      antdMessage.warning("You cannot append a session to itself.");
      return;
    }
    try {
      await axios.put(
        "/api/chat/appendToActive",
        { session_id: sessionId },
        { withCredentials: true }
      );
      antdMessage.success("Session appended successfully");
      fetchSessions();
      fetchViewUsers();
    } catch (error) {
      antdMessage.error("Failed to append session");
      console.error("Append Session Error:", error);
    }
  };

  // Switch active session
  const handleSwitchTo = async (sessionId: number) => {
    try {
      await axios.put(
        "/api/chat/switchSession",
        { session_id: sessionId },
        { withCredentials: true }
      );
      antdMessage.success("Switched to session successfully");
      fetchSessions();
      fetchViewUsers();
    } catch (error) {
      antdMessage.error("Failed to switch session");
      console.error("Switch Session Error:", error);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Table columns
  const columns = [
    {
      title: "Conversation Name",
      dataIndex: "session_desc",
      key: "session_desc",
      width: "30%",
    },
    {
      title: "Type",
      dataIndex: "session_type",
      key: "session_type",
      width: "10%",
      render: (text: string) => text ?? "",
    },
    {
      title: "Attached to Role",
      dataIndex: "role_desc",
      key: "role_desc",
      render: (text: string) => text || "(none)",
    },
    {
      title: "Created Date",
      dataIndex: "created_dttm",
      key: "created_dttm",
      render: (text: string) => formatDate(text),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_text: string, record: view_sessions) => (
        <span>
          {/* Edit in standalone session-edit page */}
<Tooltip title="Edit session details">
  <Button onClick={() => router.push(`/session-edit/${record.session_id}`)}>
    Edit
  </Button>
</Tooltip>


          {/* Switch */}
          <Tooltip title="Switch to this conversation">
            <Button
              icon={<SwapOutlined />}
              onClick={() => record.session_id && handleSwitchTo(record.session_id)}
              style={{ marginLeft: 8 }}
            />
          </Tooltip>

          {/* Append */}
          <Tooltip title="Append this knowledge pack to your active conversation">
            <Button
              icon={<SaveOutlined />}
              onClick={() => record.session_id && handleAppendToActive(record.session_id)}
              style={{ marginLeft: 8 }}
            />
          </Tooltip>

          {/* Delete */}
          <Tooltip title="Delete the entire conversation permanently">
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              onClick={() => record.session_id && handleDelete(record.session_id)}
              style={{ marginLeft: 10 }}
            />
          </Tooltip>
        </span>
      ),
    },
  ];


    const items = [
    {
      key: "1",
      label: "Did You Know?",
      children: (
        <p>
📌 Attaching a Role Grants Access <br />
Once you have curated a session containing the documents that form your local knowledge base, you are ready to proceed.<br />
First, ensure the correct role is selected and that all assigned staff are authorized to access the sensitive data. <br /> 
When you are confident that access is appropriate, attach the session to the role. This will make the knowledge session available to those users. <br />
Reminder: You will need to email the authorized staff to let them know the session is now available for them to enable.
        </p>
      ),
    },
  ];


  return (
    <div>
        {/* "Did You Know?" Tip Section */}
      <Collapse items={items} />


      {viewUsers && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: "16px" }}>
          <p>
            <strong>Active Conversation:</strong> {viewUsers.session_desc}
          </p>
          <p>
            <strong>Tokens Used:</strong> {tokenCount} &nbsp;|&nbsp;
            <strong>Percent Full:</strong> ({tokenCount} / 128000) ={" "}
            {((tokenCount / 128000) * 100).toFixed(2)}%
          </p>
        </div>
      )}

      <Table
        dataSource={sessions}
        columns={columns}
        rowKey="session_id"
        loading={loading}
        pagination={false}
        scroll={{ y: 240 }}
        size="small"
      />

      {/* Create new session via session-edit (no session_id means 'create') */}
      <div style={{ marginTop: "16px" }}>
        <Button
          type="primary"
          onClick={() => {
            window.location.href = "/session-edit";
          }}
        >
          Start New Empty Conversation
        </Button>
      </div>
    </div>
  );
};

export default Page;
