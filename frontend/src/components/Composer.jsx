import { useRef, useState } from "react";
import {
  Paperclip,
  Mic,
  Send,
  Square,
  X,
} from "lucide-react";

export default function Composer({
  value,
  onChange,
  onSend,
  generating,
  onStop,
  model,
  onModelChange,
}) {
  const fileInputRef = useRef(null);
  const [attachment, setAttachment] = useState(null);

  const safeValue =
    value === null || value === undefined
      ? ""
      : String(value);

  function handleChange(e) {
    onChange?.(e.target.value);
  }

  function handleKeyDown(e) {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.isComposing
    ) {
      e.preventDefault();

      if (generating) return;

      if (!safeValue.trim() && !attachment?.file) {
        return;
      }

      onSend?.(safeValue, attachment);
    }
  }

  function handleSend() {
    if (generating) {
      onStop?.();
      return;
    }

    if (!safeValue.trim() && !attachment?.file) {
      return;
    }

    onSend?.(safeValue, attachment);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    setAttachment({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    });

    e.target.value = "";
  }

  function removeAttachment() {
    setAttachment(null);
  }

  function handleVoice() {
    window.dispatchEvent(
      new Event("aura-voice")
    );
  }

  const canSend =
    safeValue.trim().length > 0 ||
    !!attachment?.file;

  return (
    <div className="composer">

      {/* ATTACHMENT */}
      {attachment && (
        <div className="attachment-preview">
          <div className="attachment-info">
            <Paperclip size={14} />
            <span title={attachment.name}>
              {attachment.name}
            </span>
          </div>

          <button
            type="button"
            onClick={removeAttachment}
            aria-label="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* MAIN COMPOSER */}
      <div className="composer-box">

        <textarea
          value={safeValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            generating
              ? "AURA is thinking..."
              : "Message AURA..."
          }
          rows={1}
          spellCheck
          autoComplete="off"
          aria-label="Message AURA"
        />

        <div className="composer-actions">

          {/* LEFT */}
          <div className="composer-left">

            <button
              type="button"
              className="composer-btn"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={generating}
              title="Attach file"
              aria-label="Attach file"
            >
              <Paperclip size={18} />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={handleFileChange}
              accept=".txt,.pdf,.doc,.docx,.md,.csv,.json,.js,.jsx,.ts,.tsx,.html,.css"
            />

            <button
              type="button"
              className="composer-btn"
              onClick={handleVoice}
              disabled={generating}
              title="Voice input"
              aria-label="Voice input"
            >
              <Mic size={18} />
            </button>

          </div>

          {/* RIGHT */}
          <div className="composer-right">

            {model && (
              <select
                value={model}
                onChange={(e) =>
                  onModelChange?.(
                    e.target.value
                  )
                }
                className="model-select"
                disabled={generating}
                aria-label="AI model"
              >
                <option value={model}>
                  {model}
                </option>
              </select>
            )}

            <button
              type="button"
              className={`send-btn ${
                generating ? "stop" : ""
              }`}
              onClick={handleSend}
              disabled={
                !generating && !canSend
              }
              title={
                generating
                  ? "Stop generation"
                  : "Send message"
              }
              aria-label={
                generating
                  ? "Stop generation"
                  : "Send message"
              }
            >
              {generating ? (
                <Square
                  size={15}
                  fill="currentColor"
                />
              ) : (
                <Send size={17} />
              )}
            </button>

          </div>
        </div>
      </div>

      {/* HINT */}
      <div className="composer-hint">
        <span>Enter to send</span>
        <span>Shift + Enter for new line</span>
      </div>

    </div>
  );
}