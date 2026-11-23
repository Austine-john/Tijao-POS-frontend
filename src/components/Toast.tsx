import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cx } from "./ui";

interface Toast {
  id: number;
  tone: "success" | "error";
  text: string;
}

const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-24 right-4 z-50 flex flex-col gap-2 md:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto rounded-md px-4 py-3 font-medium shadow-lg",
              t.tone === "success" ? "bg-ink text-white" : "bg-danger-600 text-white",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
