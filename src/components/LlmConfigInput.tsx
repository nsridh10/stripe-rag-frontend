import { useState } from "react";
import { Settings, Eye, EyeOff, Check, X, ChevronDown } from "lucide-react";
import "./LlmConfigInput.css";

interface Props {
  provider: string;
  model: string;
  apiKey: string;
  onConfigChange: (provider: string, model: string, apiKey: string) => void;
}

const LLM_OPTIONS = {
  groq: {
    name: "Groq",
    models: ["llama-3.3-70b-versatile"],
    keyPrefix: "gsk_",
    getKeyUrl: "https://console.groq.com/keys",
  },
  gemini: {
    name: "Gemini (Google)",
    models: ["gemini-flash-latest"],
    keyPrefix: "AIza",
    getKeyUrl: "https://aistudio.google.com/apikey",
  },
};

export default function LlmConfigInput({
  provider,
  model,
  apiKey,
  onConfigChange,
}: Props) {
  const [isEditing, setIsEditing] = useState(!apiKey);

  // Ensure provider is valid, fallback to "groq" if not
  const validProvider = LLM_OPTIONS[provider as keyof typeof LLM_OPTIONS]
    ? provider
    : "groq";
  const validModel = LLM_OPTIONS[
    validProvider as keyof typeof LLM_OPTIONS
  ]?.models.includes(model)
    ? model
    : LLM_OPTIONS[validProvider as keyof typeof LLM_OPTIONS]?.models[0] ||
      "llama-3.3-70b-versatile";

  const [tempProvider, setTempProvider] = useState(validProvider);
  const [tempModel, setTempModel] = useState(validModel);
  const [tempKey, setTempKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  const currentProviderConfig =
    LLM_OPTIONS[tempProvider as keyof typeof LLM_OPTIONS] || LLM_OPTIONS.groq;

  const handleSave = () => {
    onConfigChange(tempProvider, tempModel, tempKey);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempProvider(provider);
    setTempModel(model);
    setTempKey(apiKey);
    setIsEditing(false);
  };

  const handleProviderChange = (newProvider: string) => {
    setTempProvider(newProvider);
    // Auto-select first model for new provider
    const providerConfig = LLM_OPTIONS[newProvider as keyof typeof LLM_OPTIONS];
    if (providerConfig) {
      setTempModel(providerConfig.models[0]);
    }
  };

  if (!isEditing && apiKey) {
    return (
      <div className="llm-config-display">
        <div className="config-summary">
          <Settings size={14} className="config-icon" />
          <div className="config-details">
            <span className="provider-name">
              {LLM_OPTIONS[provider as keyof typeof LLM_OPTIONS]?.name ||
                provider}
            </span>
            <span className="model-name">{model}</span>
          </div>
        </div>
        <button
          className="edit-config-btn"
          onClick={() => setIsEditing(true)}
          title="Edit LLM Configuration"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="llm-config-input-container">
      <div className="config-header">
        <Settings size={14} />
        <span>LLM Configuration</span>
      </div>

      <div className="config-section">
        <label className="config-label">Provider</label>
        <div className="select-wrapper">
          <select
            className="config-select"
            value={tempProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            {Object.entries(LLM_OPTIONS).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="select-icon" />
        </div>
      </div>

      <div className="config-section">
        <label className="config-label">Model</label>
        <div className="select-wrapper">
          <select
            className="config-select"
            value={tempModel}
            onChange={(e) => setTempModel(e.target.value)}
          >
            {currentProviderConfig?.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="select-icon" />
        </div>
      </div>

      <div className="config-section">
        <label className="config-label">API Key</label>
        <div className="api-key-input-row">
          <input
            type={showKey ? "text" : "password"}
            className="config-input"
            value={tempKey}
            onChange={(e) => setTempKey(e.target.value)}
            placeholder={`${currentProviderConfig?.keyPrefix}...`}
            autoFocus={!tempKey}
          />
          <button
            className="key-action-btn"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div className="config-actions">
        <button
          className="save-config-btn"
          onClick={handleSave}
          disabled={!tempProvider || !tempModel || !tempKey}
        >
          <Check size={14} />
          Save
        </button>
        {apiKey && (
          <button className="cancel-config-btn" onClick={handleCancel}>
            <X size={14} />
            Cancel
          </button>
        )}
      </div>

      <div className="config-hint">
        Don't have a key?{" "}
        <a
          href={currentProviderConfig?.getKeyUrl}
          target="_blank"
          rel="noopener"
        >
          Get one free →
        </a>
      </div>
    </div>
  );
}
