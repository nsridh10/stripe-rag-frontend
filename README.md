# Stripe RAG Agent — Frontend

The chat interface for the Stripe API Documentation RAG Agent. Built with **React + TypeScript + Vite**, it provides a multi-session chat UI with built-in LLM configuration, source document inspection, and full execution trace visibility.

**Live demo**: [http://18.116.13.255](http://18.116.13.255) (AWS EC2)

> **Backend repo**: [stripe-rag-agent](https://github.com/nsridh10/stripe-api-versiondoc-rag) — FastAPI + LangGraph agent pipeline, ChromaDB vector store, RAGAS evaluation

---

## UI Overview

![Landing Screen](screenshots/UI%20Land%20Screen.png)

The interface has three panels:

- **Left Sidebar** — session list, LLM provider/model configuration, API key input
- **Center Chat Area** — message bubbles with Markdown rendering, input field
- **Right Panel** (toggleable) — Source Documents or Execution Trace for the selected assistant message

---

## LLM Configuration

![LLM Config](screenshots/LLM%20Config.png)

Users bring their own API key and select a provider + model directly from the sidebar. Supported providers:

| Provider          | Example Models                                    |
| ----------------- | ------------------------------------------------- |
| **Groq**          | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` |
| **Grok (xAI)**    | `grok-3-mini-fast`                                |
| **Google Gemini** | `gemini-2.0-flash`                                |
| **OpenAI**        | `gpt-4o`, `gpt-4o-mini`                           |

The selected provider, model, and API key are sent with every query request — the backend does not store credentials. Configuration persists in the UI session but is never written to disk or local storage.

---

## Chat Interface

![Sample Chat](screenshots/Sample%20Chat.png)

Each assistant response includes two action buttons:

- **Sources** — opens the right panel to show which documentation chunks were retrieved
- **Trace** — opens the right panel to show how the agent graph processed the query

The chat supports multi-turn conversations — follow-up questions automatically inherit context from prior turns. When the user switches topics, the system detects the new intent and resets the retrieval context.

---

## Source Documents Panel

![Source Documents](screenshots/Source%20Documents.png)

When a query retrieves documentation from the vector store, each tool call's results are displayed in the Source Panel:

- **API Class & Version** — e.g., `CUSTOMERS` / `clover`
- **Search Query** — the semantic query the agent used against ChromaDB
- **Source File** — which raw documentation file the chunks originated from (e.g., `data/raw/CUSTOMERS_clover.md`)
- **Chunks** — each retrieved chunk shows:
  - **Section path** — the header hierarchy (e.g., "Create a Customer > Parameters")
  - **Similarity score** — cosine similarity (0–1) between the query embedding and the chunk embedding
  - **Content preview** — first ~300 characters of the chunk text, expandable

Sources are grouped by tool call, so multi-API queries show separate groups for each `(api_class, version)` lookup.

---

## Execution Trace Panel

![Execution Trace](screenshots/Execution%20Trace.png)

Every query produces a full execution trace showing how the 8-node LangGraph agent processed the request. The Trace Panel has three collapsible sections:

### Node Executions

Each graph node is listed with:

- **Name** — which node ran (Frontier, Planner, Budget Checker, Executor, Tools, Query Expander, Restructurer, Synthesizer)
- **Duration** — wall-clock time in milliseconds
- **Input/Output** — expandable JSON showing what each node received and produced

### Routing Decisions

Shows the path the request took through the graph:

- **From → To** — which node routed to which
- **Reason** — why that edge was taken (e.g., "Valid query, proceeding to planner", "Has tool calls, routing to tools node")

### Retrieval Plan

The planner's original retrieval plan showing:

- Which API classes and versions were targeted
- What search queries were generated for each
- Budget allocation vs. actual usage

This provides full transparency into the agent's reasoning — useful for debugging retrieval quality and understanding why certain results were or weren't returned.

---

## API Integration

All backend calls go through [`src/api.ts`](src/api.ts):

| Function                 | Endpoint                     | Purpose                                                                 |
| ------------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| `sendQuery()`            | `POST /query`                | Sends user question + LLM credentials, returns answer + sources + trace |
| `fetchSessions()`        | `GET /sessions`              | Loads session list for the sidebar                                      |
| `fetchSessionMessages()` | `GET /session/{id}/messages` | Loads chat history when switching sessions                              |
| `deleteSession()`        | `DELETE /session/{id}`       | Removes a single session                                                |
| `clearAllSessions()`     | `DELETE /sessions`           | Clears all sessions (called on page load)                               |

### Message Cache

The frontend maintains an in-memory cache (`React useRef<Map>`) keyed by session ID. When switching between sessions, cached messages — with their attached sources and traces — are restored instantly without re-fetching. The backend only stores plain message text; sources and execution traces are frontend-only enrichments attached at query response time.

---

## Development

```bash
# Install dependencies
npm install

# Start dev server (proxies API to backend at localhost:8000)
npm run dev

# Build for production
npm run build
```

---

## Project Structure

```
stripe-rag-frontend/
├── Dockerfile                   # Multi-stage: Node build → nginx serve
├── nginx.conf                   # Reverse proxy config (API → backend:8000)
├── vite.config.ts               # Vite configuration
├── package.json
├── screenshots/                 # UI screenshots for documentation
└── src/
    ├── App.tsx                  # Main layout: Sidebar + ChatArea + right panel
    ├── api.ts                   # All backend API calls
    ├── types.ts                 # TypeScript interfaces matching backend Pydantic models
    ├── main.tsx                 # React entry point
    └── components/
        ├── Sidebar.tsx          # Session list + LLM config
        ├── ChatArea.tsx         # Message bubbles + input
        ├── MessageBubble.tsx    # Individual message with source/trace buttons
        ├── SourcePanel.tsx      # Retrieved chunks + similarity scores
        ├── TracePanel.tsx       # Graph execution trace viewer
        ├── ApiKeyInput.tsx      # Secure API key input
        └── LlmConfigInput.tsx   # Provider/model selection
```
