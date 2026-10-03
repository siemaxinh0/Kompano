"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { A11Y_STORAGE_KEY } from "@/lib/a11yBoot";

export type TextSize = "normal" | "large" | "xlarge";

export type A11yPrefs = {
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
  /** Automatyczne czytanie zmian statusu zlecenia. */
  autoSpeak: boolean;
};

export const DEFAULT_A11Y_PREFS: A11yPrefs = {
  textSize: "normal",
  highContrast: false,
  reduceMotion: false,
  autoSpeak: false,
};

export const TEXT_SIZE_ORDER: TextSize[] = ["normal", "large", "xlarge"];

function readPrefs(): A11yPrefs {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return DEFAULT_A11Y_PREFS;
    const parsed = JSON.parse(raw) as Partial<A11yPrefs>;
    return {
      textSize: TEXT_SIZE_ORDER.includes(parsed.textSize as TextSize)
        ? (parsed.textSize as TextSize)
        : "normal",
      highContrast: Boolean(parsed.highContrast),
      reduceMotion: Boolean(parsed.reduceMotion),
      autoSpeak: Boolean(parsed.autoSpeak),
    };
  } catch {
    return DEFAULT_A11Y_PREFS;
  }
}

function applyPrefs(prefs: A11yPrefs) {
  const root = document.documentElement;
  if (prefs.textSize === "normal") delete root.dataset.textSize;
  else root.dataset.textSize = prefs.textSize;
  root.classList.toggle("hc", prefs.highContrast);
  root.classList.toggle("reduce-motion", prefs.reduceMotion);
}

export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(
  text: string,
  handlers?: { onStart?: () => void; onEnd?: () => void },
): boolean {
  if (!canSpeak()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pl-PL";
  utterance.rate = 0.92;
  const polish = synth
    .getVoices()
    .find((v) => v.lang?.toLowerCase().startsWith("pl"));
  if (polish) utterance.voice = polish;
  utterance.onstart = () => handlers?.onStart?.();
  utterance.onend = () => handlers?.onEnd?.();
  utterance.onerror = () => handlers?.onEnd?.();
  synth.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

type A11yContextValue = {
  prefs: A11yPrefs;
  setPrefs: (patch: Partial<A11yPrefs>) => void;
  cycleTextSize: () => void;
};

const A11yContext = createContext<A11yContextValue | null>(null);

export function A11yProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<A11yPrefs>(DEFAULT_A11Y_PREFS);

  useEffect(() => {
    setPrefsState(readPrefs());
  }, []);

  const setPrefs = useCallback((patch: Partial<A11yPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      applyPrefs(next);
      return next;
    });
  }, []);

  const cycleTextSize = useCallback(() => {
    setPrefsState((prev) => {
      const idx = TEXT_SIZE_ORDER.indexOf(prev.textSize);
      const next = {
        ...prev,
        textSize: TEXT_SIZE_ORDER[(idx + 1) % TEXT_SIZE_ORDER.length],
      };
      try {
        localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      applyPrefs(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ prefs, setPrefs, cycleTextSize }),
    [prefs, setPrefs, cycleTextSize],
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y(): A11yContextValue {
  const ctx = useContext(A11yContext);
  if (!ctx) {
    return {
      prefs: DEFAULT_A11Y_PREFS,
      setPrefs: () => {},
      cycleTextSize: () => {},
    };
  }
  return ctx;
}

/** Czyta tekst, gdy włączone jest automatyczne czytanie i tekst się zmienił. */
export function useAutoSpeak(text: string | null) {
  const { prefs } = useA11y();
  useEffect(() => {
    if (!prefs.autoSpeak || !text) return;
    const t = window.setTimeout(() => speak(text), 350);
    return () => window.clearTimeout(t);
  }, [prefs.autoSpeak, text]);
}
