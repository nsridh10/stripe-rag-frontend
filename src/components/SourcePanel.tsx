import { FileText, ChevronDown, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import type { ToolCallSource } from "../types";
import "./SourcePanel.css";

interface Props {
  sources: ToolCallSource[];
  onClose: () => void;
}

export default function SourcePanel({ sources, onClose }: Props) {
  return (
    <div className="source-panel">
      <div className="panel-header">
        <div className="panel-title">
          <FileText size={16} />
          <span>Source Documents</span>
          <span className="count-badge">{sources.length}</span>
        </div>
        <button className="close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="panel-content">
        {sources.map((src, i) => (
          <SourceCard key={i} source={src} />
        ))}
        {sources.length === 0 && (
          <div className="empty-panel">
            No sources retrieved for this response.
          </div>
        )}
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: ToolCallSource }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="source-card">
      <div
        className="source-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="expand-icon">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="source-info">
          <span className="api-badge">{source.api_class}</span>
          <span className="version-badge">{source.version}</span>
          <span className={`status-dot ${source.status}`} />
        </div>
      </div>

      {expanded && (
        <div className="source-card-body">
          <div className="source-detail">
            <span className="detail-label">Query</span>
            <span className="detail-value">{source.query}</span>
          </div>
          <div className="source-detail">
            <span className="detail-label">File</span>
            <span className="detail-value mono">{source.source_file}</span>
          </div>

          {source.chunks.length > 0 && (
            <div className="chunks-section">
              <div className="chunks-label">
                Retrieved Chunks ({source.chunks.length})
              </div>
              {source.chunks.map((chunk, j) => (
                <div key={j} className="chunk-card">
                  <div className="chunk-header">
                    <span className="chunk-score">
                      {(chunk.similarity_score * 100).toFixed(1)}% match
                    </span>
                    {chunk.source_file && (
                      <span className="chunk-file">{chunk.source_file}</span>
                    )}
                  </div>
                  <div className="chunk-content">{chunk.content_preview}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
