import type { Locator, Page } from 'playwright';
import type { ButtonInfo } from '../domain/types';
import { contrastRatio } from '../parsers/contrast';

/** Geometry and colours of the buy button, measured before clicking. Never throws. */
export async function inspectButton(page: Page, el: Locator): Promise<ButtonInfo | undefined> {
  const raw = await el
    .evaluate((node) => {
      const r = node.getBoundingClientRect();
      let bg: string | undefined;
      for (let n: Element | null = node; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage !== 'none') break;
        const alpha = cs.backgroundColor.match(/[\d.]+/g)?.[3];
        if (alpha === undefined || Number(alpha) > 0.95) {
          bg = cs.backgroundColor;
          break;
        }
      }
      return { label: (node.textContent ?? '').trim().slice(0, 40), top: r.top + window.scrollY, w: r.width, h: r.height, fg: getComputedStyle(node).color, bg };
    })
    .catch(() => undefined);
  if (!raw) return undefined;
  return {
    label: raw.label,
    widthPx: Math.round(raw.w),
    heightPx: Math.round(raw.h),
    inFirstScreen: raw.top + raw.h <= (page.viewportSize()?.height ?? Infinity),
    contrast: raw.bg ? contrastRatio(raw.fg, raw.bg) : undefined,
  };
}
