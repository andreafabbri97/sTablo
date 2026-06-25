"use client";

/**
 * Lightweight toast system. Mount <ToastProvider> once near the app root, then
 * call useToast() anywhere below it. Toasts auto-dismiss and stack at the bottom
 * (above the mobile bottom-nav). No external dependency.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
type ToastInput = { message: string; tone?: ToastTone; duration?: number };
type Toast = { id: number; message: string; tone: ToastTone };

type ToastApi = {
  show: (input: ToastInput) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const DEFAULT_DURATION = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    ({ message, tone = "info", duration = DEFAULT_DURATION }: ToastInput) => {
      const id = (idRef.current += 1);
      setToasts((list) => [...list, { id, message, tone }]);
      if (duration > 0) setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show({ message, tone: "success" }),
      error: (message) => show({ message, tone: "error" }),
      info: (message) => show({ message, tone: "info" }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve stare dentro <ToastProvider>");
  return ctx;
}

const TONES: Record<
  ToastTone,
  { box: string; icon: string; glyph: React.ReactNode }
> = {
  success: {
    box: "border-win/30",
    icon: "text-win",
    glyph: <CheckCircle2 className="h-5 w-5" />,
  },
  error: {
    box: "border-loss/30",
    icon: "text-loss",
    glyph: <XCircle className="h-5 w-5" />,
  },
  info: {
    box: "border-border",
    icon: "text-brand",
    glyph: <Info className="h-5 w-5" />,
  },
};

function ToastViewport({
  toasts,
  onClose,
}: {
  toasts: Toast[];
  onClose: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const tone = TONES[toast.tone];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur transition-all duration-200",
        tone.box,
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", tone.icon)}>{tone.glyph}</span>
      <p className="flex-1 text-sm font-medium text-foreground">
        {toast.message}
      </p>
      <button
        onClick={onClose}
        aria-label="Chiudi"
        className="shrink-0 text-muted transition hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
