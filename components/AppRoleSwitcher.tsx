"use client";

import { useCallback, useEffect, useState } from "react";
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
      {role === "client" ? <ClientApp /> : <HelperApp />}
    </>
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
