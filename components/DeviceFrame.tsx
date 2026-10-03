"use client";

import { useEffect, useState, type ReactNode, type Ref } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";

export type FrameTone = "light" | "dark";

const SCREEN_W = 393;
const SCREEN_H = 852;
const BEZEL = 12;
export const FRAME_W = SCREEN_W + BEZEL * 2;
export const FRAME_H = SCREEN_H + BEZEL * 2;
const STATUS_BAR_H = 50;

export type LayoutMode = "device" | "bleed";

function computeMode(): LayoutMode {
  const w = window.innerWidth;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (w < 900 || (coarse && w < 1024)) return "bleed";
  return "device";
}

/** `bleed` — aplikacja na pełnym ekranie (telefon), `device` — prezentacja z makietą. */
export function useLayoutMode(): LayoutMode | null {
  const [mode, setMode] = useState<LayoutMode | null>(null);
  useEffect(() => {
    const update = () => setMode(computeMode());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return mode;
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function StatusBar({ tone }: { tone: FrameTone }) {
  const time = useClock();
  const dark = tone === "dark";
  return (
    <div
      className={`relative flex shrink-0 items-center justify-between px-8 text-[15px] font-semibold transition-colors duration-500 ${
        dark ? "bg-ink text-white" : "bg-white text-black"
      }`}
      style={{ height: STATUS_BAR_H }}
      aria-hidden
    >
      <span className="w-16 tabular-nums">{time}</span>
      <span className="absolute left-1/2 top-[11px] h-[34px] w-[120px] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex w-16 items-center justify-end gap-1.5">
        <Signal className="h-4 w-4" strokeWidth={2.5} />
        <Wifi className="h-4 w-4" strokeWidth={2.5} />
        <BatteryFull className="h-5 w-5" strokeWidth={2} />
      </span>
    </div>
  );
}

/** Aplikacja na pełnym ekranie telefonu. */
export function BleedFrame({ children }: { children: ReactNode }) {
  return (
    <div
      data-app
      className="h-dvh w-full overflow-hidden bg-neutral-50 [transform:translateZ(0)]"
    >
      {children}
    </div>
  );
}

/**
 * Realistyczna makieta telefonu. Transform na kontenerze ekranu sprawia,
 * że elementy `fixed` w aplikacji trzymają się ekranu makiety.
 */
export function PhoneFrame({
  children,
  tone,
  scale,
  screenRef,
  overlay,
}: {
  children: ReactNode;
  tone: FrameTone;
  scale: number;
  screenRef?: Ref<HTMLDivElement>;
  overlay?: ReactNode;
}) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: FRAME_W * scale, height: FRAME_H * scale }}
    >
      <div
        className="absolute left-0 top-0 rounded-[62px] bg-[#111312] shadow-[0_50px_100px_-30px_rgb(15_23_20/0.55),0_0_0_1.5px_#2a2e2c,inset_0_0_0_1.5px_#3a3f3c]"
        style={{
          width: FRAME_W,
          height: FRAME_H,
          padding: BEZEL,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[50px] bg-white">
          <StatusBar tone={tone} />
          <div
            ref={screenRef}
            data-app
            className="relative min-h-0 flex-1 overflow-hidden [transform:translateZ(0)]"
          >
            {children}
            {overlay}
          </div>
          <span
            className="pointer-events-none absolute bottom-2 left-1/2 z-[2000] h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-black/80"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
