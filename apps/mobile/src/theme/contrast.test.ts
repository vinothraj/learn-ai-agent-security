import { describe, expect, it } from 'vitest';
import { ACCENTS, buildTheme, type AccentKey } from './tokens';

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

const MODES = ['dark', 'light', 'amoled', 'contrast'] as const;
const accents = Object.keys(ACCENTS) as AccentKey[];

describe('theme contrast (WCAG AA)', () => {
  for (const mode of MODES) {
    for (const accent of accents) {
      const t = buildTheme(mode, accent);
      it(`${mode} / ${accent}`, () => {
        const body = mode === 'contrast' ? 7 : 4.5; // AAA for the high-contrast theme
        for (const bg of [t.bg, t.surface]) {
          expect(contrast(t.text, bg), 'text').toBeGreaterThanOrEqual(body);
          expect(contrast(t.textMuted, bg), 'muted text').toBeGreaterThanOrEqual(4.5);
          // Accent is used for links and small labels, so it must pass as normal text.
          expect(contrast(t.accent, bg), 'accent text').toBeGreaterThanOrEqual(4.5);
          for (const k of ['success', 'danger', 'warning', 'info'] as const) expect(contrast(t[k], bg), k).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(t.onAccent, t.accent), 'text on accent buttons').toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
