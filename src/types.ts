// Types matching the backend Pydantic models

export interface SourceChunk {
  section: string;
  similarity_score: number;
  content_preview: string;
  source_file: string | null;
}

export interface ToolCallSource {
  api_class: string;
  version: string;
  query: string;
  source_file: string;
  status: string; // "found" | "not_found" | "error"
  chunks: SourceChunk[];
}

export interface TraceNodeExecution {
  node: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  input_details: Record<string, unknown>;
  output_details: Record<string, unknown>;
}

export interface TraceRoutingDecision {
  from_node: string;
  to_node: string;
  reason: string;
  timestamp: string;
}

export interface ExecutionTrace {
  total_duration_ms: number;
  nodes_executed: TraceNodeExecution[];
  routing_decisions: TraceRoutingDecision[];
  query_tracker: Record<string, unknown>[];
  plan: Record<string, unknown>[];
  tool_call_budget_used: number;
  tool_call_budget_max: number;
}

export interface QueryResponse {
  message_type: string; // "answer" | "clarification" | "rejected" | "error"
  answer: string;
  session_id: string;
  sources: ToolCallSource[];
  execution_trace: ExecutionTrace;
}

export interface MessageItem {
  role: "user" | "assistant";
  content: string;
}

export interface SessionListItem {
  session_id: string;
  created_at: string;
  last_accessed: string;
  message_count: number;
  preview: string;
}

// Frontend-only types

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: ToolCallSource[];
  execution_trace?: ExecutionTrace;
  isLoading?: boolean;
}
