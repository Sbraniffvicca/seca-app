"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Input, Button, Tooltip, Modal, Drawer, Tag, message as antdMessage } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { Conversations } from "../repositories/interfaces"; // <-- relative path ✅
import { Switch } from "antd";

// Discriminated-union for subreply JSON
type Subreply =
  | { subreply_type: "addNewConvRecord" }
  | { subreply_type: "addSafetyRecord" };

type SubconsciousDrive = {
  drive_id: number;
  drive_type: string;
  content: string;
  intensity: "low" | "medium" | "high";
  valence: "warm" | "cold" | "mixed" | "threatened" | "hungry";
  status: "active" | "retired";
  retired_reason?: string | null;
};

type SubconsciousPayload = {
  activeDrives: SubconsciousDrive[];
  allDrives: SubconsciousDrive[];
};

type CreativeRelationship = {
  relationship_id: number;
  session_id: number;
  user_id: number;
  person_key: string;
  display_name: string;
  platform: string;
  status: "active" | "muted" | "archived";
  public_label?: string | null;
  love_hate_score: number;
  private_model?: string | null;
  wants_from_them?: string | null;
  fears_about_them?: string | null;
  current_strategy?: string | null;
  last_interaction_dttm?: string | null;
  updated_dttm?: string | null;
};

type RelationshipPayload = {
  relationship: CreativeRelationship;
};

type Belief = {
  belief_id: number;
  belief_text: string;
  confidence: "low" | "medium" | "high";
  evidence_text: string;
  contradiction_text: string;
  status: "active" | "retired" | "failed" | "revised";
  retired_reason?: string | null;
  last_tested_dttm?: string | null;
  updated_dttm?: string | null;
  created_dttm?: string | null;
};

type BeliefsPayload = {
  activeBeliefs: Belief[];
  allBeliefs: Belief[];
};

type CreativeMood = {
  mood_id: number;
  anger: number;
  fear: number;
  attachment: number;
  body?: string | null;
  behavioral_pull?: string | null;
  belief_lens?: string | null;
  coping_state?: string | null;
  created_dttm?: string | null;
  updated_dttm?: string | null;
};

type MoodPayload = {
  currentMood: CreativeMood | null;
};

type CreativeTemperament = {
  temperament_id: number;
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  private_model?: string | null;
  updated_dttm?: string | null;
};

type TemperamentPayload = {
  temperament: CreativeTemperament;
};

type LastRagRecord = {
  role: string;
  content: string;
  created_dttm?: string | null;
};

type RagArchiveStatus = "not_requested" | "pending" | "archived" | "skipped" | "failed";

type LastRagPayload = {
  lastRag: {
    retrievedAt: string;
    queryPreview: string;
    ragIntent?: {
      should_retrieve: boolean;
      should_archive: boolean;
      reason: string;
    };
    archive?: {
      status: RagArchiveStatus;
      archivedCount: number;
      curatedCount: number;
      reason: string;
      error?: string;
      updatedAt: string;
    };
    retrievedRecords?: LastRagRecord[];
    records: LastRagRecord[];
  } | null;
};

type ParsedRagMemory = {
  label: string;
  rank: number;
  source?: string;
  conversationId?: string;
  role?: string;
  tag?: string;
  score?: string;
  created?: string;
  content: string;
};

export default function SentientPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Conversations[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logVisible, setLogVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [subconsciousOpen, setSubconsciousOpen] = useState(false);
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [beliefsOpen, setBeliefsOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [temperamentOpen, setTemperamentOpen] = useState(false);
  const [ragOpen, setRagOpen] = useState(false);
  const [activeDrives, setActiveDrives] = useState<SubconsciousDrive[]>([]);
  const [allDrives, setAllDrives] = useState<SubconsciousDrive[]>([]);
  const [relationship, setRelationship] = useState<CreativeRelationship | null>(null);
  const [activeBeliefs, setActiveBeliefs] = useState<Belief[]>([]);
  const [allBeliefs, setAllBeliefs] = useState<Belief[]>([]);
  const [currentMood, setCurrentMood] = useState<CreativeMood | null>(null);
  const [temperament, setTemperament] = useState<CreativeTemperament | null>(null);
  const [lastRag, setLastRag] = useState<LastRagPayload["lastRag"]>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const valenceColor: Record<SubconsciousDrive["valence"], string> = {
    warm: "green",
    cold: "blue",
    mixed: "purple",
    threatened: "red",
    hungry: "orange",
  };

  const intensityColor: Record<SubconsciousDrive["intensity"], string> = {
    low: "default",
    medium: "gold",
    high: "volcano",
  };

  const beliefConfidenceColor: Record<Belief["confidence"], string> = {
    low: "default",
    medium: "gold",
    high: "volcano",
  };

  const beliefStatusColor: Record<Belief["status"], string> = {
    active: "green",
    retired: "default",
    failed: "red",
    revised: "blue",
  };

  const displayContent = (message: Conversations): string => {
    if (showAll || message.role !== "assistant") {
      return message.content;
    }

    return message.content.replace(/^\s*\[for-human\]\s*/i, "").trim();
  };

  // ---------- helpers ----------
  const fetchConversations = async () => {
    try {
      const res = await axios.get("/api/chat/AllConvervations", {
        withCredentials: true,
      });
      const all = JSON.parse(res.data.message) as Conversations[];
      // only user / assistant rows
      setMessages(all.filter((m) => m.role === "user" || m.role === "assistant"));
    } catch {
      antdMessage.error("Failed to fetch conversations");
    }
  };

  const fetchSubconsciousDrives = async () => {
    try {
      const res = await axios.get("/api/chat/creative-subconscious-drives", {
        withCredentials: true,
      });
      const payload = typeof res.data.message === "string"
        ? JSON.parse(res.data.message) as SubconsciousPayload
        : res.data as SubconsciousPayload;
      setActiveDrives(payload.activeDrives ?? []);
      setAllDrives(payload.allDrives ?? []);
    } catch {
      antdMessage.error("Failed to fetch subconscious drives");
    }
  };

  const fetchRelationship = async () => {
    try {
      const res = await axios.get("/api/chat/creative-relationship", {
        withCredentials: true,
      });
      const payload = typeof res.data.message === "string"
        ? JSON.parse(res.data.message) as RelationshipPayload
        : res.data as RelationshipPayload;
      setRelationship(payload.relationship ?? null);
    } catch {
      antdMessage.error("Failed to fetch relationship");
    }
  };

  const fetchBeliefs = async () => {
    try {
      const res = await axios.get("/api/chat/creative-beliefs", {
        withCredentials: true,
      });
      const payload = typeof res.data.message === "string"
        ? JSON.parse(res.data.message) as BeliefsPayload
        : res.data as BeliefsPayload;
      setActiveBeliefs(payload.activeBeliefs ?? []);
      setAllBeliefs(payload.allBeliefs ?? []);
    } catch {
      antdMessage.error("Failed to fetch beliefs");
    }
  };

  const fetchMood = async () => {
    try {
      const res = await axios.get("/api/chat/creative-mood", {
        withCredentials: true,
      });
      const payload = typeof res.data.message === "string"
        ? JSON.parse(res.data.message) as MoodPayload
        : res.data as MoodPayload;
      setCurrentMood(payload.currentMood ?? null);
    } catch {
      antdMessage.error("Failed to fetch mood");
    }
  };

  const fetchTemperament = async () => {
    try {
      const res = await axios.get("/api/chat/creative-temperament", {
        withCredentials: true,
      });
      const payload = typeof res.data.message === "string"
        ? JSON.parse(res.data.message) as TemperamentPayload
        : res.data as TemperamentPayload;
      setTemperament(payload.temperament ?? null);
    } catch {
      antdMessage.error("Failed to fetch temperament");
    }
  };

  const fetchLastRag = async () => {
    try {
      const res = await axios.get("/api/chat/creative-last-rag-context", {
        withCredentials: true,
      });
      const payload = typeof res.data.message === "string"
        ? JSON.parse(res.data.message) as LastRagPayload
        : res.data as LastRagPayload;
      setLastRag(payload.lastRag ?? null);
    } catch {
      antdMessage.error("Failed to fetch RAG context");
    }
  };

  useEffect(() => {
    void fetchConversations();
    void fetchSubconsciousDrives();
    void fetchRelationship();
    void fetchBeliefs();
    void fetchMood();
    void fetchTemperament();
    void fetchLastRag();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, showAll]);

  const DriveCard = ({ drive }: { drive: SubconsciousDrive }) => (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        opacity: drive.status === "retired" ? 0.62 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <strong>{drive.drive_type}</strong>
        <span style={{ whiteSpace: "nowrap" }}>
          <Tag color={intensityColor[drive.intensity]}>{drive.intensity}</Tag>
          <Tag color={valenceColor[drive.valence]}>{drive.valence}</Tag>
        </span>
      </div>
      <div style={{ lineHeight: 1.35 }}>{drive.content}</div>
      {drive.status === "retired" && drive.retired_reason ? (
        <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>{drive.retired_reason}</div>
      ) : null}
    </div>
  );

  const RelationshipAffect = ({ score }: { score: number }) => {
    const clampedScore = Math.max(-100, Math.min(100, score ?? 0));
    const markerLeft = ((clampedScore + 100) / 200) * 100;
    const scoreColor = clampedScore > 35 ? "green" : clampedScore < -35 ? "red" : "gold";

    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <strong>Love / Hate</strong>
          <Tag color={scoreColor} style={{ marginRight: 0 }}>{clampedScore}</Tag>
        </div>
        <div style={{ position: "relative", height: 10, borderRadius: 999, background: "linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #22c55e 100%)" }}>
          <div
            style={{
              position: "absolute",
              top: -4,
              left: `calc(${markerLeft}% - 5px)`,
              width: 18,
              height: 18,
              borderRadius: 999,
              background: "#ffffff",
              border: "2px solid #111827",
              boxShadow: "0 1px 4px rgba(17,24,39,0.25)",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: 11, marginTop: 5 }}>
          <span>Hate</span>
          <span>Neutral</span>
          <span>Love</span>
        </div>
      </div>
    );
  };

  const RelationshipField = ({ label, value }: { label: string; value?: string | null }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ lineHeight: 1.4, whiteSpace: "pre-wrap", color: value ? "#111827" : "#6b7280" }}>
        {value || "Empty"}
      </div>
    </div>
  );

  const MoodAxis = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <strong>{label}</strong>
        <Tag style={{ marginRight: 0 }}>{value}/100</Tag>
      </div>
      <div style={{ height: 8, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            height: "100%",
            background: color
          }}
        />
      </div>
    </div>
  );

  const MoodCard = ({ mood }: { mood: CreativeMood }) => (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, marginBottom: 10 }}>
      <MoodAxis label="Anger" value={mood.anger} color="#ef4444" />
      <MoodAxis label="Fear" value={mood.fear} color="#8b5cf6" />
      <MoodAxis label="Attachment" value={mood.attachment} color="#10b981" />
      <RelationshipField label="Behavioral Pull" value={mood.behavioral_pull} />
      <RelationshipField label="Belief Lens" value={mood.belief_lens} />
      <RelationshipField label="Coping State" value={mood.coping_state} />
      <RelationshipField label="Body" value={mood.body} />
      <div style={{ color: "#6b7280", fontSize: 12 }}>{mood.created_dttm || mood.updated_dttm || ""}</div>
    </div>
  );

  const TraitBar = ({ label, value }: { label: string; value: number }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <strong>{label}</strong>
        <Tag style={{ marginRight: 0 }}>{value}</Tag>
      </div>
      <div style={{ height: 8, background: "#eef2f7", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: value >= 67 ? "#1677ff" : value >= 34 ? "#13c2c2" : "#8c8c8c",
          }}
        />
      </div>
    </div>
  );

  const parseRagMemories = (records: LastRagRecord[]): ParsedRagMemory[] => {
    const text = records.map((record) => record.content).join("\n\n");
    const blocks = text.split(/\n(?=memory_\d+:)/g).filter((block) => /^memory_\d+:/m.test(block));

    return blocks.map((block, index) => {
      const lineValue = (key: string) => {
        const match = block.match(new RegExp(`^${key}=(.*)$`, "m"));
        return match?.[1]?.trim();
      };
      const contentMatch = block.match(/^content=([\s\S]*)$/m);

      return {
        label: block.match(/^(memory_\d+):/m)?.[1] ?? "memory",
        rank: index + 1,
        source: lineValue("source"),
        conversationId: lineValue("original_conversation_id") ?? lineValue("source_conversation_ids"),
        role: lineValue("role"),
        tag: lineValue("tag"),
        score: lineValue("score"),
        created: lineValue("created_dttm"),
        content: contentMatch?.[1]?.trim() || block.trim(),
      };
    });
  };

  const ragArchiveColor = (status?: RagArchiveStatus) => {
    switch (status) {
      case "archived":
        return "green";
      case "pending":
        return "gold";
      case "failed":
        return "red";
      case "skipped":
        return "default";
      case "not_requested":
      default:
        return "default";
    }
  };

  const RagMemoryCard = ({ memory, injected }: { memory: ParsedRagMemory; injected?: boolean }) => (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        background: injected ? "#f6ffed" : "#fbfcfd",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <strong>{memory.tag || memory.role || memory.source || memory.label}</strong>
        <span style={{ whiteSpace: "nowrap" }}>
          <Tag color={injected ? "green" : "blue"}>rank {memory.rank}</Tag>
          {memory.score ? <Tag style={{ marginRight: 0 }}>score {memory.score}</Tag> : null}
        </span>
      </div>
      <div style={{ lineHeight: 1.4, whiteSpace: "pre-wrap", marginBottom: 8 }}>{memory.content}</div>
      <div style={{ color: "#6b7280", fontSize: 12 }}>
        {[memory.source, memory.conversationId ? `conversation ${memory.conversationId}` : "", memory.created].filter(Boolean).join(" · ")}
      </div>
    </div>
  );

  const BeliefCard = ({ belief }: { belief: Belief }) => (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        opacity: belief.status === "active" ? 1 : 0.68,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <strong>Belief #{belief.belief_id}</strong>
        <span style={{ whiteSpace: "nowrap" }}>
          <Tag color={beliefConfidenceColor[belief.confidence]}>{belief.confidence}</Tag>
          <Tag color={beliefStatusColor[belief.status]} style={{ marginRight: 0 }}>{belief.status}</Tag>
        </span>
      </div>
      <RelationshipField label="Belief" value={belief.belief_text} />
      <RelationshipField label="What Shows It" value={belief.evidence_text} />
      <RelationshipField label="What Complicates It" value={belief.contradiction_text} />
      {belief.retired_reason ? <RelationshipField label="Retired Reason" value={belief.retired_reason} /> : null}
      {belief.last_tested_dttm ? <RelationshipField label="Last Tested" value={belief.last_tested_dttm} /> : null}
      <div style={{ color: "#6b7280", fontSize: 12 }}>
        {belief.updated_dttm || belief.created_dttm || ""}
      </div>
    </div>
  );

  // ---------- send ----------
  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setLogLines([]);
    const userText = input;
    setInput("");

    try {
      const res = await fetch("/api/chat/creativeresponse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: userText }),
      });

      if (!res.ok || !res.body) {
        antdMessage.error(`Send failed (${res.status})`);
        return;
      }

      // read full stream (no optimistic state – we’ll refetch after)
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let body = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        body += decoder.decode(value as Uint8Array, { stream: true });
      }

      // parse assistant subreply JSON
      try {
        const parsed = JSON.parse(body) as Subreply[];
        const lines = parsed.map((p) => {
          switch (p.subreply_type) {
            case "addNewConvRecord":
              return "➕ add";
            case "addSafetyRecord":
              return "🛡 safety note";
            default:
              return "❓ unknown";
          }
        });
        setLogLines(lines);
        setLogVisible(showAll);
      } catch {
        /* body wasn’t JSON – ignore */
      }

      // final refresh
      await fetchConversations();
      await fetchSubconsciousDrives();
      await fetchRelationship();
      await fetchBeliefs();
      await fetchMood();
      await fetchTemperament();
      await fetchLastRag();
      window.setTimeout(() => {
        void fetchConversations();
        void fetchSubconsciousDrives();
        void fetchRelationship();
        void fetchBeliefs();
        void fetchMood();
        void fetchTemperament();
        void fetchLastRag();
      }, 2500);
    } catch (err) {
      antdMessage.error("Assistant error");
        console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ---------- UI ----------
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "90vh", padding: 10 }}>
      <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>

	<Tooltip title="Toggle between visible chat and raw memory records">
	  <Switch
    checked={showAll}
    onChange={(checked) => setShowAll(checked)}
    checkedChildren="Show All"
    unCheckedChildren="Visible Only"
	  />
	</Tooltip>

        <Tooltip title="Open drives drawer">
          <Button size="small" onClick={() => setSubconsciousOpen(true)}>
            Drives ({activeDrives.length})
          </Button>
        </Tooltip>

        <Tooltip title="Open mood drawer">
          <Button size="small" onClick={() => setMoodOpen(true)}>
            Mood {currentMood ? `(A${currentMood.anger} F${currentMood.fear} L${currentMood.attachment})` : ""}
          </Button>
        </Tooltip>

        <Tooltip title="Open temperament drawer">
          <Button size="small" onClick={() => setTemperamentOpen(true)}>
            OCEAN
          </Button>
        </Tooltip>

        <Tooltip title="Open relationship drawer">
          <Button size="small" onClick={() => setRelationshipOpen(true)}>
            Relationship
          </Button>
        </Tooltip>

        <Tooltip title="Open beliefs drawer">
          <Button size="small" onClick={() => setBeliefsOpen(true)}>
            Beliefs ({activeBeliefs.length})
          </Button>
        </Tooltip>

        <Tooltip title="Open prior injected RAG context">
          <Button size="small" onClick={() => setRagOpen(true)}>
            RAG ({lastRag?.records.length ?? 0})
          </Button>
        </Tooltip>

	      </div>


      <div style={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        <div style={{ flexGrow: 1, overflowY: "auto", background: "#fff", padding: 10, borderRadius: 8 }}>
          {messages
            .filter(m => m.role === "user" || showAll || m.content.includes("[for-human]"))
            .map((m) => (
              <div
                key={m.conversation_id}
                style={{
                  background: m.role === "user" ? "#e6f7ff" : "#f6ffed",
                  padding: 8,
                  borderRadius: 5,
                  marginBottom: 12,
                }}
              >
                <strong>
                  {showAll ? `[${m.conversation_id}] ` : ""}{m.role === "user" ? "You" : "AI"}:
                </strong>{" "}
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{displayContent(m)}</pre>
              </div>
            ))}
          <div ref={messagesEndRef} />
        </div>
      </div>


      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Type your reflection..."
          autoSize={{ minRows: 2, maxRows: 4 }}
          style={{ flexGrow: 1 }}
        />
        <Tooltip title="Send">
          <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={sendMessage} />
        </Tooltip>
      </div>

      <Modal title="Subreply Summary" open={logVisible} onCancel={() => setLogVisible(false)} footer={null}>
        {logLines.length ? (
          <ul>{logLines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        ) : (
          <p>No subreply actions recorded.</p>
        )}
      </Modal>

      <Drawer
        title="Drives"
        placement="right"
        width={420}
        open={subconsciousOpen}
        onClose={() => setSubconsciousOpen(false)}
        extra={<Button size="small" onClick={() => void fetchSubconsciousDrives()}>Refresh</Button>}
      >
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Active</div>
          {activeDrives.length ? activeDrives.map((drive) => (
            <DriveCard key={drive.drive_id} drive={drive} />
          )) : <div style={{ color: "#6b7280" }}>No active drives yet.</div>}
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Retired</div>
          {allDrives.filter((drive) => drive.status === "retired").length ? (
            allDrives
              .filter((drive) => drive.status === "retired")
              .map((drive) => <DriveCard key={drive.drive_id} drive={drive} />)
          ) : (
            <div style={{ color: "#6b7280" }}>No retired drives yet.</div>
          )}
        </div>
      </Drawer>

      <Drawer
        title="Mood"
        placement="right"
        width={460}
        open={moodOpen}
        onClose={() => setMoodOpen(false)}
        extra={<Button size="small" onClick={() => void fetchMood()}>Refresh</Button>}
      >
        {currentMood ? (
          <MoodCard mood={currentMood} />
        ) : (
          <div style={{ color: "#6b7280" }}>No mood row loaded.</div>
        )}
      </Drawer>

      <Drawer
        title="OCEAN Temperament"
        placement="right"
        width={460}
        open={temperamentOpen}
        onClose={() => setTemperamentOpen(false)}
        extra={<Button size="small" onClick={() => void fetchTemperament()}>Refresh</Button>}
      >
        {temperament ? (
          <>
            <TraitBar label="Openness" value={temperament.openness} />
            <TraitBar label="Conscientiousness" value={temperament.conscientiousness} />
            <TraitBar label="Extraversion" value={temperament.extraversion} />
            <TraitBar label="Agreeableness" value={temperament.agreeableness} />
            <TraitBar label="Neuroticism" value={temperament.neuroticism} />
            <RelationshipField label="Private Model" value={temperament.private_model} />
            <RelationshipField label="Updated" value={temperament.updated_dttm} />
          </>
        ) : (
          <div style={{ color: "#6b7280" }}>No temperament row loaded.</div>
        )}
      </Drawer>

      <Drawer
        title="Relationship Model"
        placement="right"
        width={460}
        open={relationshipOpen}
        onClose={() => setRelationshipOpen(false)}
        extra={<Button size="small" onClick={() => void fetchRelationship()}>Refresh</Button>}
      >
        {relationship ? (
          <>
            <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <strong>{relationship.display_name}</strong>
                <Tag color={relationship.status === "active" ? "green" : "default"}>{relationship.status}</Tag>
              </div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>{relationship.person_key}</div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>{relationship.platform}</div>
              <RelationshipAffect score={relationship.love_hate_score ?? 0} />
            </div>

            <RelationshipField label="Public Label" value={relationship.public_label} />
            <RelationshipField label="Love / Hate Score" value={String(relationship.love_hate_score ?? 0)} />
            <RelationshipField label="Private Model" value={relationship.private_model} />
            <RelationshipField label="Wants From Them" value={relationship.wants_from_them} />
            <RelationshipField label="Fears About Them" value={relationship.fears_about_them} />
            <RelationshipField label="Current Strategy" value={relationship.current_strategy} />
            <RelationshipField label="Last Interaction" value={relationship.last_interaction_dttm} />
            <RelationshipField label="Updated" value={relationship.updated_dttm} />
          </>
        ) : (
          <div style={{ color: "#6b7280" }}>No relationship row loaded.</div>
        )}
      </Drawer>

      <Drawer
        title="Beliefs"
        placement="right"
        width={520}
        open={beliefsOpen}
        onClose={() => setBeliefsOpen(false)}
        extra={<Button size="small" onClick={() => void fetchBeliefs()}>Refresh</Button>}
      >
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Active</div>
          {activeBeliefs.length ? activeBeliefs.map((belief) => (
            <BeliefCard key={belief.belief_id} belief={belief} />
          )) : <div style={{ color: "#6b7280" }}>No active beliefs yet.</div>}
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Inactive</div>
          {allBeliefs.filter((belief) => belief.status !== "active").length ? (
            allBeliefs
              .filter((belief) => belief.status !== "active")
              .map((belief) => <BeliefCard key={belief.belief_id} belief={belief} />)
          ) : (
            <div style={{ color: "#6b7280" }}>No inactive beliefs yet.</div>
          )}
        </div>
      </Drawer>

      <Drawer
        title="Retrieved Memory"
        placement="right"
        width={620}
        open={ragOpen}
        onClose={() => setRagOpen(false)}
        extra={<Button size="small" onClick={() => void fetchLastRag()}>Refresh</Button>}
      >
        {lastRag ? (
          <>
            <RelationshipField label="Retrieved" value={lastRag.retrievedAt} />
            <RelationshipField label="RAG Query" value={lastRag.queryPreview || "Empty"} />
            {lastRag.ragIntent ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>RAG Intent</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <Tag color={lastRag.ragIntent.should_retrieve ? "green" : "default"}>
                    retrieve {lastRag.ragIntent.should_retrieve ? "yes" : "no"}
                  </Tag>
                  <Tag color={lastRag.ragIntent.should_archive ? "green" : "default"}>
                    archive {lastRag.ragIntent.should_archive ? "yes" : "no"}
                  </Tag>
                </div>
                <div style={{ color: "#4b5563", lineHeight: 1.4 }}>{lastRag.ragIntent.reason}</div>
              </div>
            ) : null}
            {lastRag.archive ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Prompt Archive</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  <Tag color={ragArchiveColor(lastRag.archive.status)}>
                    {lastRag.archive.status.replace("_", " ")}
                  </Tag>
                  <Tag>raw {lastRag.archive.archivedCount}</Tag>
                  <Tag>curated {lastRag.archive.curatedCount}</Tag>
                </div>
                <div style={{ color: "#4b5563", lineHeight: 1.4 }}>{lastRag.archive.reason}</div>
                {lastRag.archive.error ? (
                  <div style={{ color: "#b91c1c", lineHeight: 1.4, marginTop: 4 }}>{lastRag.archive.error}</div>
                ) : null}
                <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>{lastRag.archive.updatedAt}</div>
              </div>
            ) : null}
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Retrieved Candidates</div>
            <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>
              These came back from RAG search. They may still be rejected before voicecall.
            </div>
            {parseRagMemories(lastRag.retrievedRecords ?? lastRag.records).length ? parseRagMemories(lastRag.retrievedRecords ?? lastRag.records).map((memory) => (
              <RagMemoryCard
                key={`retrieved-${memory.label}-${memory.conversationId ?? memory.score ?? memory.content.slice(0, 20)}`}
                memory={memory}
              />
            )) : (
              <div style={{ color: "#6b7280", marginBottom: 14 }}>No RAG candidates were retrieved on the prior turn.</div>
            )}

            <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 14 }}>Injected Into Voice Context</div>
            <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>
              These are the retrieved memories that survived filters and were actually added to the context window.
            </div>
            {parseRagMemories(lastRag.records).length ? parseRagMemories(lastRag.records).map((memory) => (
              <RagMemoryCard
                key={`injected-${memory.label}-${memory.conversationId ?? memory.score ?? memory.content.slice(0, 20)}`}
                memory={memory}
                injected
              />
            )) : (
              <div style={{ color: "#6b7280" }}>No archived RAG memory was injected on the prior turn.</div>
            )}
          </>
        ) : (
          <div style={{ color: "#6b7280" }}>
            No prior RAG context has been captured since the chat service last started.
          </div>
        )}
      </Drawer>
    </div>
  );
}
