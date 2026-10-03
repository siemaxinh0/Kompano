export class AbortedError extends Error {
  constructor() {
    super("aborted");
  }
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new AbortedError());
    const t = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(t);
      reject(new AbortedError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isVisible(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && !(el as HTMLButtonElement).disabled;
}

export function findDemoElement(
  root: HTMLElement,
  target: string,
): HTMLElement | null {
  const nodes = root.querySelectorAll<HTMLElement>(`[data-demo="${target}"]`);
  for (const node of nodes) if (isVisible(node)) return node;
  return null;
}

export async function waitForDemoElement(
  root: HTMLElement,
  target: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<HTMLElement | null> {
  const started = Date.now();
  for (;;) {
    const el = findDemoElement(root, target);
    if (el) return el;
    if (Date.now() - started > timeoutMs) return null;
    await sleep(120, signal);
  }
}

/** Skala makiety — ekran ma rozmiar CSS, ale jest pomniejszony transformacją. */
export function screenScale(root: HTMLElement): number {
  const rect = root.getBoundingClientRect();
  return root.offsetWidth > 0 ? rect.width / root.offsetWidth : 1;
}

function findScroller(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== root) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight + 2
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Przewija zawartość ekranu tak, by element był w górnej, nieprzysłoniętej części. */
export async function bringIntoView(
  el: HTMLElement,
  root: HTMLElement,
  signal: AbortSignal,
): Promise<void> {
  const scroller = findScroller(el, root);
  if (!scroller) return;
  const scale = screenScale(root);
  const sRect = scroller.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const viewH = scroller.clientHeight;
  const centerY = (eRect.top + eRect.height / 2 - sRect.top) / scale;
  if (centerY > viewH * 0.12 && centerY < viewH * 0.52) return;
  const next = Math.max(0, scroller.scrollTop + centerY - viewH * 0.36);
  if (Math.abs(next - scroller.scrollTop) < 4) return;
  scroller.scrollTo({ top: next, behavior: "smooth" });
  await sleep(650, signal);
}

export function pointWithin(
  el: HTMLElement,
  root: HTMLElement,
): { x: number; y: number } {
  const scale = screenScale(root);
  const rRect = root.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  return {
    x: (eRect.left + eRect.width / 2 - rRect.left) / scale,
    y: (eRect.top + eRect.height / 2 - rRect.top) / scale,
  };
}

export function speakAsync(
  text: string,
  signal: AbortSignal,
  speakFn: (text: string, h: { onEnd: () => void }) => boolean,
): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(guard);
      resolve();
    };
    const guard = window.setTimeout(finish, Math.max(4000, text.length * 110));
    signal.addEventListener("abort", finish, { once: true });
    if (!speakFn(text, { onEnd: finish })) finish();
  });
}
