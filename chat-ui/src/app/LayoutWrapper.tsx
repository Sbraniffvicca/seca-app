"use client";

import { Layout, Menu } from "antd";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
  import type { SiderProps } from "antd/es/layout/Sider";

const { Sider, Content } = Layout;

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // const sidebarProps = isMobile ? { collapsedWidth: 0, breakpoint: "md" } : {};

const sidebarProps: Partial<SiderProps> = isMobile
  ? { collapsedWidth: 0, breakpoint: "md" }
  : {};



  const menuItems = [

    { key: "/chatbot", label: "Casual Chatbot" },
    { key: "/edit", label: "Edit Conversation" },
    { key: "/ask-ai", label: "Ask AI" },
    { key: "/sessions", label: "Manage Sessions" },
    { key: "/clone", label: "Clone Session" },
    { key: "/auto", label: "Enable Local Knowledge" },
    { key: "/access-explorer", label: "Access Explorer" },
    { key: "/model", label: "Change Model" },
    { key: "/pass", label: "Password Reset" },
    { key: "/sentient", label: "Creative Sentience" }
  ];

  const onMenuClick = ({ key }: { key: string }) => {
    router.push(key);
  };

  // Exclude layout for the login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        {...sidebarProps}
        trigger={<span style={{ color: "white", fontSize: "18px" }}>{collapsed ? ">" : "<"}</span>}
        style={{
          height: "100vh",
          overflow: "auto",
        }}
      >
        <div
          style={{
            height: "64px",
            margin: "16px",
            textAlign: "center",
          }}
        >
          {/* Add your image here */}

<Image
  src="/logo3.png"
  alt="Logo"
  width={120}
  height={64}
  style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }}
  priority
/>


        </div>
        <Menu
          theme="dark"
          mode="inline"
          items={menuItems}
          onClick={onMenuClick}
          selectedKeys={[pathname]}
        />
      </Sider>

      <Layout>
        <Content
          style={{
            margin: "16px",
            padding: "16px",
            background: "#fff",
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
