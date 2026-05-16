"use client";

import React, { useState, useEffect } from "react";
import { Table, Button, Tooltip, message as antdMessage, Collapse } from "antd";
import axios from "axios";
import { viewUsers } from "../repositories/interfaces"; // adjust path if needed

const Page = () => {
//  const [users, setUsers] = useState([]);
const [users, setUsers] = useState<viewUsers[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSessionDesc, setActiveSessionDesc] = useState("");

  // Fetch the active user session
  const fetchActiveUser = async () => {
    try {
      const res = await axios.get("/api/chat/viewUsers", {
        withCredentials: true,
      });
      if (res.data && res.data.message) {
        const activeUser = JSON.parse(res.data.message);
        setActiveSessionDesc(activeUser.session_desc || "");
      }
    } catch (error) {
      antdMessage.error("Failed to fetch active session");
      console.error("Fetch Active Session Error:", error);
    }
  };

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/chat/getAllUsers", {
        withCredentials: true,
      });
      let usersData = [];

      if (res.data && res.data.message) {
        try {
          usersData = JSON.parse(res.data.message);
          if (!Array.isArray(usersData)) {
            console.error("API response is not an array:", usersData);
            usersData = [];
          }
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          usersData = [];
        }
      }

      setUsers(usersData);
    } catch (error) {
      antdMessage.error("Failed to fetch users");
      console.error("Fetch Users Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveUser();
    fetchUsers();
  }, []);

//  const handleCloneConversation = async (userId) => {

  const handleCloneConversation = async (userId: number) => {
    try {
      await axios.post("/api/chat/cloneConversation", {
        user_id: userId,
      }, {
        withCredentials: true,
      });
      antdMessage.success("Conversation cloned successfully");
    } catch (error) {
      antdMessage.error("Failed to clone conversation");
      console.error("Clone Conversation Error:", error);
    }
  };

  const columns = [
    {
      title: "First Name",
      dataIndex: "first_nm",
      key: "first_nm",
    },
    {
      title: "Last Name",
      dataIndex: "last_nm",
      key: "last_nm",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Actions",
      key: "actions",
//      render: (text, record) => (
    render: (_text: string, record: viewUsers) => (
        <Tooltip title="Clone active session">
          <Button type="primary" onClick={() => handleCloneConversation(record.user_id!)}>
            Clone to this recipient
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
📌 <strong> Cloning a Conversation for a Peer </strong> <br /><br />
Cloning lets a peer explore your AI conversation independently.<br />
There is no link between your version and theirs after the clone is created. <br /> 
Use this for ad-hoc peer review or one-off reuse. <br />
If your goal is to build shared, curated team knowledge, do not clone — instead, attach your session to a role to enable shared access. <br />
        </p>
      ),
    },
  ];

  return (
    <div>
      {/* "Did You Know?" Tip Section */}
      <Collapse items={items} />

      {activeSessionDesc && (
        <div style={{ marginBottom: 16, marginTop: 16 }}>
          <strong>Active Conversation:</strong> {activeSessionDesc}
        </div>
      )}

      <Table
        dataSource={users}
        columns={columns}
        rowKey="user_id"
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ y: 400 }}
      />
    </div>
  );
};

export default Page;