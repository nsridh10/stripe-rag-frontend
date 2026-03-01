import { useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import type { ChatMessage, ToolCallSource, ExecutionTrace } from "../types";
import MessageBubble from "./MessageBubble";
import "./ChatArea.css";

interface Props {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  onSelectMessage: (msg: ChatMessage) => void;
  selectedMessageId: string | null;
}

export default function ChatArea({
  messages,
  input,
  setInput,
  onSend,
  isLoading,
  onSelectMessage,
  selectedMessageId,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <main className="chat-area">
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome">
            <Sparkles size={40} className="welcome-icon" />
            <h2>Stripe API Assistant</h2>
            <p>Ask me anything about the Stripe API documentation.</p>
            <div className="suggestions">
              {[
                "How do I create a customer?",
                "What are payment intents?",
                "How do subscriptions work?",
                "How to issue a refund?",
              ].map((q) => (
                <button
                  key={q}
                  className="suggestion-chip"
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isSelected={msg.id === selectedMessageId}
            onClick={() => msg.role === "assistant" && onSelectMessage(msg)}
          />
        ))}

        {isLoading && (
          <div className="typing-indicator">
            <Loader2 size={16} className="spin" />
            <span>Thinking...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Stripe APIs..."
            rows={1}
            disabled={isLoading}
          />
          <button
            className="send-btn"
            onClick={onSend}
            disabled={!input.trim() || isLoading}
          >
            <Send size={16} />
          </button>
        </div>
        <div className="input-hint">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </main>
  );
}
