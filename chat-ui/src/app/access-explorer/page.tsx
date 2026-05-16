"use client";

import React, { useEffect, useState } from "react";
import { Tabs, Collapse, Table, message } from "antd";
import axios from "axios";
import {
  viewUsers,
  view_user_roles,
  view_available_rolesessions,
  view_enabled_rolesessions,
} from "../repositories/interfaces";

//const { Title } = Typography;

const AccessExplorer = () => {
  const [viewUser, setViewUser] = useState<viewUsers | null>(null);
  const [allRoles, setAllRoles] = useState<view_user_roles[]>([]);
  const [allSessions, setAllSessions] = useState<view_available_rolesessions[]>([]);
  const [userRoles, setUserRoles] = useState<view_user_roles[]>([]);
  const [enabledSessions, setEnabledSessions] = useState<view_enabled_rolesessions[]>([]);

  const fetchAll = async () => {
    try {
      const [vu, ar, as, ur, es] = await Promise.all([
        axios.get("/api/chat/viewUsers", { withCredentials: true }),
        axios.get("/api/chat/allRoles", { withCredentials: true }),
        axios.get("/api/chat/allRoleSessions", { withCredentials: true }),
        axios.get("/api/chat/user_roles", { withCredentials: true }),
        axios.get("/api/chat/viewEnabledRoleSessions", { withCredentials: true }),
      ]);

      setViewUser(JSON.parse(vu.data.message) as viewUsers);
      setAllRoles(JSON.parse(ar.data.message) as view_user_roles[]);
      setAllSessions(JSON.parse(as.data.message) as view_available_rolesessions[]);
      setUserRoles(JSON.parse(ur.data.message) as view_user_roles[]);
      setEnabledSessions(JSON.parse(es.data.message) as view_enabled_rolesessions[]);
    } catch (err) {
      console.error("❌ Error loading Access Explorer data", err);
      message.error("Failed to load Access Explorer data");
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const tip = [
    {
      key: "1",
      label: "Did You Know?",
      children: (
        <p>
          This screen helps you <strong>understand access</strong>—including all roles and knowledge sessions
          available in the system and which knowledge sessions you currently have enabled.
          <br /><br />
          <strong>Tab Explanations:</strong><br />
          • All Roles = defined in the system, not necessarily assigned to you.<br />
          • All Knowledge Sessions = every session across all roles.<br />
          • Your Roles = roles you’ve been granted.<br />
          • Your Enabled Sessions = subset of all sessions you’ve manually enabled.
        </p>
      ),
    },
  ];

  const columns = {
    viewUsers: [
      { title: "User ID", dataIndex: "user_id" },
      { title: "Email", dataIndex: "email" },
      { title: "First Name", dataIndex: "first_nm" },
      { title: "Last Name", dataIndex: "last_nm" },
      { title: "Phone", dataIndex: "phone" },
      { title: "Postal Code", dataIndex: "postal_cd" },
      { title: "Active Session ID", dataIndex: "active_session_id" },
      { title: "Active Model", dataIndex: "active_model" },
      { title: "Session Description", dataIndex: "session_desc" },
    ],
    allRoles: [
      { title: "Role ID", dataIndex: "role_id" },
      { title: "Role Description", dataIndex: "role_desc" },
    ],
    allSessions: [
      { title: "Session ID", dataIndex: "session_id" },
      { title: "Description", dataIndex: "session_desc" },
      { title: "Type", dataIndex: "session_type" },
      { title: "Role ID", dataIndex: "role_id" },
      { title: "Role Desc", dataIndex: "role_desc" },
    ],
    userRoles: [
      { title: "User Role ID", dataIndex: "user_role_id" },
      { title: "Role ID", dataIndex: "role_id" },
      { title: "Role Desc", dataIndex: "role_desc" },
      { title: "Email", dataIndex: "email" },
    ],
    enabledSessions: [
      { title: "Session ID", dataIndex: "session_id" },
      { title: "Description", dataIndex: "session_desc" },
      { title: "Type", dataIndex: "session_type" },
      { title: "Role ID", dataIndex: "role_id" },
      { title: "Role Desc", dataIndex: "role_desc" },
    ],
  };

  const tabItems = [
    {
      key: "1",
      label: "1. Your User Record",
      children: (
        <Table
          rowKey="user_id"
          columns={columns.viewUsers}
          dataSource={viewUser ? [viewUser] : []}
          pagination={false}
        />
      ),
    },
    {
      key: "2",
      label: "2. All Roles",
      children: (
        <Table
          rowKey="role_id"
          columns={columns.allRoles}
          dataSource={allRoles}
          pagination={false}
        />
      ),
    },
    {
      key: "3",
      label: "3. All Knowledge Sessions",
      children: (
        <Table
          rowKey="session_id"
          columns={columns.allSessions}
          dataSource={allSessions}
          pagination={false}
        />
      ),
    },
    {
      key: "4",
      label: "4. Your Roles",
      children: (
        <Table
          rowKey="user_role_id"
          columns={columns.userRoles}
          dataSource={userRoles}
          pagination={false}
        />
      ),
    },
    {
      key: "5",
      label: "5. Your Enabled Knowledge Sessions",
      children: (
        <Table
          rowKey="session_id"
          columns={columns.enabledSessions}
          dataSource={enabledSessions}
          pagination={false}
        />
      ),
    },
  ];

  return (
    <div >
      <Collapse items={tip} />
      <br />
      
      <div style={{marginBottom: "16px" }}>
  <h3><strong> Access Explorer </strong></h3>
</div>

      <Tabs defaultActiveKey="1" items={tabItems} style={{ marginTop: "24px" }} />
    </div>
  );
};

export default AccessExplorer;
