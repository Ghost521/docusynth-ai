import React, { useState, useEffect } from "react";
import { Icons } from "./Icon";
import { useServiceWorker } from "../hooks/useServiceWorker";

// ===============================================================
// Types
// ===============================================================

interface UpdateAvailableProps {
  variant?: "toast" | "banner" | "modal";
  autoShow?: boolean;
  onUpdate?: () => void;
  onDismiss?: () => void;
}

// ===============================================================
// Component
// ===============================================================

export function UpdateAvailable({
  variant = "toast",
  autoShow = true,
  onUpdate,
  onDismiss,
}: UpdateAvailableProps): JSX.Element | null {
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const sw = useServiceWorker();

  // Show when update is available
  useEffect(() => {
    if (autoShow && sw.isUpdateAvailable) {
      // Small delay to avoid flash
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [autoShow, sw.isUpdateAvailable]);

  // Handle update
  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      sw.skipWaiting();
      onUpdate?.();

      // Wait for controller change then reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Failed to update:", error);
      setIsUpdating(false);
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible || !sw.isUpdateAvailable) return null;

  // Toast variant
  if (variant === "toast") {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-fadeIn">
        <div className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl shadow-xl">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icons.RefreshCw className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-main">Update Available</p>
            <p className="text-sm text-secondary">
              A new version of DocuSynth AI is ready
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleDismiss}
              className="p-2 text-secondary hover:text-main transition-colors"
            >
              <Icons.X className="w-4 h-4" />
            </button>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isUpdating ? (
                <>
                  <Icons.Loader className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Banner variant
  if (variant === "banner") {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-white px-4 py-3 animate-slideDown">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icons.Sparkles className="w-5 h-5" />
            <p className="font-medium">
              A new version of DocuSynth AI is available
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white transition-colors text-sm"
            >
              Later
            </button>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="px-4 py-1.5 bg-white text-primary rounded-lg text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isUpdating ? (
                <>
                  <Icons.Loader className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Icons.RefreshCw className="w-4 h-4" />
                  Update Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modal variant
  if (variant === "modal") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-xl animate-fadeIn overflow-hidden">
          {/* Header */}
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Icons.Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-main">Update Available</h2>
            <p className="text-secondary mt-2">
              A new version of DocuSynth AI is ready to install
            </p>
          </div>

          {/* What's New */}
          <div className="px-6 pb-6">
            <div className="p-4 bg-background rounded-lg border border-border">
              <p className="text-sm font-medium text-main mb-2">What's New</p>
              <ul className="text-sm text-secondary space-y-1">
                <li className="flex items-center gap-2">
                  <Icons.Check className="w-4 h-4 text-primary" />
                  Performance improvements
                </li>
                <li className="flex items-center gap-2">
                  <Icons.Check className="w-4 h-4 text-primary" />
                  Bug fixes and stability
                </li>
                <li className="flex items-center gap-2">
                  <Icons.Check className="w-4 h-4 text-primary" />
                  Enhanced offline support
                </li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-3 bg-surface border border-border rounded-lg text-sm font-medium text-main hover:bg-surface-hover transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUpdating ? (
                <>
                  <Icons.Loader className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Icons.RefreshCw className="w-4 h-4" />
                  Update Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ===============================================================
// Stylesheet (add animation)
// ===============================================================

const style = document.createElement("style");
style.textContent = `
  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  .animate-slideDown {
    animation: slideDown 0.3s ease-out;
  }
`;
if (typeof document !== "undefined" && !document.getElementById("update-styles")) {
  style.id = "update-styles";
  document.head.appendChild(style);
}

export default UpdateAvailable;
