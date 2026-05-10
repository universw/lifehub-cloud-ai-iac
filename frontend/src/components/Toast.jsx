import { useCallback, useEffect, useRef, useState } from "react";
import { ToastContext } from "./toastContext";

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (type, message, options = {}) => {
      const id = nextId;
      nextId += 1;

      setToasts((current) => [
        ...current,
        { id, type, message, title: options.title },
      ]);

      const duration = options.duration ?? (type === "error" ? 6000 : 3500);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);

      return id;
    },
    [dismiss]
  );

  const value = {
    success: (message, options) => push("success", message, options),
    error: (message, options) => push("error", message, options),
    info: (message, options) => push("info", message, options),
    dismiss,
  };

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toast-stack" role="region" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-icon" aria-hidden="true">
              {toast.type === "success" && "✓"}
              {toast.type === "error" && "!"}
              {toast.type === "info" && "i"}
            </div>
            <div className="toast-body">
              {toast.title && <strong>{toast.title}</strong>}
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

