"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { haptic } from "@/lib/a11y";

export type CallTarget = {
  kind: "helper" | "emergency" | "trusted";
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  /** Dodatkowa informacja, np. o SMS-ie do bliskiej osoby. */
  note?: string;
};

const CONNECT_AFTER_MS = 2200;

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Pełnoekranowy widok połączenia — symulacja na potrzeby demo. */
export default function CallOverlay({
  target,
  onClose,
}: {
  target: CallTarget | null;
  onClose: () => void;
}) {
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);

  useEffect(() => {
    if (!target) return;
    setConnectedAt(null);
    setMuted(false);
    setSpeaker(true);
    haptic([20, 60, 20]);
    const t = window.setTimeout(() => {
      setConnectedAt(Date.now());
      haptic(30);
    }, CONNECT_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [target]);

  useEffect(() => {
    if (connectedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [connectedAt]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  const emergency = target.kind === "emergency";
  const connected = connectedAt != null;
  const status = connected
    ? formatDuration(Math.max(0, Math.floor((now - connectedAt) / 1000)))
    : "Łączenie…";

  return (
    <div
      className={`fixed inset-0 z-[90] flex animate-fade-in flex-col items-center justify-between overflow-hidden px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-10 text-white ${
        emergency
          ? "bg-linear-to-b from-red-700 via-red-900 to-[#2a0707]"
          : "bg-linear-to-b from-ink-soft via-ink to-[#03140e]"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={`Połączenie: ${target.name}`}
    >
      <div
        className={`pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl ${
          emergency ? "bg-red-400/30" : "bg-emerald-500/25"
        }`}
        aria-hidden
      />

      <div className="relative flex w-full flex-col items-center gap-2 text-center">
        <p className="text-base font-semibold uppercase tracking-[0.14em] text-white/60">
          {emergency ? "Połączenie alarmowe" : "Połączenie przez Kompano"}
        </p>
      </div>

      <div className="relative flex flex-col items-center text-center">
        <div className="relative flex h-36 w-36 items-center justify-center">
          {!connected &&
            [0, 600, 1200].map((delay) => (
              <span
                key={delay}
                className={`absolute inset-0 animate-ring-out rounded-full ${
                  emergency ? "bg-red-300/40" : "bg-emerald-300/30"
                }`}
                style={{ animationDelay: `${delay}ms` }}
                aria-hidden
              />
            ))}
          {target.avatarUrl ? (
            <img
              src={target.avatarUrl}
              alt=""
              className="relative h-36 w-36 rounded-full object-cover ring-4 ring-white/20"
              width={144}
              height={144}
            />
          ) : (
            <span
              className={`relative flex h-36 w-36 items-center justify-center rounded-full text-5xl font-bold ring-4 ring-white/20 ${
                emergency ? "bg-white text-red-700" : "bg-emerald-600"
              }`}
              aria-hidden
            >
              {emergency ? "112" : initials(target.name)}
            </span>
          )}
        </div>
        <p className="mt-7 text-4xl font-bold tracking-tight">{target.name}</p>
        {target.subtitle && (
          <p className="mt-1 text-xl font-semibold text-white/70">
            {target.subtitle}
          </p>
        )}
        <p
          className="mt-4 text-2xl font-semibold tabular-nums text-white/90"
          aria-live="polite"
        >
          {status}
        </p>
        {target.note && (
          <p className="mt-5 flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-base font-semibold text-white/90">
            <MessageCircle className="h-5 w-5 shrink-0" strokeWidth={2.4} aria-hidden />
            {target.note}
          </p>
        )}
      </div>

      <div className="relative flex w-full flex-col items-center gap-8">
        <div className="flex w-full max-w-xs justify-around">
          <CallToggle
            active={muted}
            onClick={() => setMuted((v) => !v)}
            label={muted ? "Wyciszony" : "Wycisz"}
            icon={muted ? MicOff : Mic}
          />
          <CallToggle
            active={speaker}
            onClick={() => setSpeaker((v) => !v)}
            label="Głośnik"
            icon={Volume2}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            haptic(20);
            onClose();
          }}
          className="press flex flex-col items-center gap-2"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 shadow-sos">
            <PhoneOff className="h-9 w-9" strokeWidth={2.4} aria-hidden />
          </span>
          <span className="text-xl font-bold">Rozłącz</span>
        </button>
      </div>
    </div>
  );
}

function CallToggle({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof Mic;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic(8);
        onClick();
      }}
      aria-pressed={active}
      className="press flex flex-col items-center gap-2"
    >
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors ${
          active ? "bg-white text-ink" : "bg-white/15 text-white"
        }`}
      >
        <Icon className="h-7 w-7" strokeWidth={2.4} aria-hidden />
      </span>
      <span className="text-base font-semibold text-white/85">{label}</span>
    </button>
  );
}
