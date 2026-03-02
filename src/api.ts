import type { QueryResponse, SessionListItem, MessageItem } from "./types";

// In development, set VITE_API_BASE=http://localhost:8000 in .env.local
// In production (Docker + nginx proxy), leave unset — requests go same-origin
const API_BASE = (import.meta.env.VITE_API_BASE as string) ?? "";

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
  const sessions = await res.json();
  console.log("[fetchSessions] Backend returned:", sessions); // ← add this
  return sessions;
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
