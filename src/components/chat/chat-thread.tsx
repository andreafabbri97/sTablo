"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
  Fragment,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Ban,
  RotateCcw,
  Loader2,
  UserCheck,
  Mic,
  X,
  Play,
  Pause,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AdminBadge } from "@/components/player/admin-badge";
import { cn, formatTime, formatDate } from "@/lib/utils";
import {
  MAX_MESSAGE_LENGTH,
  type ChatMessageView,
  type BlockState,
  type ChatPartner,
} from "@/lib/chat-core";
import {
  sendMessage,
  pollConversation,
  markConversationRead,
  getMessageAudio,
  blockUser,
  unblockUser,
} from "@/lib/actions/chat-actions";

type Props = {
  /** the viewer's own user id — decides which bubbles are "mine" */
  meId: string;
  partner: ChatPartner;
  otherSlug: string;
  initialMessages: ChatMessageView[];
  initialBlock: BlockState;
  /** the partner's read marker at first render (drives Consegnato/Letto) */
  initialPartnerReadAt: Date | null;
};

/** Delivery receipt shown under my most recent sent message. */
function receiptLabel(
  m: ChatMessageView,
  partnerReadAt: Date | null,
): string {
  if (m.id.startsWith("temp-")) return "Invio…";
  if (partnerReadAt && new Date(partnerReadAt) >= new Date(m.createdAt)) {
    return "Letto";
  }
  return "Consegnato";
}

/** m:ss for a duration in seconds. */
function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Pick a MediaRecorder mime the browser supports (Safari falls back to mp4). */
function pickAudioMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * WhatsApp-style voice-note player: play/pause, a progress bar, and the
 * remaining/total time. The audio itself is lazy — fetched (via getMessageAudio)
 * only on the first play — except on my own just-sent bubble, which already
 * carries the recorded data-URL for instant playback.
 */
function VoiceBubble({
  message,
  mine,
}: {
  message: ChatMessageView;
  mine: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const wantPlayRef = useRef(false);
  const [src, setSrc] = useState<string | null>(message.audioUrl ?? null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const total = message.audioDuration ?? 0;

  // Once the src lands and a play was requested, start it.
  useEffect(() => {
    if (src && wantPlayRef.current) {
      wantPlayRef.current = false;
      audioRef.current?.play().catch(() => {});
    }
  }, [src]);

  async function toggle() {
    const a = audioRef.current;
    if (playing) {
      a?.pause();
      return;
    }
    if (src) {
      a?.play().catch(() => {});
      return;
    }
    // Lazy-load then play.
    wantPlayRef.current = true;
    setLoading(true);
    try {
      const res = await getMessageAudio(message.id);
      if (res.ok) setSrc(res.audio);
      else wantPlayRef.current = false;
    } catch {
      wantPlayRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  const elapsed = progress * total;

  return (
    <div className="flex min-w-[170px] items-center gap-2 py-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausa" : "Riproduci vocale"}
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full transition",
          mine ? "bg-white/20 text-white hover:bg-white/30" : "bg-brand text-white hover:brightness-105",
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px]" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          className={cn(
            "h-1.5 w-full overflow-hidden rounded-full",
            mine ? "bg-white/25" : "bg-surface-2",
          )}
        >
          <div
            className={cn("h-full rounded-full", mine ? "bg-white" : "bg-brand")}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums",
            mine ? "text-white/70" : "text-muted",
          )}
        >
          {fmtDuration(playing || progress > 0 ? elapsed : total)}
        </span>
      </div>
      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : total;
          if (d > 0) setProgress(Math.min(1, el.currentTime / d));
        }}
      />
    </div>
  );
}

/** How often to poll for new messages while the tab is visible. */
const POLL_MS = 3000;

const byTime = (a: ChatMessageView, b: ChatMessageView) => {
  const dt = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  // Stable tiebreak on id so two messages in the same millisecond keep a fixed
  // order across renders/polls (no visual flicker when timestamps tie).
  return dt !== 0 ? dt : a.id.localeCompare(b.id);
};

const isoOf = (m: ChatMessageView) => new Date(m.createdAt).toISOString();

export function ChatThread({
  meId,
  partner,
  otherSlug,
  initialMessages,
  initialBlock,
  initialPartnerReadAt,
}: Props) {
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [block, setBlock] = useState<BlockState>(initialBlock);
  const [partnerReadAt, setPartnerReadAt] = useState<Date | null>(
    initialPartnerReadAt,
  );

  // Voice recording state.
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);
  const recStartRef = useRef(0);
  const recCancelRef = useRef(false);
  const recDurationRef = useRef(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef(false);
  // Cursor for incremental polling: the newest SERVER-confirmed timestamp seen.
  // Optimistic temps never advance it (their client clock can't be trusted).
  const lastSyncRef = useRef<string | null>(
    initialMessages.length ? isoOf(initialMessages[initialMessages.length - 1]) : null,
  );

  const canSend = !block.iBlocked && !block.blockedMe;

  // Id of my most recent message — the only one that carries a Consegnato/Letto
  // receipt (like iMessage; older bubbles stay clean).
  let lastMineId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].senderId === meId) {
      lastMineId = messages[i].id;
      break;
    }
  }

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView(smooth ? { behavior: "smooth" } : undefined);
  }, []);

  /** Merge server messages in, de-duped by id, kept in chronological order. */
  const mergeMessages = useCallback((incoming: ChatMessageView[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev];
      for (const m of incoming) if (!seen.has(m.id)) merged.push(m);
      return merged.sort(byTime);
    });
    for (const m of incoming) {
      const iso = isoOf(m);
      if (!lastSyncRef.current || iso > lastSyncRef.current) lastSyncRef.current = iso;
    }
  }, []);

  // First render: jump to the latest message and clear the unread marker.
  useEffect(() => {
    scrollToBottom(false);
    markConversationRead(otherSlug).catch(() => {});
  }, [otherSlug, scrollToBottom]);

  // Grow the composer with its content (capped), like a native chat input.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [text]);

  // Light polling: only when the tab is visible, with an in-flight guard so
  // slow responses can't stack up.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (document.visibilityState !== "visible" || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const res = await pollConversation(otherSlug, lastSyncRef.current);
        if (!active || !res.ok) return;
        setBlock(res.block);
        // Update the receipt every tick — the partner reading my message changes
        // nothing about the message list, only their read marker.
        setPartnerReadAt(res.partnerLastReadAt);
        if (res.messages.length) {
          const fromOther = res.messages.some((m) => m.senderId !== meId);
          const near = isNearBottom();
          mergeMessages(res.messages);
          if (fromOther) markConversationRead(otherSlug).catch(() => {});
          if (near) requestAnimationFrame(() => scrollToBottom(true));
        }
      } catch {
        // a dropped poll is harmless — the next tick recovers
      } finally {
        pollingRef.current = false;
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [otherSlug, meId, mergeMessages, isNearBottom, scrollToBottom]);

  // Close the kebab menu on an outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const onSend = () => {
    const body = text.trim();
    if (!body || !canSend || pending) return;
    if (body.length > MAX_MESSAGE_LENGTH) {
      setError(`Massimo ${MAX_MESSAGE_LENGTH} caratteri`);
      return;
    }
    setError(null);

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessageView = {
      id: tempId,
      senderId: meId,
      body,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    requestAnimationFrame(() => scrollToBottom(true));

    startTransition(async () => {
      const res = await sendMessage(otherSlug, { body });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.message : m)).sort(byTime),
        );
        const iso = isoOf(res.message);
        if (!lastSyncRef.current || iso > lastSyncRef.current) {
          lastSyncRef.current = iso;
        }
      } else {
        // Roll the optimistic bubble back and let the user retry.
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setText((t) => t || body);
        setError(res.error);
        if (/blocc/i.test(res.error)) {
          pollConversation(otherSlug, lastSyncRef.current)
            .then((r) => {
              if (r.ok) setBlock(r.block);
            })
            .catch(() => {});
        }
      }
    });
  };

  // Send a recorded voice note: optimistic bubble (with the local data-URL for
  // instant playback), then reconcile with the saved server message.
  const sendVoice = (dataUrl: string, duration: number) => {
    if (!canSend) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessageView = {
      id: tempId,
      senderId: meId,
      body: "",
      createdAt: new Date(),
      audioDuration: duration,
      audioUrl: dataUrl,
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollToBottom(true));

    startTransition(async () => {
      const res = await sendMessage(otherSlug, { audio: dataUrl, duration });
      if (res.ok) {
        setMessages((prev) =>
          prev
            .map((m) =>
              m.id === tempId ? { ...res.message, audioUrl: dataUrl } : m,
            )
            .sort(byTime),
        );
        const iso = isoOf(res.message);
        if (!lastSyncRef.current || iso > lastSyncRef.current) {
          lastSyncRef.current = iso;
        }
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(res.error);
      }
    });
  };

  // Stop the recorder, sending the note (or discarding it on cancel). The
  // recorder's onstop handler does the actual blob → data-URL → send.
  const finishRecording = (send: boolean) => {
    if (!recording) return;
    recCancelRef.current = !send;
    recDurationRef.current = Math.min(
      60,
      Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000)),
    );
    if (recTimerRef.current) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    setRecording(false);
    try {
      mediaRecRef.current?.stop();
    } catch {
      /* already stopped */
    }
  };

  const startRecording = async () => {
    if (recording || !canSend || pending) return;
    setError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Registrazione vocale non supportata su questo dispositivo");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickAudioMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recCancelRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (recTimerRef.current) {
          window.clearInterval(recTimerRef.current);
          recTimerRef.current = null;
        }
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (recCancelRef.current || !chunks.length) return;
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          const dataUrl = await blobToDataUrl(blob);
          sendVoice(dataUrl, recDurationRef.current || 1);
        } catch {
          setError("Non è stato possibile salvare il vocale");
        }
      };
      mediaRecRef.current = rec;
      rec.start();
      recStartRef.current = Date.now();
      setRecording(true);
      setRecElapsed(0);
      recTimerRef.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - recStartRef.current) / 1000);
        setRecElapsed(s);
        if (s >= 60) finishRecording(true); // auto-send at the 60s cap
      }, 250);
    } catch {
      setError("Microfono non disponibile o permesso negato");
    }
  };

  // Stop the mic if the thread unmounts mid-recording.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    };
  }, []);

  const onBlock = () =>
    startTransition(async () => {
      const r = await blockUser(otherSlug);
      if (r.ok) setBlock((b) => ({ ...b, iBlocked: true }));
      else setError(r.error);
      setMenuOpen(false);
    });

  const onUnblock = () =>
    startTransition(async () => {
      const r = await unblockUser(otherSlug);
      if (r.ok) setBlock((b) => ({ ...b, iBlocked: false }));
      else setError(r.error);
      setMenuOpen(false);
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <Link
          href="/chat"
          aria-label="Torna ai messaggi"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Link
          href={partner.slug ? `/giocatori/${partner.slug}` : "/chat"}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1 transition hover:bg-surface-2"
        >
          <Avatar
            name={partner.name}
            colorIndex={partner.avatarColor}
            imageUrl={partner.avatarUrl}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{partner.name}</p>
            {partner.username && (
              <p className="truncate text-xs font-medium leading-tight text-muted">
                @{partner.username}
              </p>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={partner.isFriend ? "sea" : "muted"}>
                {partner.isFriend ? (
                  <>
                    <UserCheck className="h-3 w-3" /> Amico
                  </>
                ) : (
                  "Non amico"
                )}
              </Badge>
              {typeof partner.level === "number" && (
                <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  Lv {partner.level}
                </span>
              )}
              {partner.isAdmin && <AdminBadge />}
            </div>
          </div>
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Opzioni conversazione"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-20 w-48 animate-scale-in rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-lg)]">
              {partner.slug && (
                <Link
                  href={`/giocatori/${partner.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"
                >
                  Vedi profilo
                </Link>
              )}
              {block.iBlocked ? (
                <button
                  onClick={onUnblock}
                  disabled={pending}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" /> Sblocca
                </button>
              ) : (
                <button
                  onClick={onBlock}
                  disabled={pending}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-loss hover:bg-surface-2 disabled:opacity-50"
                >
                  <Ban className="h-4 w-4" /> Blocca
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
            Nessun messaggio. Scrivi tu per primo! 👋
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const day = formatDate(m.createdAt);
            const showDay = !prev || formatDate(prev.createdAt) !== day;
            const mine = m.senderId === meId;
            return (
              <Fragment key={m.id}>
                {showDay && (
                  <div className="my-2 flex justify-center">
                    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                      {day}
                    </span>
                  </div>
                )}
                <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-1.5 text-sm shadow-sm",
                      mine
                        ? "rounded-br-md bg-brand text-white"
                        : "rounded-bl-md bg-surface-2 text-foreground",
                    )}
                  >
                    {m.audioDuration != null ? (
                      <VoiceBubble message={m} mine={mine} />
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    )}
                    <p
                      className={cn(
                        "mt-0.5 text-right text-[10px] leading-none",
                        mine ? "text-white/70" : "text-muted",
                      )}
                    >
                      {formatTime(m.createdAt)}
                    </p>
                  </div>
                </div>
                {mine && m.id === lastMineId && (
                  <p className="px-1 text-right text-[10px] font-medium text-muted">
                    {receiptLabel(m, partnerReadAt)}
                  </p>
                )}
              </Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer / block banner */}
      {canSend ? (
        <div className="border-t border-border px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {error && <p className="px-2 pb-1 text-xs font-medium text-loss">{error}</p>}
          {recording ? (
            <div className="flex items-center gap-2 py-1">
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-loss" />
              <span className="font-mono text-sm tabular-nums">
                {fmtDuration(recElapsed)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted">
                Registrando… (max 1:00)
              </span>
              <button
                onClick={() => finishRecording(false)}
                aria-label="Annulla vocale"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-loss"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={() => finishRecording(true)}
                aria-label="Invia vocale"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:brightness-105"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                ref={taRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder={`Messaggio a ${partner.name}…`}
                className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none transition focus:border-brand"
              />
              {text.trim() ? (
                <button
                  onClick={onSend}
                  disabled={pending}
                  aria-label="Invia messaggio"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:brightness-105 disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={pending}
                  aria-label="Registra un messaggio vocale"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:brightness-105 disabled:opacity-50"
                >
                  <Mic className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-border px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm text-muted">
          {block.iBlocked ? (
            <div className="flex flex-col items-center gap-1.5">
              <span>Hai bloccato {partner.name}.</span>
              <button
                onClick={onUnblock}
                disabled={pending}
                className="font-semibold text-brand disabled:opacity-50"
              >
                Sblocca per scrivere
              </button>
            </div>
          ) : (
            <span>Non puoi più scrivere a {partner.name}.</span>
          )}
        </div>
      )}
    </div>
  );
}
