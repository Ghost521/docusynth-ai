import { useState, useEffect, useCallback, useRef } from "react";

// ===============================================================
// Types
// ===============================================================

export type ServiceWorkerStatus =
  | "unsupported"
  | "installing"
  | "installed"
  | "activating"
  | "activated"
  | "redundant"
  | "error";

export interface UseServiceWorkerReturn {
  // Status
  status: ServiceWorkerStatus;
  isSupported: boolean;
  isInstalled: boolean;
  isActivated: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
  error: string | null;

  // Actions
  update: () => Promise<void>;
  skipWaiting: () => void;
  unregister: () => Promise<boolean>;
  checkForUpdates: () => Promise<void>;
}

// ===============================================================
// Hook Implementation
// ===============================================================

export function useServiceWorker(): UseServiceWorkerReturn {
  // State
  const [status, setStatus] = useState<ServiceWorkerStatus>("unsupported");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mountedRef = useRef(true);

  // Check if service workers are supported
  const isSupported = "serviceWorker" in navigator;

  // Update status based on registration
  const updateStatus = useCallback((reg: ServiceWorkerRegistration | null) => {
    if (!reg) {
      setStatus("unsupported");
      return;
    }

    if (reg.installing) {
      setStatus("installing");
    } else if (reg.waiting) {
      setStatus("installed");
      setIsUpdateAvailable(true);
    } else if (reg.active) {
      setStatus("activated");
    }
  }, []);

  // Register service worker
  useEffect(() => {
    if (!isSupported) {
      setStatus("unsupported");
      return;
    }

    mountedRef.current = true;

    const registerSW = async () => {
      try {
        // Register the service worker
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (!mountedRef.current) return;

        setRegistration(reg);
        updateStatus(reg);

        // Listen for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (!mountedRef.current) return;

              switch (newWorker.state) {
                case "installing":
                  setStatus("installing");
                  break;
                case "installed":
                  setStatus("installed");
                  if (reg.active) {
                    // New version available
                    setIsUpdateAvailable(true);
                  }
                  break;
                case "activating":
                  setStatus("activating");
                  break;
                case "activated":
                  setStatus("activated");
                  setIsUpdateAvailable(false);
                  break;
                case "redundant":
                  setStatus("redundant");
                  break;
              }
            });
          }
        });

        // Check if there's already a waiting worker
        if (reg.waiting) {
          setIsUpdateAvailable(true);
        }

        // Listen for controller change (after skipWaiting)
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (mountedRef.current) {
            setStatus("activated");
            setIsUpdateAvailable(false);
          }
        });

        console.log("[useServiceWorker] Service worker registered");
      } catch (err) {
        console.error("[useServiceWorker] Registration failed:", err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Registration failed");
          setStatus("error");
        }
      }
    };

    registerSW();

    return () => {
      mountedRef.current = false;
    };
  }, [isSupported, updateStatus]);

  // Update service worker
  const update = useCallback(async () => {
    if (!registration) return;

    try {
      await registration.update();
      console.log("[useServiceWorker] Checked for updates");
    } catch (err) {
      console.error("[useServiceWorker] Update check failed:", err);
      setError(err instanceof Error ? err.message : "Update check failed");
    }
  }, [registration]);

  // Skip waiting and activate new worker
  const skipWaiting = useCallback(() => {
    if (!registration?.waiting) return;

    // Send skip waiting message to the waiting worker
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }, [registration]);

  // Unregister service worker
  const unregister = useCallback(async (): Promise<boolean> => {
    if (!registration) return false;

    try {
      const result = await registration.unregister();
      if (result) {
        setRegistration(null);
        setStatus("unsupported");
        console.log("[useServiceWorker] Unregistered");
      }
      return result;
    } catch (err) {
      console.error("[useServiceWorker] Unregister failed:", err);
      setError(err instanceof Error ? err.message : "Unregister failed");
      return false;
    }
  }, [registration]);

  // Check for updates manually
  const checkForUpdates = useCallback(async () => {
    await update();
  }, [update]);

  // Computed values
  const isInstalled = ["installed", "activating", "activated"].includes(status);
  const isActivated = status === "activated";

  return {
    // Status
    status,
    isSupported,
    isInstalled,
    isActivated,
    isUpdateAvailable,
    registration,
    error,

    // Actions
    update,
    skipWaiting,
    unregister,
    checkForUpdates,
  };
}

export default useServiceWorker;
