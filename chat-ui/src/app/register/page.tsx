"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Form, Input, Typography, message } from "antd";

const { Title } = Typography;

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: {
    email: string;
    password: string;
    first_nm?: string;
    last_nm?: string;
  }) => {
    try {
      setLoading(true);
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          first_nm: values.first_nm,
          last_nm: values.last_nm,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Registration failed");
      }

      message.success("Account created.");
      router.push("/sentient");
    } catch (error) {
      console.error("Registration failed:", error);
      message.error(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center" }}>
      <Title level={2}>Create Account</Title>
      <Form name="register" layout="vertical" onFinish={onFinish}>
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
          rules={[
            { required: true, message: "Please input your password!" },
            { min: 8, message: "Password must be at least 8 characters." },
          ]}
        >
          <Input.Password placeholder="Create a password" />
        </Form.Item>

        <Form.Item label="First name" name="first_nm">
          <Input placeholder="Optional" />
        </Form.Item>

        <Form.Item label="Last name" name="last_nm">
          <Input placeholder="Optional" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Create account
          </Button>
        </Form.Item>
      </Form>
      <Typography.Text>
        Already have an account? <Link href="/login">Log in</Link>
      </Typography.Text>
    </div>
  );
}
