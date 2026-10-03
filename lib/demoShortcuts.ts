/** Demo / mock skróty produktowe Helpovski */

export const DEMO_JUMP_EVENT = "helpovski-demo-jump";
export const DEMO_JUMP_STORAGE_KEY = "helpovski-demo-jump";

/** Ctrl+Alt+R — skok do oddania psa po spacerze (ekran potwierdzenia). */
export const DEMO_JUMP_SHORTCUT_LABEL = "Ctrl+Alt+R";

export type DemoJumpKind = "dog_handoff";

export type DemoJumpPayload = {
  kind: DemoJumpKind;
};

export function queueDemoJump(payload: DemoJumpPayload) {
  try {
    sessionStorage.setItem(DEMO_JUMP_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(DEMO_JUMP_EVENT, { detail: payload }),
  );
}

export function consumeDemoJump(): DemoJumpPayload | null {
  try {
    const raw = sessionStorage.getItem(DEMO_JUMP_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DEMO_JUMP_STORAGE_KEY);
    return JSON.parse(raw) as DemoJumpPayload;
  } catch {
    return null;
  }
}

export function isDemoJumpHotkey(e: KeyboardEvent): boolean {
  return e.ctrlKey && e.altKey && !e.metaKey && e.key.toLowerCase() === "r";
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(el?.isContentEditable)
  );
}
