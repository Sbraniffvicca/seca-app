"use client";

import { Button, Tooltip } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";

import React, { useEffect, useState } from "react";
import { Collapse, Table, message as antdMessage } from "antd";
import axios from "axios";
import { view_available_rolesessions, view_enabled_rolesessions } from "../repositories/interfaces";

const formatDate = (dateString: string | null) => {
  if (!dateString) return "";
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const Page = () => {
  const [availableSessions, setAvailableSessions] = useState<view_available_rolesessions[]>([]);
  const [enabledSessions, setEnabledSessions] = useState<view_enabled_rolesessions[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res1 = await axios.get("/api/chat/viewAvailableRoleSessions", { withCredentials: true });
      setAvailableSessions(JSON.parse(res1.data.message));

      const res2 = await axios.get("/api/chat/viewEnabledRoleSessions", { withCredentials: true });
      setEnabledSessions(JSON.parse(res2.data.message));
    } catch (err) {
      antdMessage.error("Failed to fetch session data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

const availableColumns = [
  { title: "Role", dataIndex: "role_desc", key: "role_desc" },
  { title: "Session Name", dataIndex: "session_desc", key: "session_desc" },
  { title: "Type", dataIndex: "session_type", key: "session_type" },
  { title: "Created", dataIndex: "session_created_dttm", key: "session_created_dttm", render: formatDate },
  {
    title: "Action",
    key: "action",
    render: (_: unknown, record: view_available_rolesessions) =>
      record.session_id !== null && (
        <Tooltip title="Enable this knowledge session for your account.">
          <Button
            icon={<PlusOutlined />}
            type="primary"
            size="small"
            onClick={() => handleAdd(record.session_id!)}
          >
            Add
          </Button>
        </Tooltip>
      ),
  },
];

const enabledColumns = [
  { title: "Role", dataIndex: "role_desc", key: "role_desc" },
  { title: "Session Name", dataIndex: "session_desc", key: "session_desc" },
  { title: "Type", dataIndex: "session_type", key: "session_type" },
  { title: "Seq", dataIndex: "seq", key: "seq" },
  { title: "Created", dataIndex: "session_created_dttm", key: "session_created_dttm", render: formatDate },
  { title: "Enabled On", dataIndex: "user_rolesession_created_dttm", key: "user_rolesession_created_dttm", render: formatDate },
  {
    title: "Action",
    key: "action",
    render: (_: unknown, record: view_enabled_rolesessions) => (
      <Tooltip title="Remove this session from your knowledge base.">
        <Button
          icon={<DeleteOutlined />}
          danger
          type="primary"
          size="small"
          onClick={() => handleRemove(record.session_id)}
        >
          Remove
        </Button>
      </Tooltip>
    ),
  },
];

    const items = [
    {
      key: "1",
      label: "Did You Know?",
      children: (
        <p>
        🧠 <strong>Understanding Conversation Types</strong> <br /><br />
        📂 <strong>Industry</strong> — Knowledge Session of Domain-wide knowledge (e.g., healthcare regulations) <br />
        🏢 <strong>Corporation</strong> — Knowledge Session of Internal policies, onboarding, FAQs <br />
        👥 <strong>Team</strong> — Knowledge Session of Squad workflows, best practices <br />
        📄 <strong>Transaction</strong> — Knowledge Session of Project- or case-specific context <br />
        🧪 <strong>Misc</strong> — Not a valid Knowledge Session - Experiments, drafts, scratchpads <br />
        💬 <strong>AI-Conversation</strong> — Not a valid Knowledge Session - 1-on-1 private AI chats <br /> <br />
        It is common to have all 4 knowledge session types enabled. Each represents a different kind of local knowledge.
        Typically, only the team-lead will create the actual knowledge sessions. Team-members will manually add them. 
        When you enable an available Knowledge Session, those curated documents will be covertly injected into all your future conversations providing the AI with your local knowledge. </p>
      ),
    },
  ];



  const handleAdd = async (session_id: number) => {
  try {
    await axios.post("/api/chat/addUserRoleSession", { session_id }, { withCredentials: true });
    antdMessage.success("Session enabled");
    fetchData();
  } catch (err) {
    antdMessage.error("Failed to enable session");
    console.error(err);
  }
};

const handleRemove = async (session_id: number) => {
  try {
    await axios.delete("/api/chat/removeUserRoleSession", {
      data: { session_id },
      withCredentials: true,
    });
    antdMessage.success("Session disabled");
    fetchData();
  } catch (err) {
    antdMessage.error("Failed to disable session");
    console.error(err);
  }
};


  return (

    <div>

          <Collapse items={items} />
          <br />
      <h3>Available Knowledge Sessions to Enable</h3>
      <Table
        dataSource={availableSessions}
        columns={availableColumns}
        rowKey={(rec) => `${rec.role_id}-${rec.session_id ?? 'null'}`}
        loading={loading}
        pagination={false}
        size="small"
        style={{ marginBottom: 32 }}
      />

      <h3>Enabled Knowledge Sessions</h3>
      <Table
        dataSource={enabledSessions}
        columns={enabledColumns}
        rowKey={(rec) => `${rec.user_id}-${rec.session_id}`}
        loading={loading}
        pagination={false}
        size="small"
      />
    </div>
  );
};

export default Page;
