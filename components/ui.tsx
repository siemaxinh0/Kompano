"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, HeartHandshake, Volume2, type LucideIcon } from "lucide-react";
import { canSpeak, haptic, speak, stopSpeaking } from "@/lib/a11y";

export function BrandMark({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[30%] bg-linear-to-br from-emerald-500 to-emerald-800 text-white shadow-[0_8px_20px_-8px_rgb(4_120_87/0.7)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <HeartHandshake
        style={{ width: size * 0.58, height: size * 0.58 }}
        strokeWidth={2.2}
      />
    </span>
  );
}

type Accent = "emerald" | "violet" | "amber" | "red";

const CHOICE_ACCENTS: Record<
  Accent,
  { selected: string; badge: string }
> = {
  emerald: {
    selected: "bg-emerald-50 ring-[3px] ring-emerald-700",
    badge: "bg-emerald-700",
  },
  violet: {
    selected: "bg-violet-50 ring-[3px] ring-violet-600",
    badge: "bg-violet-600",
  },
  amber: {
    selected: "bg-amber-50 ring-[3px] ring-amber-600",
    badge: "bg-amber-600",
  },
  red: {
    selected: "bg-red-50 ring-[3px] ring-red-600",
    badge: "bg-red-600",
  },
};

/** Duży kafel wyboru — zaznaczenie widać po obwódce, tle i znaczniku. */
export function ChoiceTile({
  selected,
  error = false,
  accent = "emerald",
  label,
  hint,
  icon: Icon,
  onClick,
  align = "left",
  demoId,
}: {
  selected: boolean;
  error?: boolean;
  accent?: Accent;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  onClick: () => void;
  align?: "left" | "center";
  demoId?: string;
}) {
  const styles = CHOICE_ACCENTS[accent];
  return (
    <button
      type="button"
      data-demo={demoId}
      aria-pressed={selected}
      onClick={() => {
        haptic(8);
        onClick();
      }}
      className={`press relative flex min-h-[4rem] w-full rounded-2xl px-4 py-3 ${
        align === "center"
          ? "flex-col items-center justify-center gap-1.5 text-center"
          : "items-center gap-3 text-left"
      } ${
        selected
          ? styles.selected
          : error
            ? "bg-red-50 ring-2 ring-red-300"
            : "bg-white ring-1 ring-neutral-200 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
      }`}
    >
      {Icon && (
        <Icon
          className={`h-6 w-6 shrink-0 ${selected ? "text-black" : "text-neutral-600"}`}
          strokeWidth={2.4}
          aria-hidden
        />
      )}
      <span className={`min-w-0 ${hint && align === "left" ? "pr-5" : ""}`}>
        <span className="block text-xl font-bold leading-tight text-black">
          {label}
        </span>
        {hint && (
          <span
            className={`mt-0.5 block text-lg font-semibold leading-tight ${
              selected ? "text-neutral-700" : "text-neutral-500"
            }`}
          >
            {hint}
          </span>
        )}
      </span>
      {selected && (
        <span
          className={`absolute right-2.5 top-2.5 flex h-6 w-6 animate-pop-in items-center justify-center rounded-full text-white ${styles.badge}`}
          aria-hidden
        >
          <Check className="h-4 w-4" strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}

/** Arkusz wysuwany od dołu (jak w Uber/Bolt) — zamyka się tłem lub Escape. */
export function BottomSheet({
  open,
  onClose,
  labelledBy,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-[2px]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div className="relative max-h-[92%] w-full max-w-md animate-sheet-up overflow-y-auto rounded-t-[2rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-float no-scrollbar">
        <div
          className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-300"
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}

export function AnimatedCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 52" className={className} aria-hidden>
      <circle
        cx="26"
        cy="26"
        r="25"
        fill="currentColor"
        className="origin-center animate-pop-in [transform-box:fill-box]"
      />
      <path
        d="M15 27.5l7 7 15-16"
        fill="none"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        className="animate-draw"
      />
    </svg>
  );
}

function EqBars() {
  return (
    <span className="flex h-5 w-5 items-center justify-center gap-[3px]" aria-hidden>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-4 w-[3px] origin-center animate-eq rounded-full bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

/** Odczytuje komunikat na głos (Web Speech API, głos polski). */
export function SpeakButton({
  text,
  label = "Przeczytaj",
  compact = false,
  tone = "light",
}: {
  text: string;
  label?: string;
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  useEffect(() => {
    setSupported(canSpeak());
    return () => {
      if (speakingRef.current) stopSpeaking();
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    haptic(8);
    if (speaking) {
      stopSpeaking();
      speakingRef.current = false;
      setSpeaking(false);
      return;
    }
    speakingRef.current = true;
    setSpeaking(true);
    speak(text, {
      onEnd: () => {
        speakingRef.current = false;
        setSpeaking(false);
      },
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={speaking ? "Zatrzymaj czytanie" : `${label} na głos`}
      className={`press inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold ${
        compact ? "h-11 w-11" : "min-h-11 px-4 py-2 text-base"
      } ${
        tone === "dark"
          ? "bg-white/15 text-white"
          : speaking
            ? "bg-emerald-700 text-white"
            : "bg-neutral-100 text-neutral-800"
      }`}
    >
      {speaking ? (
        <EqBars />
      ) : (
        <Volume2 className="h-5 w-5" strokeWidth={2.5} aria-hidden />
      )}
      {!compact && <span>{speaking ? "Stop" : label}</span>}
    </button>
  );
}

export function SwitchRow({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
  demoId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  demoId?: string;
}) {
  return (
    <button
      type="button"
      data-demo={demoId}
      role="switch"
      aria-checked={checked}
      onClick={() => {
        haptic(8);
        onChange(!checked);
      }}
      className="press flex w-full items-center gap-4 py-3 text-left"
    >
      {Icon && (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-100">
          <Icon className="h-6 w-6 text-neutral-800" strokeWidth={2.4} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold leading-tight text-black">
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-base font-semibold leading-snug text-neutral-500">
            {description}
          </span>
        )}
      </span>
      <span
        className={`relative h-9 w-16 shrink-0 rounded-full transition-colors duration-300 ${
          checked ? "bg-emerald-700" : "bg-neutral-300"
        }`}
        aria-hidden
      >
        <span
          className={`absolute left-1 top-1 h-7 w-7 rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            checked ? "translate-x-7" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
