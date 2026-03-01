import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot, FileText } from "lucide-react";
import type { ChatMessage } from "../types";
import "./MessageBubble.css";

interface Props {
  message: ChatMessage;
  isSelected: boolean;
  onClick: () => void;
}

export default function MessageBubble({ message, isSelected, onClick }: Props) {
  const isUser = message.role === "user";
  const hasSources = message.sources && message.sources.length > 0;

  return (
    <div
      className={`message ${isUser ? "user" : "assistant"} ${isSelected ? "selected" : ""}`}
    >
      <div className="message-avatar">
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className="message-body" onClick={!isUser ? onClick : undefined}>
        {isUser ? (
          <div className="message-text user-text">{message.content}</div>
        ) : (
          <div className="message-text assistant-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {hasSources && (
          <div className="source-badges">
            <FileText size={12} />
            {message.sources!.map((s, i) => (
              <span key={i} className="source-badge">
                {s.api_class} {s.version}
              </span>
            ))}
            <span className="view-details" onClick={onClick}>
              View details →
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
