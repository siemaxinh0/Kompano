"use client";

import { useCallback, useEffect, useState } from "react";
import { Bike, HeartHandshake } from "lucide-react";
import ClientApp from "@/components/ClientApp";
import HelperApp from "@/components/HelperApp";
import {
  isDemoJumpHotkey,
  isTypingTarget,
  queueDemoJump,
} from "@/lib/demoShortcuts";

export type AppRole = "client" | "helper";

const STORAGE_KEY = "helpovski-app-role";

/** Ctrl+Alt+H — przełączanie zleceniodawca ↔ zleceniobiorca (mock). */
export const ROLE_SWITCH_SHORTCUT_LABEL = "Ctrl+Alt+H";

function readStoredRole(): AppRole {
  if (typeof window === "undefined") return "client";
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v === "helper" || v === "client") return v;
  } catch {
    /* ignore */
  }
  return "client";
}

function isRoleSwitchHotkey(e: KeyboardEvent): boolean {
  return e.ctrlKey && e.altKey && !e.metaKey && e.key.toLowerCase() === "h";
}

/**
 * Root przełącznika ról.
 * Ctrl+Alt+H — klient ↔ pomocnik
 * Ctrl+Alt+R — oddanie psa po spacerze (potwierdzenie + koniec)
 */
export default function AppRoleSwitcher() {
  const [role, setRole] = useState<AppRole>("client");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(readStoredRole());
    setReady(true);
  }, []);

  const setRolePersist = useCallback((next: AppRole) => {
    setRole(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleRole = useCallback(() => {
    setRole((prev) => {
      const next: AppRole = prev === "client" ? "helper" : "client";
      try {
        sessionStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const jumpToDogHandoff = useCallback(() => {
    queueDemoJump({ kind: "dog_handoff" });
    setRolePersist("client");
  }, [setRolePersist]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (isRoleSwitchHotkey(e)) {
        e.preventDefault();
        toggleRole();
        return;
      }

      if (isDemoJumpHotkey(e)) {
        e.preventDefault();
        jumpToDogHandoff();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleRole, jumpToDogHandoff]);

  if (!ready) {
    return (
      <div className="mx-auto flex h-dvh max-w-md items-center justify-center bg-neutral-50">
        <span className="text-lg font-bold text-neutral-500">Ładowanie…</span>
      </div>
    );
  }

  return (
    <>
      <DesktopBrandSide side="left" />
      <DesktopBrandSide side="right" />
      <DesktopRoleToggle role={role} onChange={setRolePersist} />
      {role === "client" ? <ClientApp /> : <HelperApp />}
    </>
  );
}

const ROLE_OPTIONS: {
  id: AppRole;
  label: string;
  hint: string;
  icon: typeof Bike;
}[] = [
  { id: "client", label: "Zleceniodawca", hint: "Senior zamawia pomoc", icon: HeartHandshake },
  { id: "helper", label: "Zleceniobiorca", hint: "Pomocnik przyjmuje zlecenia", icon: Bike },
];

/** Przełącznik trybu w lewym pasie pod logo — tylko na szerokim ekranie. */
function DesktopRoleToggle({
  role,
  onChange,
}: {
  role: AppRole;
  onChange: (role: AppRole) => void;
}) {
  return (
    <div className="fixed left-0 right-[calc(50%+14rem)] top-[calc(50%+4.5rem)] hidden justify-center lg:flex">
      <div
        role="radiogroup"
        aria-label="Tryb aplikacji"
        className="w-[min(20rem,80%)] rounded-3xl bg-white p-2 shadow-lg shadow-black/5 ring-1 ring-black/5"
      >
        <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
          Tryb aplikacji
        </p>
        {ROLE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = role === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                selected ? "bg-emerald-700 text-white" : "text-neutral-800 hover:bg-neutral-100"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  selected ? "bg-white/15" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold">{opt.label}</span>
                <span
                  className={`block truncate text-sm font-semibold ${
                    selected ? "text-emerald-100" : "text-neutral-500"
                  }`}
                >
                  {opt.hint}
                </span>
              </span>
            </button>
          );
        })}
        <p className="px-3 pb-1 pt-2 text-xs font-semibold text-neutral-400">
          Skrót: {ROLE_SWITCH_SHORTCUT_LABEL}
        </p>
      </div>
    </div>
  );
}

/** Logo w wolnym pasie obok kolumny aplikacji (max-w-md = 28rem) — tylko na szerokim ekranie. */
function DesktopBrandSide({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={`pointer-events-none fixed inset-y-0 hidden items-center justify-center lg:flex ${
        side === "left" ? "left-0 right-[calc(50%+14rem)]" : "left-[calc(50%+14rem)] right-0"
      }`}
      aria-hidden
    >
      <img
        src="/kompano-logo-wordmark.png"
        alt=""
        className="w-[min(22rem,75%)] select-none"
        draggable={false}
      />
    </div>
  );
}
