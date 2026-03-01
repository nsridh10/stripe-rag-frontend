import { useEffect, useState } from "react";
import { MessageSquarePlus, Trash2, MessageCircle } from "lucide-react";
import type { SessionListItem } from "../types";
import { fetchSessions, deleteSession } from "../api";
import ApiKeyInput from "./ApiKeyInput";
import "./Sidebar.css";

interface Props {
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  refreshTrigger: number; // bump to re-fetch
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function Sidebar({
  activeSessionId,
  onSelectSession,
  onNewChat,
  refreshTrigger,
  apiKey,
  onApiKeyChange,
}: Props) {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);

  useEffect(() => {
    fetchSessions().then(setSessions);
  }, [refreshTrigger]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteSession(id);
    fetchSessions().then(setSessions);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/stripe-logo.svg" alt="Stripe" className="logo-icon" />
          <span className="logo-text">RAG Agent</span>
        </div>
        <button className="new-chat-btn" onClick={onNewChat} title="New chat">
          <MessageSquarePlus size={18} />
        </button>
      </div>

      <div className="sidebar-content">
        <ApiKeyInput apiKey={apiKey} onApiKeyChange={onApiKeyChange} />

        <div className="sessions-section">
          <div className="section-label">Conversations</div>
          <div className="sessions-list">
            {sessions.length === 0 && (
              <div className="empty-sessions">
                <MessageCircle size={24} opacity={0.3} />
                <span>No conversations yet</span>
              </div>
            )}
            {sessions.map((s) => (
              <div
                key={s.session_id}
                className={`session-item ${
                  s.session_id === activeSessionId ? "active" : ""
                }`}
                onClick={() => onSelectSession(s.session_id)}
              >
                <div className="session-preview">
                  {s.preview || "New conversation"}
                </div>
                <div className="session-meta">
                  <span>{s.message_count} msgs</span>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(e, s.session_id)}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
