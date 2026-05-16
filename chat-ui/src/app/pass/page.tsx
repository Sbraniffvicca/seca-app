"use client";

import { useState } from "react";
import { Form, Input, Button, message } from "antd";
import axios from "axios";
// import { useRouter } from "next/navigation";

// const { Title } = Typography;

export default function PasswordResetPage() {
  const [loading, setLoading] = useState(false);
//  const router = useRouter();

//  const onFinish = async (values: any) => {

  const onFinish = async (values: { oldPassword: string; newPassword: string }) => {

    try {
      setLoading(true);

console.log("🔍 Sending Password Reset:", values);
console.log("🔍 Checking cookies before request:", document.cookie);
await axios.put(
  "api/auth/reset-password", 
  {
    oldPassword: values.oldPassword,
    newPassword: values.newPassword,
  },
  { withCredentials: true } // <-- ✅ This is correct, but...
);



      message.success("Password changed successfully!");
  //    router.push("/login"); // Redirect to login after successful reset
    } catch (error) {
      console.error("❌ Password Reset Failed:", error);
      message.error("Password reset failed. Please check your old password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", textAlign: "center" }}>

      <Form name="reset-password" layout="vertical" onFinish={onFinish}>
        <Form.Item
          label="Old Password"
          name="oldPassword"
          rules={[{ required: true, message: "Please enter your old password!" }]}
        >
          <Input.Password placeholder="Enter old password" />
        </Form.Item>

        <Form.Item
          label="New Password"
          name="newPassword"
          rules={[{ required: true, message: "Please enter your new password!" }]}
        >
          <Input.Password placeholder="Enter new password" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Change Password
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
