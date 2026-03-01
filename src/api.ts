import type { QueryResponse, SessionListItem, MessageItem } from "./types";

const API_BASE = "http://localhost:8000";

export async function sendQuery(
  query: string,
  provider: string,
  model: string,
  apiKey: string,
  sessionId?: string,
): Promise<QueryResponse> {
  const body: Record<string, string> = {
    query,
    provider,
    model,
    api_key: apiKey,
  };
  if (sessionId) body.session_id = sessionId;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Query failed");
  }
  return res.json();
}

export async function fetchSessions(): Promise<SessionListItem[]> {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSessionMessages(
  sessionId: string,
): Promise<MessageItem[]> {
  const res = await fetch(`${API_BASE}/session/${sessionId}/messages`);
  if (!res.ok) return [];
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/session/${sessionId}`, { method: "DELETE" });
}

export async function clearAllSessions(): Promise<void> {
  await fetch(`${API_BASE}/sessions`, { method: "DELETE" });
}
