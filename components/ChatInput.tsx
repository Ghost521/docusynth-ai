import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Icons } from "./Icon";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  suggestedQuestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  maxLength?: number;
  showTokenCount?: boolean;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSubmit,
  isLoading = false,
  placeholder = "Ask a question...",
  suggestedQuestions = [],
  onSuggestionClick,
  maxLength = 10000,
  showTokenCount = false,
  disabled = false,
}) => {
  const [message, setMessage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [message]);

  // Focus on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = () => {
    if (!message.trim() || isLoading || disabled) return;
    onSubmit(message.trim());
    setMessage("");
    setShowSuggestions(false);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (onSuggestionClick) {
      onSuggestionClick(suggestion);
    } else {
      setMessage(suggestion);
      textareaRef.current?.focus();
    }
    setShowSuggestions(false);
  };

  // Estimate tokens (rough approximation)
  const estimatedTokens = Math.ceil(message.length / 4);

  return (
    <div className="border-t border-border bg-surface-hover/20 p-4">
      {/* Suggested questions */}
      {showSuggestions && suggestedQuestions.length > 0 && !message && (
        <div className="mb-3">
          <p className="text-[10px] text-secondary mb-2 flex items-center gap-1.5">
            <Icons.Sparkles className="w-3 h-3" />
            Suggested questions
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.slice(0, 4).map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-secondary hover:text-main hover:border-primary/50 transition-all hover:shadow-sm"
                disabled={disabled}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            rows={1}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: "48px", maxHeight: "200px" }}
          />

          {/* Character/token counter */}
          {(message.length > 0 || showTokenCount) && (
            <div className="absolute right-3 bottom-1 text-[9px] text-secondary">
              {showTokenCount && (
                <span className="mr-2">~{estimatedTokens} tokens</span>
              )}
              <span>
                {message.length}/{maxLength}
              </span>
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || isLoading || disabled}
          className="p-3 bg-primary text-white rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 flex-shrink-0"
          title={isLoading ? "Sending..." : "Send message (Enter)"}
        >
          {isLoading ? (
            <Icons.Loader className="w-5 h-5 animate-spin" />
          ) : (
            <Icons.ArrowRight className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-secondary">
          Press <kbd className="px-1 py-0.5 bg-background rounded text-[9px]">Enter</kbd> to send,{" "}
          <kbd className="px-1 py-0.5 bg-background rounded text-[9px]">Shift+Enter</kbd> for new line
        </p>
        {message.length > maxLength * 0.9 && (
          <p className="text-[10px] text-amber-500">
            Approaching character limit
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
