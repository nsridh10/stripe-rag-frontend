# Stripe API Documentation RAG Agent

A full-stack Retrieval-Augmented Generation system that lets users query Stripe's API documentation using natural language. Built with a **LangGraph stateful agent**, **ChromaDB vector store**, and a **React chat interface** — supporting multi-version documentation, multi-turn conversations, and transparent execution tracing.

```
┌───────────────────┐       POST /query       ┌──────────────────────────┐      similarity_search     ┌────────────┐
│  React + TS + Vite│ ──────────────────────▶  │  FastAPI + LangGraph     │ ──────────────────────────▶│  ChromaDB  │
│  (Chat UI)        │ ◀──────────────────────  │  (8-Node Agent Graph)    │ ◀──────────────────────────│  (Vectors) │
└───────────────────┘   answer + sources +     └──────────────────────────┘   chunks + similarity      └────────────┘
                        execution_trace                                        scores
```

**Supported API classes**: Accounts, Customers, Payment Intents, Subscriptions, Refunds, Products, Prices, Transfers  
**Supported versions**: `basil` (older) and `clover` (latest) — Stripe's codename-based versioning  
**LLM providers**: Groq, Grok (xAI), Google Gemini, OpenAI — bring-your-own-key, configured from UI

---

## Table of Contents

1. [Document Ingestion & Chunking](#1-document-ingestion--chunking)
2. [LangGraph Agent Pipeline](#2-langgraph-agent-pipeline)
3. [Context-Aware Multi-Turn Conversations](#3-context-aware-multi-turn-conversations)
4. [Evaluation Framework (RAGAS)](#4-evaluation-framework-ragas)
5. [FastAPI Routes & Session Management](#5-fastapi-routes--session-management)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Source Documents & Execution Trace](#7-source-documents--execution-trace)
8. [Deployment](#8-deployment)
9. [Project Structure](#9-project-structure)

---

## 1. Document Ingestion & Chunking

> Source: backend [`src/ingestion.py`](../stripe-rag-agent/src/ingestion.py), [`src/parsers.py`](../stripe-rag-agent/src/parsers.py), [`config.yaml`](../stripe-rag-agent/config.yaml)

### Dual-Format Parsing

The system ingests **16 raw documentation files** — 8 API classes × 2 versions. Basil docs are in **reStructuredText** (`.rst`), clover docs are in **Markdown** (`.md`). A `ParserFactory` dynamically selects the correct parser:

| Version | Format | Parser           | File Example          |
| ------- | ------ | ---------------- | --------------------- |
| basil   | `.rst` | `RSTParser`      | `CUSTOMERS_basil.rst` |
| clover  | `.md`  | `MarkdownParser` | `CUSTOMERS_clover.md` |

Both parsers support two chunking modes:

### Structure-Aware Chunking

- **Granular mode** — splits at every Markdown/RST header (`#`, `##`, `###`), then applies `RecursiveCharacterTextSplitter` with `chunk_size=1000, overlap=100`. We initially used this mode but found it **over-fragmented content** — large parameter tables and endpoint descriptions were cut mid-row, losing context and degrading retrieval quality.

- **Large mode** (current default) — uses `chunk_size=4000, overlap=200` with header-aware separators (`\n## `, `\n### `, `\n\n`). This produces ~2–3 chunks per file, keeping tables, endpoint blocks, and parameter lists intact. This significantly improved answer quality for queries about fields, parameters, and payload structures.

### Embedding & Storage

Chunks are embedded using **BAAI/bge-small-en-v1.5** (HuggingFace, running locally on CPU — zero external API calls) and stored in **ChromaDB** with three metadata fields:

```
api_class: "CUSTOMERS"       ← enables filtered retrieval per API
version:   "clover"           ← enables version-specific or cross-version queries
source_file: "data/raw/CUSTOMERS_clover.md"  ← traced back to raw doc
```

This metadata-based filtering allows the search tool to query a precise `(api_class, version)` slice of the vector store rather than searching the entire corpus.

---

## 2. LangGraph Agent Pipeline

> Source: backend [`src/graph/`](../stripe-rag-agent/src/graph/), [`src/prompts/`](../stripe-rag-agent/src/prompts/), [`src/tools/search.py`](../stripe-rag-agent/src/tools/search.py)

The core of the system is an **8-node LangGraph state machine** defined in [`src/graph/builder.py`](../stripe-rag-agent/src/graph/builder.py). Each request flows through the graph with conditional routing — nodes can route to each other, skip to `END`, or loop for retries.

```
frontier → planner → budget_checker → executor → tools → restructurer → synthesizer → END
                          ↑                         │
                          └── query_expander ◄──────┘  (retry on failure)
```

### Node Breakdown

| Node               | Purpose                                       | Key Behavior                                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontier**       | Entry guard — validates request scope         | Rejects off-topic queries ("What's the weather?"), blocks unsupported versions (`acacia`), detects mentioned API classes and versions. Routes: `valid → planner`, `rejected → END`, `needs_clarification → END`                                                                        |
| **Planner**        | Query decomposition — builds retrieval plan   | Analyzes the question and produces a structured JSON plan: which API classes, which versions, what semantic search query for each. Handles follow-up intent detection. Injects conversation operation log for multi-turn context.                                                      |
| **Budget Checker** | Resource governor — enforces tool call limits | Hard limit of **6 tool calls per request** (configurable). If a plan exceeds budget on a fresh request, asks the user to narrow the query. On retry paths with partial results, truncates the plan and marks overflow items as `budget_exceeded`.                                      |
| **Executor**       | Tool caller — executes planned searches       | Binds `search_stripe_api_docs` to the LLM and invokes it. Includes **post-validation** that strips unauthorized tool calls — if the LLM attempts to search for an API class not in the plan, that call is blocked.                                                                     |
| **Tools**          | Vector DB search — queries ChromaDB           | Retrieves `top_k=2` chunks per query with metadata filters (`api_class` + `version`). Applies a **similarity threshold of 0.5** — chunks below this score are discarded. Auto-resolves "latest" version to the configured default (`clover`).                                          |
| **Query Expander** | Retry logic — rephrase failed queries         | Triggered when any search returns "No documentation found". Correlates failures back to the query tracker via `tool_call_id`, builds a retry plan with broader terms, and routes back through Budget Checker. Max **1 retry** per request.                                             |
| **Restructurer**   | Coverage analysis — correlates results        | Maps tool results to tracked sub-queries and assigns a status to each: `COVERED`, `NOT_FOUND`, `UNAVAILABLE`, or `BUDGET_EXCEEDED`. Produces a structured coverage analysis that the synthesizer uses as its guide.                                                                    |
| **Synthesizer**    | Final answer — generates the response         | Uses a **plain LLM with no tools bound** — this guarantees the graph terminates. Follows the restructurer's coverage analysis to address every sub-query: detailed answers for covered items, explicit statements for gaps. Strict guardrails prevent hallucination over missing data. |

### Agent State

All nodes read from and write to a shared `AgentState` (defined in [`src/graph/state.py`](../stripe-rag-agent/src/graph/state.py)):

```python
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]  # Append-only message history
    tool_call_budget: int                    # Tracks tool calls used so far
    tool_plan: Optional[List[ToolPlan]]      # Retrieval plan from planner
    needs_clarification: bool                # Whether to ask the user for more info
    rephrase_count: int                      # Retry attempts used
    intent_type: Optional[str]               # "new_intent" or "follow_up"
    query_tracker: Optional[List[QueryTracker]]  # Per-sub-query status tracking
    restructurer_analysis: Optional[str]     # Coverage report for synthesizer
    conversation_context: Optional[List[dict]]   # Operation log from prior turns
    active_scope: Optional[dict]             # Current API classes + versions in discussion
    frontier_result: Optional[FrontierResult]    # Validation output
    is_rejected: bool                        # Whether frontier rejected the request
```

### Routing Logic

Conditional routing is defined in [`src/graph/routing.py`](../stripe-rag-agent/src/graph/routing.py):

- `route_after_frontier` → `planner` (valid) or `END` (rejected/clarification)
- `route_after_planner` → `budget_checker` or `END` (clarification)
- `route_after_budget_checker` → `executor`, `restructurer` (budget exhausted on retry), or `END`
- `route_after_executor` → `tools` (has tool calls), `restructurer` (has tracker), or `synthesizer`
- `route_after_tools` → `query_expander` (failures + retries remain) or `restructurer`

---

## 3. Context-Aware Multi-Turn Conversations

> Source: backend [`src/memory.py`](../stripe-rag-agent/src/memory.py), [`src/routes/query.py`](../stripe-rag-agent/src/routes/query.py)

The system supports multi-turn conversations where follow-up questions inherit context from prior turns. This is implemented through three mechanisms:

### Intent Classification

The planner classifies every query as either `new_intent` or `follow_up`:

- **`follow_up`**: User continues the same topic (e.g., "What about updating it?" after asking about customer creation). The agent sees prior messages and the existing operation log.
- **`new_intent`**: User switches to an unrelated topic (e.g., "How do I create a payment intent?" after discussing customers). This triggers a **context boundary reset**.

### Context Boundary (`context_start`)

Each session maintains a `context_start` index. When a new intent is detected, this marker advances to the current message count. On subsequent requests, only messages **after** `context_start` are fed to the agent — preventing old-topic messages from polluting retrieval. All messages remain visible in the UI; only the agent's RAG context window is narrowed.

### Operation Log (`conversation_context`) & Active Scope

- **`conversation_context`**: A list of operation records from prior turns, each recording the user query, which APIs were searched, and the outcome (covered/not_found/etc.). This is injected into the planner prompt so it understands what has already been retrieved.
- **`active_scope`**: Tracks the current API classes and versions being discussed (e.g., `{"api_classes": ["CUSTOMERS"], "versions": ["basil", "clover"]}`). When a follow-up says "What about the address fields?" without specifying an API, the planner uses the active scope to generate plan items for all relevant `(api_class, version)` combinations.

Both are reset when a `new_intent` is detected, and persisted per-session via the memory backend.

> **Note**: This system works well for straightforward follow-ups but is not perfect — ambiguous intent boundaries can occasionally cause the planner to misclassify. It is a best-effort design within the assignment scope.

---

## 4. Evaluation Framework (RAGAS)

> Source: backend [`src/eval/eval_llm.py`](../stripe-rag-agent/src/eval/eval_llm.py), [`src/eval/test_cases.py`](../stripe-rag-agent/src/eval/test_cases.py), [`src/eval/README.md`](../stripe-rag-agent/src/eval/README.md)

The system includes a comprehensive evaluation pipeline built on **RAGAS** (Retrieval-Augmented Generation Assessment) to measure both quality and performance.

### Test Cases

Five test cases cover the critical behaviors of the system:

| #   | Category           | Question                                                                                 | Expected Behavior                                          |
| --- | ------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Basic Query        | "How do I create a customer in Stripe?"                                                  | Retrieves CUSTOMERS clover docs, returns create parameters |
| 2   | Version Comparison | "Key differences between Customer API in basil and clover?"                              | Retrieves both versions, identifies field naming changes   |
| 3   | Junk Rejection     | "What is the weather like in San Francisco?"                                             | Frontier rejects as out-of-scope — no RAG processing       |
| 4   | Multi-API Budget   | "Required params for Customer, PaymentIntent, Subscription, Transfer for both versions?" | Detects 8 lookups > 6 budget, asks user to break down      |
| 5   | Specific Version   | "Create a refund in the basil version?"                                                  | Retrieves REFUNDS basil specifically                       |

### How Evaluation Works

Each test case runs through the **full agent graph** end-to-end (frontier → planner → executor → tools → synthesizer). The framework then collects:

**Performance metrics** (measured directly):

- **Latency** — end-to-end response time in seconds
- **Token usage** — input + output tokens from all LLM calls (extracted from `usage_metadata` on `AIMessage` objects)
- **Tool calls** — number of `ToolMessage` instances in the conversation

**Quality metrics** (scored by RAGAS using LLM-as-judge):

| Metric                 | What It Measures                                 | How RAGAS Computes It                                                                 |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Faithfulness**       | Is the answer grounded in the retrieved context? | Breaks the answer into claims, checks each against the retrieved chunks               |
| **Answer Relevancy**   | Does the answer actually address the question?   | Generates hypothetical questions from the answer, compares embeddings to the original |
| **Answer Correctness** | How complete is the answer vs. ground truth?     | Semantic + factual comparison against the reference answer                            |

### RAGAS Tech Stack

- **LLM Judge**: Groq `llama-3.3-70b-versatile` wrapped via `LangchainLLMWrapper` — the same model used by the agent, used here as an evaluator
- **Embedding Model**: `BAAI/bge-small-en-v1.5` wrapped via `LangchainEmbeddingsWrapper` — used for the Answer Relevancy metric's similarity computation
- **Dataset Format**: HuggingFace `Dataset.from_dict()` with columns: `question`, `answer`, `contexts` (retrieved `ToolMessage` contents), `ground_truth`

### Report Output

Results are saved as timestamped CSV files in `data/eval/`:

- **`eval_report_<timestamp>.csv`** — per-question detail: question, answer, category, latency, tokens, tool calls, faithfulness, relevancy, correctness
- **`eval_summary_<timestamp>.csv`** — aggregated: total cases, avg latency, avg tokens, avg tool calls

```bash
# Run full evaluation (5 test cases + RAGAS scoring)
python -m src.eval.eval_llm

# Quick test (1 case only)
python -m src.eval.eval_llm --quick

# Performance only (skip RAGAS)
python -m src.eval.eval_llm --skip-ragas
```

---

## 5. FastAPI Routes & Session Management

> Source: backend [`src/routes/`](../stripe-rag-agent/src/routes/), [`src/main.py`](../stripe-rag-agent/src/main.py)

### Route Overview

| Method   | Endpoint                 | Purpose                                                               | Module         |
| -------- | ------------------------ | --------------------------------------------------------------------- | -------------- |
| `POST`   | `/query`                 | Main RAG endpoint — processes a question through the full agent graph | `query.py`     |
| `GET`    | `/sessions`              | Lists all conversation sessions with metadata for the sidebar         | `sessions.py`  |
| `DELETE` | `/sessions`              | Clears all sessions — called on frontend page refresh                 | `sessions.py`  |
| `GET`    | `/session/{id}`          | Returns metadata for a specific session                               | `sessions.py`  |
| `GET`    | `/session/{id}/messages` | Returns all messages in a session for chat history rendering          | `sessions.py`  |
| `DELETE` | `/session/{id}`          | Clears messages from a specific session                               | `sessions.py`  |
| `POST`   | `/ingest`                | Triggers document ingestion pipeline in the background (202 Accepted) | `ingestion.py` |
| `GET`    | `/`                      | Health check                                                          | `main.py`      |

### The `/query` Endpoint

This is the primary endpoint. On each request it:

1. Instantiates a per-request LLM using the user's provided `provider`, `model`, and `api_key` (via `set_llm()` context variable)
2. Creates a per-request `TraceCollector` to capture execution events
3. Loads conversation history from memory (scoped to `context_start` boundary)
4. Loads the operation log (`conversation_context`) and `active_scope` from the session
5. Invokes `app_graph.invoke(initial_state)` — the full LangGraph pipeline
6. After completion, handles session management based on `intent_type`:
   - `new_intent` with existing history → advances `context_start`, resets operation log and scope
   - `follow_up` or first query → appends messages and updates context normally
7. Returns `QueryResponse` with: `answer`, `sources` (per-tool-call chunks), and `execution_trace`

### Session Management

Sessions use a **pluggable memory backend** (configured in `config.yaml`):

- **In-memory** (`InMemoryConversationMemory`) — fast, suitable for development. Data lost on restart.
- **SQLite** (`SQLiteConversationMemory`) — persistent, file-based. Suitable for production single-server setups.

Both implement the `ConversationMemory` abstract base class. Each session stores:

- **Message history** — `HumanMessage` / `AIMessage` objects
- **Operation log** — what queries were executed in prior turns
- **Active scope** — current `(api_classes, versions)` being discussed
- **Context start** — the message index boundary for intent separation

Sessions are auto-created on first query for a given `session_id`. The frontend generates UUIDs for new conversations and passes them on subsequent requests.

---

## 6. Frontend Architecture

> Source: [`src/`](src/)

The frontend is a **React + TypeScript** application built with **Vite**, styled with custom CSS.

### Layout

The UI has three panels:

- **Sidebar** (`Sidebar.tsx`) — session list (fetched via `GET /sessions`), LLM configuration (provider dropdown, model field, API key input), and "New Chat" button
- **Chat Area** (`ChatArea.tsx`) — message bubbles with Markdown rendering, text input with send button
- **Right Panel** (toggleable) — either the Source Panel or Trace Panel for the selected assistant message

### API Integration

All backend communication goes through [`api.ts`](src/api.ts):

- **`sendQuery(query, provider, model, apiKey, sessionId?)`** → `POST /query` — sends the user's question with LLM credentials. Returns the full `QueryResponse` (answer, sources, trace).
- **`fetchSessions()`** → `GET /sessions` — populates the sidebar session list.
- **`fetchSessionMessages(sessionId)`** → `GET /session/{id}/messages` — loads chat history when switching sessions.
- **`deleteSession(sessionId)`** → `DELETE /session/{id}` — removes a session.
- **`clearAllSessions()`** → `DELETE /sessions` — called on page load/refresh to start clean.

### Message Cache

The frontend maintains an in-memory `messageCache` (React `useRef<Map>`) keyed by session ID. When switching between sessions, cached messages (with their attached sources and traces) are restored instantly without re-fetching from the backend. The backend only stores plain message text — sources and traces are frontend-only enrichments attached at query response time.

---

## 7. Source Documents & Execution Trace

> Source: backend [`src/trace.py`](../stripe-rag-agent/src/trace.py), [`src/tools/search.py`](../stripe-rag-agent/src/tools/search.py), frontend [`SourcePanel.tsx`](src/components/SourcePanel.tsx), [`TracePanel.tsx`](src/components/TracePanel.tsx)

### Source Documents

Every tool call captures the chunks it retrieved. Each source entry includes:

- **`api_class`** and **`version`** — what was searched
- **`query`** — the semantic search query used
- **`source_file`** — the raw documentation file the chunks came from
- **`status`** — `found` or `not_found`
- **`chunks`** — list of retrieved chunks, each with:
  - `section` — header hierarchy (e.g., "Create a Customer > Parameters")
  - `similarity_score` — cosine similarity (0–1)
  - `content_preview` — first ~300 characters

The frontend **Source Panel** renders these grouped by tool call, with expandable chunk previews showing similarity scores and section paths.

### Execution Trace

The `TraceCollector` (using Python `contextvars` for thread-safe per-request isolation) records events as the graph executes:

- **Node lifecycle** — `start_node(name)` / `end_node(name, details)` with wall-clock duration in ms
- **Routing decisions** — `add_routing(from_node, to_node, reason)` capturing why each conditional edge was taken
- **Tool sources** — `add_tool_source(api_class, version, query, source_file, status, chunks)`

The trace is serialized into the API response as `ExecutionTrace` containing:

```
total_duration_ms       — end-to-end time
nodes_executed[]        — each node with start/end time, duration, input/output details
routing_decisions[]     — each edge with from/to node and reason string
query_tracker[]         — final status of all sub-queries
plan[]                  — the planner's original retrieval plan
tool_call_budget_used   — how many of the 6 tool calls were consumed
tool_call_budget_max    — the configured limit
```

The frontend **Trace Panel** displays this in three collapsible sections:

- **Node Executions** — each node with its duration bar and expandable input/output JSON
- **Routing Decisions** — the path the request took through the graph with reasons
- **Retrieval Plan** — what the planner decided to search for

This provides full transparency into the agent's reasoning and decision-making process for every query.

---

## 8. Deployment

> See: backend [`docs/DEPLOY.md`](../stripe-rag-agent/docs/DEPLOY.md) for the full step-by-step AWS EC2 guide.

The system deploys via **Docker Compose** with two containers:

| Container             | Base Image            | Purpose                                                       |
| --------------------- | --------------------- | ------------------------------------------------------------- |
| `stripe-rag-backend`  | `python:3.11-slim`    | FastAPI + LangGraph + ChromaDB + HuggingFace embeddings       |
| `stripe-rag-frontend` | `nginx:stable-alpine` | Serves built React app + reverse-proxies API calls to backend |

Key deployment decisions:

- **CPU-only PyTorch** installed before `sentence-transformers` to avoid pulling the CUDA build (~1.3 GB savings)
- **Embedding model pre-downloaded** at Docker build time — container starts instantly without internet
- **nginx reverse proxy** — frontend makes same-origin requests; nginx forwards `/query`, `/sessions`, `/session/*`, `/ingest` to `backend:8000` over Docker's internal network
- **Only port 80 exposed** publicly — the backend port is internal-only

---

## 9. Project Structure

```
stripe-rag-agent/
├── config.yaml                  # All configuration (embedding model, vector DB, agent limits, API docs)
├── docker-compose.yml           # Two-container deployment (backend + frontend)
├── Dockerfile                   # Backend image (Python 3.11 + CPU torch + HF model)
├── requirements.txt             # Production dependencies
├── requirements-eval.txt        # Evaluation dependencies (RAGAS, pandas, datasets)
├── docs/
│   ├── DEPLOY.md                # Full AWS EC2 deployment guide
│   └── CONVERSATION_MEMORY.md   # Memory system design documentation
├── data/
│   ├── raw/                     # 16 raw Stripe API doc files (.rst + .md)
│   ├── chroma_db/               # ChromaDB persistent vector store
│   └── eval/                    # RAGAS evaluation CSV reports
└── src/
    ├── main.py                  # FastAPI app entry point
    ├── agent.py                 # Backward-compat re-exports from graph module
    ├── config.py                # YAML config loader
    ├── constants.py             # Agent limits, API classes, version lists, status enums
    ├── dependencies.py          # Singleton providers: embeddings, LLM (per-request), vector store
    ├── ingestion.py             # Document ingestion pipeline
    ├── memory.py                # ConversationMemory ABC + InMemory/SQLite implementations
    ├── parsers.py               # MarkdownParser, RSTParser, ParserFactory
    ├── trace.py                 # TraceCollector (per-request execution trace)
    ├── graph/
    │   ├── state.py             # AgentState, ToolPlan, QueryTracker, FrontierResult TypedDicts
    │   ├── nodes.py             # All 8 node functions (frontier through synthesizer)
    │   ├── routing.py           # Conditional edge routing functions
    │   └── builder.py           # Graph assembly and compilation
    ├── prompts/
    │   ├── frontier.py          # Frontier validation prompt
    │   ├── planner.py           # Query decomposition prompt
    │   ├── executor.py          # Tool execution prompt
    │   └── synthesizer.py       # Final answer synthesis prompt
    ├── tools/
    │   └── search.py            # search_stripe_api_docs tool (ChromaDB query)
    ├── routes/
    │   ├── query.py             # POST /query endpoint
    │   ├── sessions.py          # Session CRUD endpoints
    │   ├── ingestion.py         # POST /ingest endpoint
    │   └── models.py            # Pydantic request/response schemas
    └── eval/
        ├── eval_llm.py          # Evaluation runner + RAGAS integration + report generation
        └── test_cases.py        # 5 test case definitions with ground truth

stripe-rag-frontend/
├── Dockerfile                   # Multi-stage: Node build → nginx serve
├── nginx.conf                   # Reverse proxy config (API → backend:8000)
├── vite.config.ts
└── src/
    ├── App.tsx                  # Main layout: Sidebar + ChatArea + right panel
    ├── api.ts                   # All backend API calls (sendQuery, fetchSessions, etc.)
    ├── types.ts                 # TypeScript interfaces matching backend Pydantic models
    └── components/
        ├── Sidebar.tsx          # Session list + LLM config
        ├── ChatArea.tsx         # Message bubbles + input
        ├── MessageBubble.tsx    # Individual message with source/trace buttons
        ├── SourcePanel.tsx      # Retrieved chunks + similarity scores
        ├── TracePanel.tsx       # Graph execution trace viewer
        ├── ApiKeyInput.tsx      # Secure API key input
        └── LlmConfigInput.tsx   # Provider/model selection
```
