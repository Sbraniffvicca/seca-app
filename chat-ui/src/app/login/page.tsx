"use client"; // Required for client-side components

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Form, Input, Button, Typography, message } from "antd";

const { Title } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

 // const onFinish = async (values: any) => {

  const onFinish = async (values: { email: string; password: string }) => {

    try {
      setLoading(true);

      const response = await fetch("api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
        credentials: "include", // ✅ Allows cookies to be set
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      message.success("Login successful!");
      
      // ✅ Redirect to main page after login
      router.push("/main");
    } catch (error) {
      console.error("❌ Login Failed:", error);
      message.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", textAlign: "center" }}>
      <Title level={2}>Login</Title>
      <Form name="login" layout="vertical" onFinish={onFinish}>
        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: "Please input your email!" },
            { type: "email", message: "Please enter a valid email!" },
          ]}
        >
          <Input placeholder="Enter your email" />
        </Form.Item>
        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: "Please input your password!" }]}
        >
          <Input.Password placeholder="Enter your password" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Login
          </Button>
        </Form.Item>
      </Form>
      <Typography.Text>
        New here? <Link href="/register">Create an account</Link>
      </Typography.Text>
    </div>
  );
}
