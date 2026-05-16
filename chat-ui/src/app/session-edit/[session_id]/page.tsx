"use client";

import { use } from "react"; // Required for use(params)
import { useRouter } from "next/navigation";
import { Form, Input, Select, Button, Spin, message } from "antd";
import { useEffect, useState } from "react";
import axios from "axios";
import { view_user_roles } from "../../repositories/interfaces"; // Adjust path as needed

const { Option } = Select;

export default function SessionEdit(props: { params: Promise<{ session_id: string }> }) {
  const { session_id } = use(props.params);

  const router = useRouter();
  const isEdit = !!session_id;

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [roleOptions, setRoleOptions] = useState<view_user_roles[]>([]);

  useEffect(() => {
    axios.get("/api/chat/user_roles")
      .then((res) => setRoleOptions(JSON.parse(res.data.message)))
      .catch(() => message.error("Failed to load user roles"));
  }, []);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      axios.get(`/api/chat/sessions/${session_id}`)
        .then((res) => form.setFieldsValue(JSON.parse(res.data.message)))
        .catch(() => message.error("Failed to load session"))
        .finally(() => setLoading(false));
    }
  }, [isEdit, session_id, form]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    const url = isEdit ? `/api/chat/sessions/${session_id}` : `/api/chat/sessions`;
    const method = isEdit ? "put" : "post";

    try {
      await axios[method](url, values);
      message.success(`Session ${isEdit ? "updated" : "created"} successfully`);
      router.push("/sessions");
    } catch {
      message.error("Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <h1>{isEdit ? "Edit Session" : "New Session"}</h1>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="session_desc"
          label="Session Description"
          rules={[{ required: true, message: "Description is required" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item name="session_type" label="Session Type">
          <Select allowClear placeholder="Select a type">
            <Option value="Industry">Industry</Option>
            <Option value="Corporation">Corporation</Option>
            <Option value="Team">Team</Option>
            <Option value="Transaction">Transaction</Option>
            <Option value="AI-Conversation">AI-Conversation</Option>
            <Option value="Misc">Misc</Option>
          </Select>
        </Form.Item>

<Form.Item name="role_id" label="Role">
  <Select allowClear placeholder="Select a role" style={{ width: '100%' }}>
    <Option value={null}>None</Option> {/* Optional visible 'None' choice */}
    {roleOptions.map((role) => (
      <Option key={role.role_id} value={role.role_id}>
        {role.role_desc}
      </Option>
    ))}
  </Select>
</Form.Item>


        <Button type="primary" htmlType="submit">
          {isEdit ? "Save Changes" : "Create Session"}
        </Button>
      </Form>
    </Spin>
  );
}
