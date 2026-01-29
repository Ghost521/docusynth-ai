import React, { useState, useEffect } from "react";
import { Icons } from "./Icon";

// ===============================================================
// Types
// ===============================================================

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPromptProps {
  variant?: "banner" | "modal" | "minimal";
  onDismiss?: () => void;
}

// ===============================================================
// Component
// ===============================================================

export function InstallPrompt({
  variant = "banner",
  onDismiss,
}: InstallPromptProps): JSX.Element | null {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Check if already installed
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isInWebAppiOS);

    // Check dismissal
    const dismissed = localStorage.getItem("docu_synth_install_dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
      }
    }
  }, []);

  // Listen for install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleShowInstall = () => {
      setShowModal(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("showInstallPrompt", handleShowInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("showInstallPrompt", handleShowInstall);
    };
  }, []);

  // Handle install
  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Show manual instructions
      setShowModal(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error("Failed to install:", error);
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("docu_synth_install_dismissed", Date.now().toString());
    onDismiss?.();
  };

  // Don't show if installed or dismissed
  if (isInstalled || isDismissed) return null;

  // Detect platform for instructions
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);

  // Banner variant
  if (variant === "banner" && !showModal) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-surface border-t border-border shadow-xl animate-slideUp">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Icons.Smartphone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-main">Install DocuSynth AI</p>
              <p className="text-sm text-secondary">
                Get the full experience with offline access and instant loading
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-sm text-secondary hover:text-main transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-2"
            >
              <Icons.Download className="w-4 h-4" />
              Install
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Minimal variant
  if (variant === "minimal" && !showModal) {
    return (
      <button
        onClick={handleInstall}
        className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
      >
        <Icons.Download className="w-4 h-4" />
        Install App
      </button>
    );
  }

  // Modal (for all variants when triggered or modal variant)
  if (variant === "modal" || showModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-xl animate-fadeIn overflow-hidden">
          {/* Header */}
          <div className="relative p-6 pb-0 text-center">
            <button
              onClick={() => {
                setShowModal(false);
                handleDismiss();
              }}
              className="absolute top-4 right-4 p-2 text-secondary hover:text-main transition-colors"
            >
              <Icons.X className="w-5 h-5" />
            </button>

            <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Icons.Sparkles className="w-10 h-10 text-primary" />
            </div>

            <h2 className="text-xl font-bold text-main">Install DocuSynth AI</h2>
            <p className="text-secondary mt-2">
              Add to your home screen for the best experience
            </p>
          </div>

          {/* Benefits */}
          <div className="p-6 space-y-3">
            {[
              { icon: Icons.WifiOff, text: "Works offline" },
              { icon: Icons.Zap, text: "Faster loading" },
              { icon: Icons.Bell, text: "Push notifications" },
              { icon: Icons.Smartphone, text: "Native app experience" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-main">{text}</span>
              </div>
            ))}
          </div>

          {/* Platform-specific instructions */}
          {!deferredPrompt && (
            <div className="px-6 pb-6">
              <div className="p-4 bg-background rounded-lg border border-border">
                <p className="text-sm font-medium text-main mb-2">
                  Installation Instructions
                </p>
                {isIOS && (
                  <div className="text-sm text-secondary space-y-2">
                    <p>1. Tap the <strong>Share</strong> button in Safari</p>
                    <p>2. Scroll down and tap <strong>"Add to Home Screen"</strong></p>
                    <p>3. Tap <strong>"Add"</strong> in the top right</p>
                  </div>
                )}
                {isAndroid && isChrome && (
                  <div className="text-sm text-secondary space-y-2">
                    <p>1. Tap the <strong>menu</strong> button (three dots)</p>
                    <p>2. Tap <strong>"Add to Home screen"</strong></p>
                    <p>3. Tap <strong>"Add"</strong></p>
                  </div>
                )}
                {isAndroid && isFirefox && (
                  <div className="text-sm text-secondary space-y-2">
                    <p>1. Tap the <strong>menu</strong> button (three dots)</p>
                    <p>2. Tap <strong>"Install"</strong></p>
                  </div>
                )}
                {!isIOS && !isAndroid && isChrome && (
                  <div className="text-sm text-secondary space-y-2">
                    <p>1. Click the <strong>install icon</strong> in the address bar</p>
                    <p>2. Or click menu (three dots) &gt; <strong>"Install DocuSynth AI"</strong></p>
                  </div>
                )}
                {isSafari && !isIOS && (
                  <div className="text-sm text-secondary space-y-2">
                    <p>Safari on Mac doesn't support PWA installation.</p>
                    <p>Please use Chrome or Edge for the best experience.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => {
                setShowModal(false);
                handleDismiss();
              }}
              className="flex-1 py-3 bg-surface border border-border rounded-lg text-sm font-medium text-main hover:bg-surface-hover transition-colors"
            >
              Maybe Later
            </button>
            {deferredPrompt && (
              <button
                onClick={handleInstall}
                className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
              >
                <Icons.Download className="w-4 h-4" />
                Install Now
              </button>
            )}
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
  @keyframes slideUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  .animate-slideUp {
    animation: slideUp 0.3s ease-out;
  }
`;
if (typeof document !== "undefined" && !document.getElementById("install-prompt-styles")) {
  style.id = "install-prompt-styles";
  document.head.appendChild(style);
}

export default InstallPrompt;
