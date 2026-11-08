import type { ClickHandler } from './types';

/** Assign `el.onclick` from a handler that uses `this` as the clicked element (original semantics). */
export function setOnClick(
  el: HTMLElement,
  handler: (this: HTMLElement, e?: Event | null) => void,
): void {
  el.onclick = handler as unknown as ClickHandler;
}
