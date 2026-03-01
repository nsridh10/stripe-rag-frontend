import { useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  X,
  Route,
  Clock,
  Zap,
} from "lucide-react";
import type { ExecutionTrace } from "../types";
import "./TracePanel.css";

interface Props {
  trace: ExecutionTrace;
  onClose: () => void;
}

export default function TracePanel({ trace, onClose }: Props) {
  const [showNodes, setShowNodes] = useState(true);
  const [showRouting, setShowRouting] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  return (
    <div className="trace-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Activity size={16} />
          <span>Execution Trace</span>
        </div>
        <button className="close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="panel-content">
        {/* Summary bar */}
        <div className="trace-summary">
          <div className="trace-stat">
            <Clock size={13} />
            <span>{(trace.total_duration_ms / 1000).toFixed(2)}s</span>
          </div>
          <div className="trace-stat">
            <Zap size={13} />
            <span>
              {trace.tool_call_budget_used}/{trace.tool_call_budget_max} tools
            </span>
          </div>
          <div className="trace-stat">
            <Route size={13} />
            <span>{trace.nodes_executed.length} nodes</span>
          </div>
        </div>

        {/* Nodes */}
        <div className="trace-section">
          <div
            className="section-header"
            onClick={() => setShowNodes(!showNodes)}
          >
            {showNodes ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Node Executions ({trace.nodes_executed.length})</span>
          </div>
          {showNodes && (
            <div className="section-body">
              {trace.nodes_executed.map((node, i) => (
                <NodeCard key={i} node={node} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Routing */}
        <div className="trace-section">
          <div
            className="section-header"
            onClick={() => setShowRouting(!showRouting)}
          >
            {showRouting ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            <span>Routing Decisions ({trace.routing_decisions.length})</span>
          </div>
          {showRouting && (
            <div className="section-body">
              {trace.routing_decisions.map((rd, i) => (
                <div key={i} className="routing-card">
                  <div className="routing-flow">
                    <span className="routing-node">{rd.from_node}</span>
                    <span className="routing-arrow">→</span>
                    <span className="routing-node">{rd.to_node}</span>
                  </div>
                  <div className="routing-reason">{rd.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plan */}
        {trace.plan.length > 0 && (
          <div className="trace-section">
            <div
              className="section-header"
              onClick={() => setShowPlan(!showPlan)}
            >
              {showPlan ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <span>Retrieval Plan ({trace.plan.length} calls)</span>
            </div>
            {showPlan && (
              <div className="section-body">
                {trace.plan.map((p, i) => (
                  <div key={i} className="plan-card">
                    <span className="plan-api">
                      {String(p.api_class || "?")}
                    </span>
                    <span className="plan-version">
                      {String(p.version || "?")}
                    </span>
                    <span className="plan-query">{String(p.query || "?")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NodeCard({
  node,
  index,
}: {
  node: {
    node: string;
    duration_ms: number;
    input_details: Record<string, unknown>;
    output_details: Record<string, unknown>;
  };
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const colorMap: Record<string, string> = {
    planner: "#635bff",
    budget_checker: "#f59e0b",
    executor: "#22c55e",
    tools: "#06b6d4",
    query_expander: "#a855f7",
    restructurer: "#ec4899",
    synthesizer: "#10b981",
  };

  const color = colorMap[node.node] || "#6a6a80";

  return (
    <div className="node-card">
      <div className="node-header" onClick={() => setExpanded(!expanded)}>
        <div className="node-info">
          <span className="node-index">{index + 1}</span>
          <span className="node-name" style={{ color }}>
            {node.node}
          </span>
        </div>
        <span className="node-duration">{node.duration_ms.toFixed(0)}ms</span>
      </div>
      {expanded && (
        <div className="node-details">
          {Object.keys(node.input_details).length > 0 && (
            <div className="detail-block">
              <div className="detail-block-label">Input</div>
              <pre className="detail-json">
                {JSON.stringify(node.input_details, null, 2)}
              </pre>
            </div>
          )}
          {Object.keys(node.output_details).length > 0 && (
            <div className="detail-block">
              <div className="detail-block-label">Output</div>
              <pre className="detail-json">
                {JSON.stringify(node.output_details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
