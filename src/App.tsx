import { useState, useCallback, useRef, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import SourcePanel from "./components/SourcePanel";
import TracePanel from "./components/TracePanel";
import { sendQuery, clearAllSessions } from "./api";
import type { ChatMessage, ToolCallSource, ExecutionTrace } from "./types";
import "./App.css";

export default function App() {
  const [ready, setReady] = useState(false);

  // ---- State ----
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);

  // LLM Configuration - no localStorage caching for security
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState("llama-3.3-70b-versatile");
  const [apiKey, setApiKey] = useState("");

  // Cache for messages per session (preserves sources & traces)
  const messageCache = useRef<Map<string, ChatMessage[]>>(new Map());

  // Right panel state
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [rightPanel, setRightPanel] = useState<"sources" | "trace" | null>(
    null,
  );
  const [activeSources, setActiveSources] = useState<ToolCallSource[]>([]);
  const [activeTrace, setActiveTrace] = useState<ExecutionTrace | null>(null);

  // Clear all backend sessions on page load/refresh
  useEffect(() => {
    clearAllSessions()
      .catch((err) => console.warn("Failed to clear sessions on startup:", err))
      .finally(() => setReady(true));
  }, []); // Empty deps = runs once on mount

  // ---- Handlers ----
  const handleNewChat = useCallback(() => {
    // Save current session's messages to cache before switching
    if (sessionId && messages.length > 0) {
      messageCache.current.set(sessionId, messages);
    }
    setSessionId(null);
    setMessages([]);
    setSelectedMessageId(null);
    setRightPanel(null);
    setActiveSources([]);
    setActiveTrace(null);
  }, [sessionId, messages]);

  const handleSelectSession = useCallback(
    async (id: string) => {
      // Save current session's messages to cache before switching
      if (sessionId && messages.length > 0) {
        messageCache.current.set(sessionId, messages);
      }

      setSessionId(id);
      setSelectedMessageId(null);
      setRightPanel(null);

      // Try to load from cache first (preserves sources & traces)
      const cached = messageCache.current.get(id);
      if (cached && cached.length > 0) {
        setMessages(cached);
        return;
      }

      // Fallback to backend (no sources/traces available)
      setMessages([]);
      try {
        const { fetchSessionMessages } = await import("./api");
        const msgs = await fetchSessionMessages(id);
        const loadedMessages = msgs.map((m, i) => ({
          id: `${id}-${i}`,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(),
        }));
        setMessages(loadedMessages);
        // Also cache these (without sources/traces for now)
        messageCache.current.set(id, loadedMessages);
      } catch {
        // Silently fail — session may have been cleared
      }
    },
    [sessionId, messages],
  );

  const handleSelectMessage = useCallback((msg: ChatMessage) => {
    setSelectedMessageId(msg.id);
    const hasSources = msg.sources && msg.sources.length > 0;
    const hasTrace = !!msg.execution_trace;

    setActiveSources(msg.sources || []);
    setActiveTrace(msg.execution_trace || null);

    if (hasSources) {
      setRightPanel("sources");
    } else if (hasTrace) {
      setRightPanel("trace");
    } else {
      setRightPanel(null);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    if (!apiKey.trim()) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "**Error:** Please configure your LLM provider and API key in the sidebar before sending messages.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendQuery(
        text,
        provider,
        model,
        apiKey,
        sessionId || undefined,
      );

      // Capture session ID from first response
      const activeSessionId = sessionId || response.session_id;
      if (!sessionId) {
        setSessionId(response.session_id);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        timestamp: new Date(),
        sources: response.sources,
        execution_trace: response.execution_trace,
      };

      setMessages((prev) => {
        const updated = [...prev, assistantMsg];
        // Update cache with new messages
        messageCache.current.set(activeSessionId, updated);
        return updated;
      });
      setSidebarRefresh((n) => n + 1);
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `**Error:** ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId, provider, model, apiKey]);

  const handleLlmConfigChange = useCallback(
    (newProvider: string, newModel: string, newApiKey: string) => {
      setProvider(newProvider);
      setModel(newModel);
      setApiKey(newApiKey);
    },
    [],
  );

  const handleClosePanel = useCallback(() => {
    setRightPanel(null);
    setSelectedMessageId(null);
  }, []);

  if (!ready) return <div className="app-loading">Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar
        activeSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        refreshTrigger={sidebarRefresh}
        provider={provider}
        model={model}
        apiKey={apiKey}
        onLlmConfigChange={handleLlmConfigChange}
      />

      <ChatArea
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={handleSend}
        isLoading={isLoading}
        onSelectMessage={handleSelectMessage}
        selectedMessageId={selectedMessageId}
      />

      {rightPanel === "sources" && activeSources.length > 0 && (
        <div className="right-panels">
          <SourcePanel sources={activeSources} onClose={handleClosePanel} />
          {activeTrace && (
            <div className="trace-toggle">
              <button
                className="toggle-trace-btn"
                onClick={() => setRightPanel("trace")}
              >
                View Execution Trace →
              </button>
            </div>
          )}
        </div>
      )}

      {rightPanel === "trace" && activeTrace && (
        <div className="right-panels">
          <TracePanel trace={activeTrace} onClose={handleClosePanel} />
          {activeSources.length > 0 && (
            <div className="trace-toggle">
              <button
                className="toggle-trace-btn"
                onClick={() => setRightPanel("sources")}
              >
                ← Back to Sources
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
