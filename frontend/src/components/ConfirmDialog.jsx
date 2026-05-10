import { useCallback, useState } from "react";
import { ConfirmContext } from "./confirmContext";

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({
        title: options.title || "Are you sure?",
        message: options.message || "",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        tone: options.tone || "default",
        resolve,
      });
    });
  }, []);

  function handleClose(value) {
    if (state) state.resolve(value);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleClose(false);
          }}
        >
          <div className={`confirm-dialog tone-${state.tone}`}>
            <h2 id="confirm-title">{state.title}</h2>
            {state.message && <p className="muted">{state.message}</p>}

            <div className="confirm-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleClose(false)}
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                className={
                  state.tone === "danger" ? "danger-button" : "primary-button"
                }
                onClick={() => handleClose(true)}
                autoFocus
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

