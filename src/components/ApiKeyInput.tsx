import { useState } from "react";
import { Key, Eye, EyeOff, Check, X } from "lucide-react";
import "./ApiKeyInput.css";

interface Props {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function ApiKeyInput({ apiKey, onApiKeyChange }: Props) {
  const [isEditing, setIsEditing] = useState(!apiKey);
  const [tempKey, setTempKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    onApiKeyChange(tempKey);
    setIsEditing(false);
    // Save to localStorage
    if (tempKey) {
      localStorage.setItem("groq_api_key", tempKey);
    } else {
      localStorage.removeItem("groq_api_key");
    }
  };

  const handleCancel = () => {
    setTempKey(apiKey);
    setIsEditing(false);
  };

  if (!isEditing && apiKey) {
    return (
      <div className={`api-key-display ${showKey ? "expanded" : ""}`}>
        <Key size={14} className="key-icon" />
        <span
          className="key-preview"
          title={showKey ? "Click to copy" : undefined}
          onClick={
            showKey ? () => navigator.clipboard.writeText(apiKey) : undefined
          }
        >
          {showKey ? apiKey : `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`}
        </span>
        <div className="key-actions">
          <button
            className="key-action-btn"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? "Hide" : "Show"}
          >
            {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button
            className="key-action-btn"
            onClick={() => setIsEditing(true)}
            title="Edit"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="api-key-input-container">
      <div className="api-key-header">
        <Key size={14} />
        <span>Groq API Key</span>
      </div>
      <div className="api-key-input-row">
        <input
          type={showKey ? "text" : "password"}
          className="api-key-input"
          value={tempKey}
          onChange={(e) => setTempKey(e.target.value)}
          placeholder="gsk_..."
          autoFocus
        />
        <button className="key-action-btn" onClick={() => setShowKey(!showKey)}>
          {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div className="api-key-actions">
        <button className="save-key-btn" onClick={handleSave}>
          <Check size={14} />
          Save
        </button>
        {apiKey && (
          <button className="cancel-key-btn" onClick={handleCancel}>
            <X size={14} />
            Cancel
          </button>
        )}
      </div>
      <div className="api-key-hint">
        Don't have a key?{" "}
        <a href="https://console.groq.com/keys" target="_blank" rel="noopener">
          Create one free at console.groq.com →
        </a>
      </div>
    </div>
  );
}
